// PRD-FEAT-005: Price History Scheduler
// PRD-FEAT-012: ETF Component Collection Scheduler
import { schedule } from 'node-cron'
import type { ScheduledTaskRepository } from '../database/scheduled-task-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { PriceCollectorService } from './price-collector-service.js'
import type { EtfComponentCollectorService } from './etf-component-collector-service.js'
import { log } from '../middleware/logger.js'

export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  priceService: PriceCollectorService,
  etfService: EtfComponentCollectorService | null,
): Promise<void> {
  const recovered = await executionRepo.recoverStaleRuns()
  if (recovered > 0) {
    log('warn', `Recovered ${recovered} stale 'running' execution(s) from prior crash`)
  }

  const tasks = await taskRepo.findEnabled()
  for (const t of tasks) {
    schedule(t.cron_expression, () => {
      if (t.name === 'price-collection-daily') {
        priceService.run().catch((err) =>
          log('error', `Scheduler '${t.name}' error: ${err}`),
        )
      } else if (t.name === 'etf-component-collection-daily' && etfService) {
        etfService.run().catch((err) =>
          log('error', `Scheduler '${t.name}' error: ${err}`),
        )
      } else {
        log('warn', `Unknown scheduled task: ${t.name} — skipping`)
      }
    })
    log('info', `Cron registered: '${t.name}' → ${t.cron_expression}`)
  }
}
