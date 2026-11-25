import { logger } from '../../shared/logger'

const FLAG_KEY = 'biliBoost_ipEnabled'
const INJECT_MESSAGE = 'BILIBOOST_INJECT_IP_LOCATION'

function requestMainWorldInjection(): void {
  void chrome.runtime.sendMessage({ type: INJECT_MESSAGE }).catch((error: unknown) => {
    logger.warn('main-world injection request failed', error)
  })
}

/** IP 属地显示常驻启用，无开关：写标志并请求 MAIN world 注入 */
export function initCommentIp(): void {
  localStorage.setItem(FLAG_KEY, '1')
  requestMainWorldInjection()
  logger.info('comment-ip: main-world injection requested')
}
