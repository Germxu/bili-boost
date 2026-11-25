import { BILIBILI_CHANNELS, HOME_HREF, MAX_NAV_CHANNELS } from '../../shared/constants'
import { logger } from '../../shared/logger'
import { getSettings, setNavCustomizerSettings } from '../../shared/storage'
import type { ChannelItem, Feature, NavCustomizerSettings, Settings } from '../../shared/types'
import { PLAYER_READY_EVENT } from './immersive-progress'

const STYLE_ID = 'bili-boost-nav-editor-style'
const PANEL_ID = 'bili-boost-channel-panel'
const ITEM_CLASS = 'bb-nav-item'
const CUSTOM_CLASS = 'bb-nav-custom'
const DEL_CLASS = 'bb-nav-del'
const ADD_CLASS = 'bb-nav-add'
const EDITING_CLASS = 'bb-nav-editing'
const LONG_PRESS_MS = 500

const ITEM_SELECTOR = ':is(li, .left-entry__item)'
// 原生导航项：注入的频道带 bb-nav-custom，要从原生集合里排除，避免重复挂删除号
const NATIVE_ITEM_SELECTOR = ':is(li, .left-entry__item):not(.bb-nav-custom)'
const NAV_SELECTOR = '.bili-header__bar .left-entry'

let config: NavCustomizerSettings = { hidden: [], channels: [] }
let active = false
let domReady = false
let editing = false
let styleEl: HTMLStyleElement | null = null
let panel: HTMLElement | null = null
let pollTimer: number | undefined
let lastNavSig = ''
let navStableSince = 0
let longPressTimer: number | undefined
let longPressPoint = { x: 0, y: 0 }
let storageListener:
  | ((changes: { [ key: string ]: chrome.storage.StorageChange }, areaName: string) => void)
  | null = null
let loadListener: (() => void) | null = null
let playerReadyListener: (() => void) | null = null
let fallbackTimer: number | undefined
// 每个 host 缓存一份从原生项克隆的干净模板，避免硬编码 B站 的 Vue scope hash
const itemTemplates = new WeakMap<HTMLElement, HTMLElement>()

/** 归一化 href 用于比较：去掉协议和结尾斜杠 */
function keyOf(href: string): string {
  return href.replace(/^https?:/, '').replace(/\/+$/, '').toLowerCase()
}

const HOME_KEY = keyOf(HOME_HREF)

/** B站 KV_CONFIG_SDK 中单个频道配置 */
interface ChannelConfigEntry {
  name?: string
  url?: string
  channelId?: number
  tid?: number
}

/**
 * 从 B站 自身配置缓存 KV_CONFIG_SDK 读取频道列表。
 * 结构：localStorage['KV_CONFIG_SDK'] = {
 *   '<appKey>_<n>': { value: {
 *     'channel_list.anime': '{"name":"动画","channelId":2,"tid":23,"url":"//www.bilibili.com/anime/"}',
 *     'channel_list.channel_page_sort': '["douga","game",...]',
 *     ...
 *   } }
 * }
 * 读不到（该域名无此 key / 结构变化）返回 null，调用方回退到内置列表。
 */
function readChannelsFromConfig(): ChannelItem[] | null {
  try {
    const raw = localStorage.getItem('KV_CONFIG_SDK')
    if (!raw) return null

    const sdk = JSON.parse(raw) as Record<string, { value?: Record<string, string> }>
    let value: Record<string, string> | undefined
    for (const entry of Object.values(sdk)) {
      if (entry?.value && Object.keys(entry.value).some((k) => k.startsWith('channel_list.'))) {
        value = entry.value
        break
      }
    }
    if (!value) return null

    let order: string[] = []
    try {
      const sortRaw = value[ 'channel_list.channel_page_sort' ]
      if (sortRaw) order = JSON.parse(sortRaw) as string[]
    } catch {
      // 排序表异常不影响列表本身
    }

    const found: { id: string; item: ChannelItem }[] = []
    for (const [ key, json ] of Object.entries(value)) {
      if (!key.startsWith('channel_list.')) continue
      const id = key.slice('channel_list.'.length)
      if (!id || id === 'all' || id === 'channel_page_sort') continue
      try {
        const data = JSON.parse(json) as ChannelConfigEntry
        if (data.name && data.url) found.push({ id, item: { name: data.name, href: data.url } })
      } catch {
        // 单条解析失败则跳过
      }
    }
    if (!found.length) return null

    found.sort((a, b) => {
      const ia = order.indexOf(a.id)
      const ib = order.indexOf(b.id)
      return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib)
    })
    return found.map((e) => e.item)
  } catch {
    return null
  }
}

