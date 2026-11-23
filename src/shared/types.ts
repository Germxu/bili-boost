export type FeatureId =
  | 'commentIp'
  | 'navCustomizer'
  | 'speedWheel'
  | 'frameCapture'
  | 'immersiveProgress'

export interface Feature {
  id: FeatureId
  name: string
  description: string
  enabledByDefault: boolean
  start(): void | Promise<void>
  stop?(): void
}

export type SpeedStep = 0.05 | 0.1 | 0.2

export interface SpeedWheelSettings {
  step: SpeedStep
  remember: boolean
}

export interface Settings {
  features: Record<FeatureId, boolean>
  speedWheel: SpeedWheelSettings
}
