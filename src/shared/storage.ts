import { DEFAULT_SETTINGS } from './constants'
import type { FeatureId, Settings } from './types'

const KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY)
  const value = stored[KEY] as Partial<Settings> | undefined
  return {
    features: { ...DEFAULT_SETTINGS.features, ...value?.features },
  }
}

export async function setFeatureEnabled(id: FeatureId, enabled: boolean): Promise<void> {
  const settings = await getSettings()
  settings.features[id] = enabled
  await chrome.storage.sync.set({ [KEY]: settings })
}
