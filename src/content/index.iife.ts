import { logger } from '../shared/logger'
import { getSettings } from '../shared/storage'
import type { Feature } from '../shared/types'
import { commentIpFeature } from './features'

const features: Feature[] = [commentIpFeature]

async function bootstrap(): Promise<void> {
  const settings = await getSettings()
  for (const feature of features) {
    if (!settings.features[feature.id]) continue
    try {
      await feature.start()
      logger.info(`feature started: ${feature.id}`)
    } catch (error) {
      logger.error(`feature failed: ${feature.id}`, error)
    }
  }
}

void bootstrap()
