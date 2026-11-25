import type { ChannelItem, FeatureId, Settings } from './types'

export const FEATURE_META: Record<FeatureId, { name: string; description: string }> = {
  navCustomizer: {
    name: '自定义导航',
    description: '长按菜单进入编辑，可删除或添加菜单',
  },
}

/** B站 首页频道栏的全部频道，供添加面板选用 */
export const BILIBILI_CHANNELS: ChannelItem[] = [
  { name: '动态', href: '//t.bilibili.com' },
  { name: '热门', href: '//www.bilibili.com/v/popular/all' },
  { name: '番剧', href: '//www.bilibili.com/anime/' },
  { name: '电影', href: '//www.bilibili.com/movie/' },
  { name: '国创', href: '//www.bilibili.com/guochuang/' },
  { name: '电视剧', href: '//www.bilibili.com/tv/' },
  { name: '综艺', href: '//www.bilibili.com/variety/' },
  { name: '纪录片', href: '//www.bilibili.com/documentary/' },
  { name: '动画', href: '//www.bilibili.com/c/douga/' },
  { name: '游戏', href: '//www.bilibili.com/c/game/' },
  { name: '鬼畜', href: '//www.bilibili.com/c/kichiku/' },
  { name: '音乐', href: '//www.bilibili.com/c/music/' },
  { name: '舞蹈', href: '//www.bilibili.com/c/dance/' },
  { name: '影视', href: '//www.bilibili.com/c/cinephile/' },
  { name: '娱乐', href: '//www.bilibili.com/c/ent/' },
  { name: '知识', href: '//www.bilibili.com/c/knowledge/' },
  { name: '科技数码', href: '//www.bilibili.com/c/tech/' },
  { name: '资讯', href: '//www.bilibili.com/c/information/' },
  { name: '美食', href: '//www.bilibili.com/c/food/' },
  { name: '小剧场', href: '//www.bilibili.com/c/shortplay/' },
  { name: '汽车', href: '//www.bilibili.com/c/car' },
  { name: '时尚美妆', href: '//www.bilibili.com/c/fashion/' },
  { name: '体育运动', href: '//www.bilibili.com/c/sports/' },
  { name: '动物', href: '//www.bilibili.com/c/animal/' },
  { name: 'vlog', href: '//www.bilibili.com/c/vlog/' },
  { name: '绘画', href: '//www.bilibili.com/c/painting/' },
  { name: '人工智能', href: '//www.bilibili.com/c/ai/' },
  { name: '家装房产', href: '//www.bilibili.com/c/home/' },
  { name: '户外', href: '//www.bilibili.com/c/outdoors/' },
  { name: '健身', href: '//www.bilibili.com/c/gym/' },
  { name: '手工', href: '//www.bilibili.com/c/handmake/' },
  { name: '旅游出行', href: '//www.bilibili.com/c/travel/' },
  { name: '三农', href: '//www.bilibili.com/c/rural/' },
  { name: '亲子', href: '//www.bilibili.com/c/parenting/' },
  { name: '健康', href: '//www.bilibili.com/c/health/' },
  { name: '情感', href: '//www.bilibili.com/c/emotion/' },
  { name: '生活兴趣', href: '//www.bilibili.com/c/life_joy/' },
  { name: '生活经验', href: '//www.bilibili.com/c/life_experience/' },
]

export const MAX_NAV_CHANNELS = 10

/** 首页不可删除 */
export const HOME_HREF = '//www.bilibili.com'

export const SPEED_RANGE = { min: 0.25, max: 5 } as const

export const DEFAULT_SETTINGS: Settings = {
  features: {
    navCustomizer: false,
  },
  speedWheel: {
    remember: true,
  },
  navCustomizer: {
    hidden: [],
    channels: [],
  },
}

export const LOG_PREFIX = '[BiliBoost]'

export const CAPTURE_FRAME_MESSAGE = 'BILIBOOST_CAPTURE_FRAME'
