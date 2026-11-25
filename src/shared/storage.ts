import { DEFAULT_SETTINGS } from './constants'
import type { FeatureId, NavCustomizerSettings, Settings, SpeedWheelSettings } from './types'

const KEY = 'settings'

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY)
  const value = stored[KEY] as Partial<Settings> | undefined
  return {
    features: { ...DEFAULT_SETTINGS.features, ...value?.features },
    speedWheel: { ...DEFAULT_SETTINGS.speedWheel, ...value?.speedWheel },
    navCustomizer: { ...DEFAULT_SETTINGS.navCustomizer, ...value?.navCustomizer },
  }
}

export async function setFeatureEnabled(id: FeatureId, enabled: boolean): Promise<void> {
  const settings = await getSettings()
  settings.features[id] = enabled
  await chrome.storage.sync.set({ [KEY]: settings })
}

export async function setSpeedWheelSettings(patch: Partial<SpeedWheelSettings>): Promise<void> {
  const settings = await getSettings()
  settings.speedWheel = { ...settings.speedWheel, ...patch }
  await chrome.storage.sync.set({ [KEY]: settings })
}

export async function setNavCustomizerSettings(patch: Partial<NavCustomizerSettings>): Promise<void> {
  const settings = await getSettings()
  settings.navCustomizer = { ...settings.navCustomizer, ...patch }
  await chrome.storage.sync.set({ [KEY]: settings })
}
