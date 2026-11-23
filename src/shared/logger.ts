import { LOG_PREFIX } from './constants'

export const logger = {
  info(...args: unknown[]): void {
    console.info(LOG_PREFIX, ...args)
  },
  warn(...args: unknown[]): void {
    console.warn(LOG_PREFIX, ...args)
  },
  error(...args: unknown[]): void {
    console.error(LOG_PREFIX, ...args)
  },
}
