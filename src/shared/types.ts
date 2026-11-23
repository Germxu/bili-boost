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

export interface Settings {
  features: Record<FeatureId, boolean>
}
