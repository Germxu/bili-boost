import { logger } from '../shared/logger'
import { getSettings } from '../shared/storage'
import type { Feature, Settings } from '../shared/types'
import { initFrameCapture } from './features/frame-capture'
import { initImmersiveProgress } from './features/immersive-progress'
import { commentIpFeature, speedWheelFeature } from './features'

const features: Feature[] = [commentIpFeature, speedWheelFeature]

// 截图、沉浸式进度条无需开关，注册即生效
initFrameCapture()
initImmersiveProgress()

async function startFeature(feature: Feature): Promise<void> {
  try {
    await feature.start()
    logger.info(`feature started: ${feature.id}`)
  } catch (error) {
    logger.error(`feature failed: ${feature.id}`, error)
  }
}

async function bootstrap(): Promise<void> {
  const settings = await getSettings()
  for (const feature of features) {
    if (settings.features[feature.id]) await startFeature(feature)
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.settings) return
  const previous = changes.settings.oldValue as Settings | undefined
  const next = changes.settings.newValue as Settings | undefined
  if (!previous || !next) return

  for (const feature of features) {
    const wasEnabled = previous.features[feature.id]
    const isEnabled = next.features[feature.id]
    if (wasEnabled === isEnabled) continue
    if (isEnabled) void startFeature(feature)
    else feature.stop?.()
  }
})

void bootstrap()