function itemAnchor(item: HTMLElement): HTMLAnchorElement | null {
  return item.querySelector('a[href]')
}

function isHome(item: HTMLElement): boolean {
  const a = itemAnchor(item)
  return !!a && keyOf(a.getAttribute('href') ?? '') === HOME_KEY
}

function itemKey(item: HTMLElement): string | null {
  const a = itemAnchor(item)
  return a ? keyOf(a.getAttribute('href') ?? '') : null
}

const CSS = `
.${EDITING_CLASS} ${ITEM_SELECTOR} {
  position: relative;
  cursor: pointer;
}
.${DEL_CLASS} {
  position: absolute;
  top: 2px;
  right: -6px;
  z-index: 9999;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #f25d8e;
  line-height: 15px;
  text-align: center;
  cursor: pointer;
  user-select: none;
}
.${DEL_CLASS}:hover { background: #e14a7d; }
.${ADD_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0 4px;
  border: 1px dashed #fb7299;
  border-radius: 6px;
  color: #fb7299;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.${ADD_CLASS}:hover { background: #fff1f5; }
#${PANEL_ID} {
  position: fixed;
  z-index: 10000;
  width: 320px;
  max-height: 420px;
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 24px rgba(0,0,0,.18);
  color: #18191c;
  font-size: 13px;
}
.bb-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e3e5e7;
  font-weight: 500;
}
.bb-panel-close { color: #9499a0; cursor: pointer; font-weight: 400; }
.bb-panel-close:hover { color: #18191c; }
.bb-panel-list { max-height: 350px; overflow-y: auto; padding: 6px; }
.bb-panel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.bb-panel-item:hover { background: #f6f7f8; }
.bb-panel-item.bb-added { color: #9499a0; cursor: default; }
.bb-panel-item.bb-added:hover { background: transparent; }
.bb-panel-tag { font-size: 11px; color: #fb7299; }
.bb-panel-full { padding: 16px 12px; text-align: center; color: #9499a0; }
`

function ensureStyle(): void {
  if (styleEl?.isConnected) return
  styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!styleEl) {
    const head = document.head ?? document.documentElement
    if (!head) return
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ID
    styleEl.textContent = CSS
    head.appendChild(styleEl)
  }
}

function removeStyle(): void {
  styleEl?.remove()
  styleEl = null
}

function shouldHide(item: HTMLElement): boolean {
  const key = itemKey(item)
  if (!key || key === HOME_KEY) return false
  return config.hidden.some((h) => key === h || key.startsWith(`${h}/`))
}

/** 当前唯一可见的导航容器（大 header 与 mini header 可能同时存在于 DOM） */
function activeNav(): HTMLElement | undefined {
  const navs = findNavs()
  return navs.find((nav) => nav.getClientRects().length > 0) ?? navs[ 0 ]
}

/** 导航最终显示的项数：未删除的原生项 + 已添加的频道，上限按这个总数算 */
function visibleNavCount(): number {
  const nav = activeNav()
  if (!nav) return 0
  const host = nav.querySelector<HTMLElement>('.left-entry-main') ?? nav
  const native = Array.from(host.querySelectorAll<HTMLElement>(NATIVE_ITEM_SELECTOR))
    .filter((item) => !shouldHide(item)).length
  return native + host.querySelectorAll<HTMLElement>(`.${CUSTOM_CLASS}`).length
}

function save(): void {
  void setNavCustomizerSettings({
    hidden: [ ...config.hidden ],
    channels: config.channels.map((c) => ({ ...c })),
  })
}

