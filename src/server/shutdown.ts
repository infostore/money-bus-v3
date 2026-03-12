import { log } from './middleware/logger.js'

type CleanupHandler = () => void | Promise<void>

const cleanupHandlers: CleanupHandler[] = []

export function registerCleanupHandler(handler: CleanupHandler): void {
  cleanupHandlers.push(handler)
}

export async function gracefulShutdown(signal: string): Promise<void> {
  log('info', `Received ${signal}, shutting down...`)

  for (const handler of cleanupHandlers) {
    try {
      await handler()
    } catch (error) {
      log('error', `Error during cleanup: ${error}`)
    }
  }

  log('info', 'Shutdown complete')
  process.exit(0)
}

export function setupShutdownHandlers(): void {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'))

  process.on('uncaughtException', (error) => {
    log('error', `Uncaught exception: ${error}`)
    gracefulShutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    log('error', `Unhandled rejection: ${reason}`)
    gracefulShutdown('unhandledRejection')
  })
}
