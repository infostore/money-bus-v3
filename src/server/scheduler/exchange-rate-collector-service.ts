// PRD-FEAT-016: Exchange Rate Collection Scheduler
import type { TaskExecution } from '../../shared/types.js'
import type { ExchangeRateFetcher } from '../services/exchange-rate-fetcher.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { TaskExecutionDetailRepository } from '../database/task-execution-detail-repository.js'
import { log } from '../middleware/logger.js'

export class ExchangeRateCollectorService {
  private isRunning = false

  constructor(
    private readonly fetcher: ExchangeRateFetcher,
    private readonly taskExecutionRepo: TaskExecutionRepository,
    private readonly detailRepo: TaskExecutionDetailRepository,
    private readonly taskId: number,
  ) {}

  get running(): boolean {
    return this.isRunning
  }

  async run(): Promise<TaskExecution> {
    if (this.isRunning) {
      throw new Error('Exchange rate collection is already running')
    }

    this.isRunning = true
    try {
      return await this.executeCollection()
    } finally {
      this.isRunning = false
    }
  }

  private async executeCollection(): Promise<TaskExecution> {
    const execution = await this.taskExecutionRepo.create({
      taskId: this.taskId,
      startedAt: new Date(),
    })

    try {
      await this.fetcher.updateUsdRate()

      await this.detailRepo.create({ executionId: execution.id, productId: null, status: 'success', message: 'USD/KRW' })

      const completed = await this.taskExecutionRepo.complete(execution.id, {
        status: 'success',
        productsTotal: 1,
        productsSucceeded: 1,
        productsFailed: 0,
        productsSkipped: 0,
        message: null,
      })

      await this.taskExecutionRepo.trimOldExecutions(this.taskId)
      return completed!
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log('error', `Exchange rate collection failed: ${msg}`)

      await this.detailRepo.create({ executionId: execution.id, productId: null, status: 'failed', message: `USD/KRW: ${msg}` })

      const completed = await this.taskExecutionRepo.complete(execution.id, {
        status: 'failed',
        productsTotal: 1,
        productsSucceeded: 0,
        productsFailed: 1,
        productsSkipped: 0,
        message: msg,
      })

      await this.taskExecutionRepo.trimOldExecutions(this.taskId)
      return completed!
    }
  }
}