/**
 * 从原生导航项克隆一份「干净模板」，保留 B站 Vue 的 scope 属性、
 * v-popover-wrap / left-entry__item-trigger / trigger-text 结构和类名。
 * 这样注入的频道项和原生菜单样式完全一致，且 B站 换 scope hash 也能自动跟上。
 */
function getItemTemplate(host: HTMLElement): HTMLElement | null {
  const cached = itemTemplates.get(host)
  if (cached) return cached

  const candidates = Array.from(host.querySelectorAll<HTMLElement>(NATIVE_ITEM_SELECTOR))
  const src = candidates.find((item) => {
    if (isHome(item)) return false
    const a = itemAnchor(item)
    return !!a && !!a.querySelector('.trigger-text')
  }) ?? candidates.find((item) => !isHome(item) && !!itemAnchor(item))
  if (!src) return null

  const tpl = src.cloneNode(true) as HTMLElement
  const a = itemAnchor(tpl)
  if (a) {
    // 只保留文字节点，丢掉原生项可能带的下拉弹层 / 图标
    const text = a.querySelector<HTMLElement>('.trigger-text')
    Array.from(a.children).forEach((child) => {
      if (child !== text) child.remove()
    })
  }
  Array.from(tpl.children).forEach((child) => {
    if (child !== a) child.remove()
  })
  tpl.classList.remove(EDITING_CLASS, ITEM_CLASS)
  delete tpl.dataset.bbSig
  tpl.style.display = ''
  itemTemplates.set(host, tpl)
  return tpl
}

function makeCustomItem(channel: ChannelItem, host: HTMLElement): HTMLElement {
  const tpl = getItemTemplate(host)
  const item = tpl
    ? (tpl.cloneNode(true) as HTMLElement)
    : (() => {
      // 极端兜底：页面上找不到原生项时，按已知结构手工搭一个
      const el = document.createElement('div')
      el.className = 'v-popover-wrap left-entry__item'
      const a = document.createElement('a')
      a.className = 'left-entry__item-trigger'
      a.target = '_blank'
      const span = document.createElement('span')
      span.className = 'trigger-text'
      a.appendChild(span)
      el.appendChild(a)
      return el
    })()
  item.classList.add(ITEM_CLASS, CUSTOM_CLASS)
  item.style.display = ''
  const a = itemAnchor(item)
  if (a) {
    a.setAttribute('href', channel.href)
    a.setAttribute('target', '_blank')
    const text = a.querySelector<HTMLElement>('.trigger-text') ?? a
    text.textContent = channel.name
  }
  return item
}

function findNavs(): HTMLElement[] {
  const navs: HTMLElement[] = []
  const walk = (root: ParentNode): void => {
    root.querySelectorAll<HTMLElement>(NAV_SELECTOR).forEach((n) => navs.push(n))
    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot)
    })
  }
  walk(document)
  return navs
}

function renderNav(nav: HTMLElement): void {
  if (!nav.isConnected) return
  bindNav(nav)

  const host = nav.querySelector<HTMLElement>('.left-entry-main') ?? nav
  // 幂等：只有状态真正变化时才重建我们注入的节点，避免反复增删 DOM
  // 干扰 B站 header 的 Vue 组件。
  const hostSig = `${editing ? 1 : 0}|${config.hidden.join(',')}|${config.channels.map((c) => keyOf(c.href)).join(',')}`
  if (host.dataset.bbSig === hostSig) return
  host.dataset.bbSig = hostSig

  host.querySelectorAll<HTMLElement>(`.${CUSTOM_CLASS}, .${DEL_CLASS}, .${ADD_CLASS}`)
    .forEach((el) => el.remove())

  const items = Array.from(host.querySelectorAll<HTMLElement>(NATIVE_ITEM_SELECTOR))
  for (const item of items) {
    item.classList.toggle(EDITING_CLASS, editing)
    // 编辑态也隐藏已删除项，点删除号后立即生效，不用等退出编辑
    item.style.display = shouldHide(item) ? 'none' : ''
    if (editing && !isHome(item)) {
      const del = document.createElement('span')
      del.className = DEL_CLASS
      del.textContent = '×'
      del.title = '删除该导航项'
      item.appendChild(del)
    }
  }

  for (const channel of config.channels) {
    const item = makeCustomItem(channel, host)
    item.classList.toggle(EDITING_CLASS, editing)
    if (editing) {
      const del = document.createElement('span')
      del.className = DEL_CLASS
      del.textContent = '×'
      del.title = '删除该频道'
      item.appendChild(del)
    }
    host.appendChild(item)
  }

  if (editing) {
    const add = document.createElement('span')
    add.className = ADD_CLASS
    add.textContent = '+'
    add.title = '添加频道'
    host.appendChild(add)
  }

  nav.classList.toggle(EDITING_CLASS, editing)
}

