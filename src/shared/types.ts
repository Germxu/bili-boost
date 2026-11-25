export type FeatureId = 'commentIp' | 'navCustomizer' | 'speedWheel'

export interface Feature {
  id: FeatureId
  name: string
  description: string
  enabledByDefault: boolean
  start(): void | Promise<void>
  stop?(): void
}

export interface SpeedWheelSettings {
  remember: boolean
}

export interface Settings {
  features: Record<FeatureId, boolean>
  speedWheel: SpeedWheelSettings
}
