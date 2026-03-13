// PRD-FEAT-005: Price History Scheduler
import { schedule } from 'node-cron'
import type { ScheduledTaskRepository } from '../database/scheduled-task-repository.js'
import type { TaskExecutionRepository } from '../database/task-execution-repository.js'
import type { PriceCollectorService } from './price-collector-service.js'
import { log } from '../middleware/logger.js'

export async function startSchedulers(
  taskRepo: ScheduledTaskRepository,
  executionRepo: TaskExecutionRepository,
  service: PriceCollectorService,
): Promise<void> {
  const recovered = await executionRepo.recoverStaleRuns()
  if (recovered > 0) {
    log('warn', `Recovered ${recovered} stale 'running' execution(s) from prior crash`)
  }

  const tasks = await taskRepo.findEnabled()
  for (const t of tasks) {
    schedule(t.cron_expression, () => {
      service.run().catch((err) =>
        log('error', `Scheduler '${t.name}' error: ${err}`),
      )
    })
    log('info', `Cron registered: '${t.name}' → ${t.cron_expression}`)
  }
}