function renderAll(): void {
  for (const nav of findNavs()) renderNav(nav)
}

/**
 * 导航结构签名：只统计原生导航项的 href。B站 SPA 切页会重建 header，
 * 签名变化说明结构被替换，需要重新注入；连续稳定后才渲染，避开 Vue mount。
 */
function navSignature(): string {
  const navs = findNavs()
  if (!navs.length) return ''
  // 聚合所有 nav（大 header 与 mini header 可能并存），任一被重建都能检出
  return navs.map((nav) => {
    const host = nav.querySelector<HTMLElement>('.left-entry-main') ?? nav
    return Array.from(host.querySelectorAll<HTMLElement>(NATIVE_ITEM_SELECTOR))
      .map((item) => keyOf(itemAnchor(item)?.getAttribute('href') ?? ''))
      .join('|')
  }).join('||')
}

/** 低频轮询替代 MutationObserver：不在 DOM 变动的瞬间介入，避免撞上 Vue patch */
function poll(): void {
  if (!active || !domReady) return
  const sig = navSignature()
  if (!sig) {
    lastNavSig = ''
    return
  }
  if (sig !== lastNavSig) {
    lastNavSig = sig
    navStableSince = Date.now()
    return
  }
  // 结构稳定一段时间后再渲染，给 B站 Vue mount 留出完成时间
  if (Date.now() - navStableSince < 800) return
  renderAll()
}

function bindNav(nav: HTMLElement): void {
  if (nav.dataset.bbBound === '1') return
  nav.dataset.bbBound = '1'

  nav.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement
    if (target.closest(`.${DEL_CLASS}, .${ADD_CLASS}`)) return
    const item = target.closest<HTMLElement>(ITEM_SELECTOR)
    if (!item || !nav.contains(item)) return
    longPressPoint = { x: e.clientX, y: e.clientY }
    window.clearTimeout(longPressTimer)
    longPressTimer = window.setTimeout(() => {
      longPressTimer = undefined
      if (editing && isHome(item)) exitEditMode()
      else enterEditMode()
    }, LONG_PRESS_MS)
  })

  const cancelLongPress = (): void => {
    window.clearTimeout(longPressTimer)
    longPressTimer = undefined
  }
  nav.addEventListener('pointerup', cancelLongPress)
  nav.addEventListener('pointercancel', cancelLongPress)
  nav.addEventListener('pointerleave', cancelLongPress)
  nav.addEventListener('pointermove', (e) => {
    if (longPressTimer === undefined) return
    if (Math.abs(e.clientX - longPressPoint.x) > 8 || Math.abs(e.clientY - longPressPoint.y) > 8) {
      cancelLongPress()
    }
  })

  nav.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const del = target.closest<HTMLElement>(`.${DEL_CLASS}`)
    if (del) {
      e.preventDefault()
      e.stopPropagation()
      const item = del.closest<HTMLElement>(ITEM_SELECTOR)
      if (item) removeItem(item)
      return
    }
    if (target.closest(`.${ADD_CLASS}`)) {
      e.preventDefault()
      e.stopPropagation()
      openPanel()
      return
    }
    if (editing) {
      const item = target.closest<HTMLElement>(ITEM_SELECTOR)
      if (item) {
        e.preventDefault()
        e.stopPropagation()
        if (isHome(item)) exitEditMode()
      }
    }
  })
}

