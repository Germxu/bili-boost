import type { FeatureId, Settings } from './types'

export const FEATURE_META: Record<FeatureId, { name: string; description: string }> = {
  commentIp: {
    name: '评论区 IP属地显示',
    description: '在视频评论区显示发布者的 IP 属地信息',
  },
  navCustomizer: {
    name: '顶部导航自定义',
    description: '自定义 B站 顶部左侧导航项',
  },
  speedWheel: {
    name: '滚轮倍速播放',
    description: '悬停倍速按钮滚轮调速（0.25x–5x），右键恢复 1x',
  },
  frameCapture: {
    name: '视频帧读取',
    description: '读取当前视频帧并保存为图片',
  },
  immersiveProgress: {
    name: '沉浸式进度条',
    description: '全屏播放时显示当前播放进度',
  },
}

export const SPEED_RANGE = { min: 0.25, max: 5 } as const

export const DEFAULT_SETTINGS: Settings = {
  features: {
    commentIp: true,
    navCustomizer: false,
    speedWheel: false,
    frameCapture: false,
    immersiveProgress: false,
  },
  speedWheel: {
    remember: true,
  },
}

export const LOG_PREFIX = '[BiliBoost]'
