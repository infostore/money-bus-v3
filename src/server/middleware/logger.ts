import type { MiddlewareHandler } from 'hono'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getLogLevel(): LogLevel {
  const level = process.env['LOG_LEVEL'] ?? 'info'
  return level in LEVEL_PRIORITY ? (level as LogLevel) : 'info'
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getLogLevel()]
}

export function log(level: LogLevel, message: string): void {
  if (!shouldLog(level)) return

  const timestamp = new Date().toISOString()
  process.stdout.write(`${timestamp} [${level.toUpperCase()}] ${message}\n`)
}

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  const status = c.res.status
  const method = c.req.method
  const path = c.req.path

  log('info', `${method} ${path} ${status} ${duration}ms`)
}
