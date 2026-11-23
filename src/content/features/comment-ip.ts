import { logger } from '../../shared/logger'
import { isContextInvalidatedError, isExtensionContextValid } from '../../shared/runtime'
import type { Feature, Settings } from '../../shared/types'

const FLAG_KEY = 'biliBoost_ipEnabled'
const INJECT_MESSAGE = 'BILIBOOST_INJECT_IP_LOCATION'

function setFlag(enabled: boolean): void {
  localStorage.setItem(FLAG_KEY, enabled ? '1' : '0')
}

function requestMainWorldInjection(): void {
  if (!isExtensionContextValid()) return
  void chrome.runtime.sendMessage({ type: INJECT_MESSAGE }).catch((error: unknown) => {
    if (isContextInvalidatedError(error)) return
    logger.warn('main-world injection request failed', error)
  })
}

function handleSettingsChanged(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
): void {
  if (areaName !== 'sync' || !changes.settings) return
  const settings = changes.settings.newValue as Settings | undefined
  setFlag(settings?.features.commentIp ?? false)
  requestMainWorldInjection()
}

export const commentIpFeature: Feature = {
  id: 'commentIp',
  name: '评论区 IP属地显示',
  description: '在视频评论区显示发布者的 IP 属地信息',
  enabledByDefault: true,

  start(): void {
    setFlag(true)
    chrome.storage.onChanged.addListener(handleSettingsChanged)
    requestMainWorldInjection()
    logger.info('comment-ip: main-world injection requested')
  },

  stop(): void {
    setFlag(false)
    chrome.storage.onChanged.removeListener(handleSettingsChanged)
    requestMainWorldInjection()
    logger.info('comment-ip: disabled')
  },
}