function removeItem(item: HTMLElement): void {
  if (isHome(item)) return
  if (item.classList.contains(CUSTOM_CLASS)) {
    const a = itemAnchor(item)
    const key = a ? keyOf(a.getAttribute('href') ?? '') : ''
    config.channels = config.channels.filter((c) => keyOf(c.href) !== key)
  } else {
    const key = itemKey(item)
    if (key && !config.hidden.includes(key)) config.hidden.push(key)
  }
  save()
  renderAll()
  if (panel) renderPanelList()
}

function onDocClickCapture(e: MouseEvent): void {
  if (!editing) return
  const target = e.target as HTMLElement
  if (target.closest(`${NAV_SELECTOR}, #${PANEL_ID}`)) return
  e.preventDefault()
  e.stopPropagation()
  exitEditMode()
}

function enterEditMode(): void {
  if (editing) return
  editing = true
  ensureStyle()
  document.addEventListener('click', onDocClickCapture, true)
  renderAll()
  logger.info('nav-customizer: edit mode on')
}

function exitEditMode(): void {
  if (!editing) return
  editing = false
  document.removeEventListener('click', onDocClickCapture, true)
  closePanel()
  renderAll()
  logger.info('nav-customizer: edit mode off')
}

function panelElement(): HTMLElement {
  if (panel?.isConnected) return panel
  panel = document.getElementById(PANEL_ID) as HTMLElement | null
  if (!panel) {
    panel = document.createElement('div')
    panel.id = PANEL_ID
    const head = document.createElement('div')
    head.className = 'bb-panel-head'
    const title = document.createElement('span')
    title.textContent = '添加频道'
    const close = document.createElement('span')
    close.className = 'bb-panel-close'
    close.textContent = '关闭'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      closePanel()
    })
    head.append(title, close)
    const list = document.createElement('div')
    list.className = 'bb-panel-list'
    panel.append(head, list)
    document.body.appendChild(panel)
  }
  return panel
}

function renderPanelList(): void {
  const p = panelElement()
  const list = p.querySelector<HTMLElement>('.bb-panel-list')!
  const head = p.querySelector<HTMLElement>('.bb-panel-head span')!
  const count = visibleNavCount()
  head.textContent = `添加频道（${count}/${MAX_NAV_CHANNELS}）`
  list.replaceChildren()

  if (count >= MAX_NAV_CHANNELS) {
    const full = document.createElement('div')
    full.className = 'bb-panel-full'
    full.textContent = `导航最多显示 ${MAX_NAV_CHANNELS} 项（含原生菜单），请先删除一些`
    list.appendChild(full)
    return
  }

  // 优先用 B站 自身配置缓存里的频道（带官方排序），读不到则回退内置列表
  const fromConfig = readChannelsFromConfig()
  const channels = fromConfig ?? BILIBILI_CHANNELS
  logger.info(`nav-customizer: channels from ${fromConfig ? `KV_CONFIG_SDK (${fromConfig.length})` : 'builtin list'}`)
  for (const channel of channels) {
    const added = config.channels.some((c) => keyOf(c.href) === keyOf(channel.href))
    const row = document.createElement('div')
    row.className = `bb-panel-item${added ? ' bb-added' : ''}`
    const name = document.createElement('span')
    name.textContent = channel.name
    row.appendChild(name)
    if (added) {
      const tag = document.createElement('span')
      tag.className = 'bb-panel-tag'
      tag.textContent = '已添加'
      row.appendChild(tag)
    } else {
      row.addEventListener('click', (e) => {
        e.stopPropagation()
        // 面板停留期间数量可能已变（如其它设备同步），再校验一次总数
        if (visibleNavCount() >= MAX_NAV_CHANNELS) {
          renderPanelList()
          return
        }
        config.channels.push({ ...channel })
        save()
        renderAll()
        renderPanelList()
      })
    }
    list.appendChild(row)
  }
}

function openPanel(): void {
  const p = panelElement()
  renderPanelList()
  const rect = p.getBoundingClientRect()
  p.style.top = `${Math.max(12, Math.min(80, window.innerHeight - rect.height - 20))}px`
  p.style.left = `${Math.max(12, window.innerWidth / 2 - 160)}px`
}

