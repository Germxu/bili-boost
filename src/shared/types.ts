export type FeatureId = 'navCustomizer'

export interface ChannelItem {
  name: string
  href: string
}

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

export interface NavCustomizerSettings {
  /** 被删除的原生导航项 href（前缀匹配） */
  hidden: string[]
  /** 用户自定义添加的导航频道（与原生菜单合计最多 10 项） */
  channels: ChannelItem[]
}

export interface Settings {
  features: Record<FeatureId, boolean>
  speedWheel: SpeedWheelSettings
  navCustomizer: NavCustomizerSettings
}
