import { logger } from '../shared/logger'

const INJECT_MESSAGE = 'BILIBOOST_INJECT_IP_LOCATION'
const MAIN_WORLD_SCRIPT = 'ip-location.js'

chrome.runtime.onInstalled.addListener(() => {
  logger.info('extension installed')
})

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (typeof message !== 'object' || message === null) return
  if ((message as { type?: string }).type !== INJECT_MESSAGE) return

  const tabId = sender.tab?.id
  if (tabId === undefined) return

  void chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      injectImmediately: true,
      files: [MAIN_WORLD_SCRIPT],
    })
    .catch((error: unknown) => {
      logger.error('main-world injection failed', error)
    })
})

export {}
