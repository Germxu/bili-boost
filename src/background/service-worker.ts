import { logger } from '../shared/logger'

const INJECT_MESSAGE = 'BILIBOOST_INJECT_MAIN_WORLD'
// MAIN world 脚本白名单：只接受这两个文件名，避免被滥用注入任意页面脚本
const ALLOWED_SCRIPTS = new Set([ 'ip-location.js', 'vue-ready.js' ])

chrome.runtime.onInstalled.addListener(() => {
  logger.info('extension installed')
})

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (typeof message !== 'object' || message === null) return
  const msg = message as { type?: string; file?: string }
  if (msg.type !== INJECT_MESSAGE || !msg.file || !ALLOWED_SCRIPTS.has(msg.file)) return

  const tabId = sender.tab?.id
  if (tabId === undefined) return

  void chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      injectImmediately: true,
      files: [ msg.file ],
    })
    .catch((error: unknown) => {
      logger.error('main-world injection failed', error)
    })
})

export {}