function closePanel(): void {
  panel?.remove()
  panel = null
}

/**
 * 等页面真正稳定后再介入 header：优先由沉浸式进度条注入完成事件触发
 * （说明视频已就绪、B站 header 的 Vue mount 早已结束）；
 * 非视频页没有进度条，则用 load 后的兜底延时。
 */
function activateDom(): void {
  if (!active || domReady) return
  domReady = true
  window.clearTimeout(fallbackTimer)
  fallbackTimer = undefined
  ensureStyle()
  for (const nav of findNavs()) bindNav(nav)
  // 低频轮询检测导航重建，不在 DOM 变动瞬间插手（避开 Vue patch）
  pollTimer = window.setInterval(poll, 1000)
  logger.info('nav-customizer: dom ready')
}

function cleanupDom(): void {
  closePanel()
  for (const nav of findNavs()) {
    nav.classList.remove(EDITING_CLASS)
    delete nav.dataset.bbBound
    const host = nav.querySelector<HTMLElement>('.left-entry-main') ?? nav
    delete host.dataset.bbSig
    host.querySelectorAll<HTMLElement>(`.${CUSTOM_CLASS}, .${DEL_CLASS}, .${ADD_CLASS}`)
      .forEach((el) => el.remove())
    host.querySelectorAll<HTMLElement>(ITEM_SELECTOR).forEach((item) => {
      item.style.display = ''
    })
  }
  removeStyle()
}

export const navCustomizerFeature: Feature = {
  id: 'navCustomizer',
  name: '顶部导航自定义',
  description: '长按菜单进入编辑，可删除或添加菜单（总数最多 10 项）',
  enabledByDefault: false,

  async start(): Promise<void> {
    active = true
    const settings = await getSettings()
    config = {
      hidden: [ ...settings.navCustomizer.hidden ],
      channels: settings.navCustomizer.channels.map((c) => ({ ...c })),
    }

    // 进度条插入完成 = 视频已就绪、B站 header 早已 mount 完，此时再动导航最安全。
    playerReadyListener = () => activateDom()
    document.addEventListener(PLAYER_READY_EVENT, playerReadyListener)
    // 非视频页（没有进度条）的兜底：load 后再等 5 秒，确保 header 挂载稳定
    const scheduleFallback = (): void => {
      loadListener = null
      fallbackTimer = window.setTimeout(activateDom, 5000)
    }
    if (document.readyState === 'complete') scheduleFallback()
    else {
      loadListener = scheduleFallback
      window.addEventListener('load', loadListener, { once: true })
    }

    storageListener = (changes, areaName) => {
      if (!active || areaName !== 'sync' || !changes.settings) return
      const next = changes.settings.newValue as Settings | undefined
      if (!next) return
      config = {
        hidden: [ ...next.navCustomizer.hidden ],
        channels: next.navCustomizer.channels.map((c) => ({ ...c })),
      }
      if (domReady) renderAll()
    }
    chrome.storage.onChanged.addListener(storageListener)
    logger.info('nav-customizer: started')
  },

  stop(): void {
    active = false
    editing = false
    domReady = false
    window.clearTimeout(longPressTimer)
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
    lastNavSig = ''
    window.clearTimeout(fallbackTimer)
    fallbackTimer = undefined
    if (loadListener) {
      window.removeEventListener('load', loadListener)
      loadListener = null
    }
    if (playerReadyListener) {
      document.removeEventListener(PLAYER_READY_EVENT, playerReadyListener)
      playerReadyListener = null
    }
    document.removeEventListener('click', onDocClickCapture, true)
    if (storageListener) {
      chrome.storage.onChanged.removeListener(storageListener)
      storageListener = null
    }
    // 关闭开关 = 重置：内存与 sync 都清空，下次开启时导航恢复默认
    config = { hidden: [], channels: [] }
    void setNavCustomizerSettings({ hidden: [], channels: [] })
    cleanupDom()
    logger.info('nav-customizer: stopped and reset')
  },
}
