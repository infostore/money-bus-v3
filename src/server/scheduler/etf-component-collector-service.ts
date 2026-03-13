// PRD-FEAT-012: ETF Component Collection Scheduler
import type { EtfProfile, EtfManager, TaskExecution } from '../../shared/types.js'
import type { EtfProfileRepository } from '../database/etf-profile-repository.js'
import type { EtfComponentRepository } from '../database/etf-component-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { EtfComponentAdapter } from './etf-component-adapter.js'
import { withRetry } from './with-retry.js'
import { log } from '../middleware/logger.js'

const ETF_CHUNK_SIZE = 5
const ETF_CHUNK_DELAY_MS = 500

interface CollectionCounters {
  readonly total: number
  readonly succeeded: number
  readonly failed: number
  readonly skipped: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function abortablePromise<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'))
      return
    }
    const onAbort = () => reject(new Error('aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export class EtfComponentCollectorService {
  private isRunning = false
  private abortController: AbortController | null = null

  constructor(
    private readonly profileRepo: EtfProfileRepository,
    private readonly componentRepo: EtfComponentRepository,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly adapters: ReadonlyMap<EtfManager, EtfComponentAdapter>,
    private readonly taskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  abort(): void {
    this.abortController?.abort()
  }

  async run(): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Collection is already running')
    }

    this.abortController = new AbortController()
    this.isRunning = true
    try {
      return await this.executeCollection(this.abortController.signal)
    } finally {
      this.isRunning = false
      this.abortController = null
    }
  }

  private async executeCollection(signal: AbortSignal): Promise<TaskExecution> {
    const execution = await this.taskExecutionRepo.create({
      taskId: this.taskId,
      startedAt: new Date(),
    })

    let profiles: readonly EtfProfile[]
    try {
      profiles = await abortablePromise(this.profileRepo.findAll(), signal)
    } catch {
      const completed = await this.taskExecutionRepo.complete(execution.id, {
        status: 'aborted',
        productsTotal: 0,
        productsSucceeded: 0,
        productsFailed: 0,
        productsSkipped: 0,
        message: '사용자 요청으로 중지됨',
      })
      await this.taskExecutionRepo.trimOldExecutions(this.taskId)
      if (!completed) throw new Error(`Failed to complete execution ${execution.id}`)
      return completed
    }
    const snapshotDate = formatDateYYYYMMDD(new Date())
    let counters: CollectionCounters = {
      total: profiles.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    }

    await this.updateProgress(execution.id, counters)

    let aborted = false
    for (let i = 0; i < profiles.length; i += ETF_CHUNK_SIZE) {
      if (signal.aborted) {
        aborted = true
        break
      }

      const chunk = profiles.slice(i, i + ETF_CHUNK_SIZE)
      const result = await this.processChunk(execution.id, chunk, snapshotDate, signal, counters)
      counters = result.counters
      aborted = result.aborted

      if (aborted) break

      const isLastChunk = i + ETF_CHUNK_SIZE >= profiles.length
      if (!isLastChunk) {
        await sleep(ETF_CHUNK_DELAY_MS)
      }
    }

    const status = aborted ? 'aborted' : this.determineStatus(counters)
    const message = aborted ? '사용자 요청으로 중지됨' : null
    const completed = await this.taskExecutionRepo.complete(execution.id, {
      status,
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
      message,
    })

    await this.taskExecutionRepo.trimOldExecutions(this.taskId)

    return completed!
  }

  private async processChunk(
    executionId: number,
    profiles: readonly EtfProfile[],
    snapshotDate: string,
    signal: AbortSignal,
    counters: CollectionCounters,
  ): Promise<{ readonly counters: CollectionCounters; readonly aborted: boolean }> {
    let current = counters

    for (const profile of profiles) {
      if (signal.aborted) {
        return { counters: current, aborted: true }
      }

      current = await this.processOneEtf(profile, snapshotDate, current, signal)
      await this.updateProgress(executionId, current)
    }

    return { counters: current, aborted: false }
  }

  private async processOneEtf(
    profile: EtfProfile,
    snapshotDate: string,
    counters: CollectionCounters,
    signal?: AbortSignal,
  ): Promise<CollectionCounters> {
    const adapter = this.adapters.get(profile.manager)
    if (!adapter) {
      log('warn', `No adapter for manager '${profile.manager}' (product_id=${profile.product_id})`)
      return { ...counters, skipped: counters.skipped + 1 }
    }

    const exists = await this.componentRepo.hasSnapshot(profile.product_id, snapshotDate)
    if (exists) {
      return { ...counters, skipped: counters.skipped + 1 }
    }

    try {
      const rows = await withRetry(
        () => adapter.fetchComponents(profile, snapshotDate),
        { signal },
      )

      if (rows.length > 0) {
        await this.componentRepo.upsertMany(rows)
      }

      log('info', `ETF components collected: product_id=${profile.product_id}, rows=${rows.length}`)
      return { ...counters, succeeded: counters.succeeded + 1 }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `ETF component collection failed for product_id=${profile.product_id}: ${msg}`)
      return { ...counters, failed: counters.failed + 1 }
    }
  }

  private async updateProgress(executionId: number, counters: CollectionCounters): Promise<void> {
    await this.taskExecutionRepo.updateProgress(executionId, {
      productsTotal: counters.total,
      productsSucceeded: counters.succeeded,
      productsFailed: counters.failed,
      productsSkipped: counters.skipped,
    })
  }

  private determineStatus(counters: CollectionCounters): 'success' | 'partial' | 'failed' {
    if (counters.failed === 0) return 'success'
    if (counters.succeeded === 0) return 'failed'
    return 'partial'
  }
}
