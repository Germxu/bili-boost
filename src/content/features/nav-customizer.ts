import { BILIBILI_CHANNELS, HOME_HREF, MAX_NAV_CHANNELS } from '../../shared/constants'
import { logger } from '../../shared/logger'
import { getSettings, setNavCustomizerSettings } from '../../shared/storage'
import type { ChannelItem, Feature, NavCustomizerSettings, Settings } from '../../shared/types'

const STYLE_ID = 'bili-boost-nav-editor-style'
const PANEL_ID = 'bili-boost-channel-panel'
const ITEM_CLASS = 'bb-nav-item'
const CUSTOM_CLASS = 'bb-nav-custom'
const DEL_CLASS = 'bb-nav-del'
const ADD_CLASS = 'bb-nav-add'
const EDITING_CLASS = 'bb-nav-editing'
const LONG_PRESS_MS = 500
// header 是异步 Vue 组件：mount 期间改 DOM 会让它读到失效引用而崩溃。
// 正常路径由 MAIN world 的 vue-ready 脚本给出 mount 完成信号，签名稳定窗口可以短；
// 信号失效时退化到长窗口兜底。
const STABLE_WINDOW_MS = 300
const FALLBACK_STABLE_WINDOW_MS = 1500
// 10s 内没收到 Vue ready 信号就进入兜底模式，避免检测失效导致功能完全不可用
const VUE_READY_TIMEOUT_MS = 10000
const READY_ATTR = 'data-bb-header-vue-ready'
const READY_EVENT = 'bili-boost:header-vue-ready'
const INJECT_MESSAGE = 'BILIBOOST_INJECT_MAIN_WORLD'
const VUE_READY_SCRIPT = 'vue-ready.js'

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
let panelQuery = ''
let pollTimer: number | undefined
let lastNavSig = ''
let navStableSince = 0
let longPressTimer: number | undefined
let longPressPoint = { x: 0, y: 0 }
let storageListener:
  | ((changes: { [ key: string ]: chrome.storage.StorageChange }, areaName: string) => void)
  | null = null
let vueReadyListener: (() => void) | null = null
let vueReadyTimeout: number | undefined
let fallbackMode = false
// 统一持有导航上的事件监听器，关闭开关时真正移除，避免残留监听重新进入编辑态
let navAbort: AbortController | null = null
// 每个 host 缓存一份从原生项克隆的干净模板，避免硬编码 B站 的 Vue scope hash
const itemTemplates = new WeakMap<HTMLElement, HTMLElement>()

/** 归一化 href 用于比较：去掉协议和结尾斜杠 */
function keyOf(href: string): string {
  return href.replace(/^https?:/, '').replace(/\/+$/, '').toLowerCase()
}

const HOME_KEY = keyOf(HOME_HREF)

/** 递归收集 root 及其所有 shadowRoot 内匹配 selector 的元素 */
function deepQueryAll(root: ParentNode, selector: string): Element[] {
  const found: Element[] = []
  const visit = (scope: ParentNode): void => {
    // 节点自身的 shadowRoot 也要进去（频道面板内容通常就在这里）
    if (scope instanceof Element) {
      const ownShadow = (scope as HTMLElement).shadowRoot
      if (ownShadow) visit(ownShadow)
    }
    const matches = scope.querySelectorAll(selector)
    for (let i = 0; i < matches.length; i += 1) found.push(matches[ i ])
    const nodes = scope.querySelectorAll('*')
    for (let i = 0; i < nodes.length; i += 1) {
      const shadow = (nodes[ i ] as HTMLElement).shadowRoot
      if (shadow) visit(shadow)
    }
  }
  visit(root)
  return found
}

function absoluteUrl(url: string): string {
  return url.startsWith('//') ? `${location.protocol}${url}` : url
}

/** 频道名：优先专用类名 / title，最后退到去掉图标后的纯文本 */
function channelName(anchor: Element): string {
  const named = anchor.querySelector('.channel-panel__item-name, .channel-panel__item-text, .name')
  if (named?.textContent?.trim()) return named.textContent!.trim()
  const title = anchor.getAttribute('title') || anchor.getAttribute('aria-label')
  if (title?.trim()) return title.trim()
  const clone = anchor.cloneNode(true) as Element
  const noise = clone.querySelectorAll('svg, img')
  for (let i = 0; i < noise.length; i += 1) noise[ i ].remove()
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** 频道图标：img src / 背景图 url / 内联 svg 依次尝试 */
function channelIcon(anchor: Element): string | undefined {
  const img = anchor.querySelector('img[src], img[data-src], img[srcset]')
  const imgSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || img?.getAttribute('srcset')?.split(' ')[ 0 ]
  if (imgSrc) return absoluteUrl(imgSrc)

  const nodes = [ anchor, ...Array.from(anchor.querySelectorAll('*')) ]
  for (const el of nodes) {
    const bg = (el as HTMLElement).style?.backgroundImage
    const match = bg?.match(/url\(["']?([^"')]+)["']?\)/)
    if (match?.[ 1 ]) return absoluteUrl(match[ 1 ])
  }

  const svg = anchor.querySelector('svg')
  if (svg) {
    try {
      const clone = svg.cloneNode(true) as SVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const text = new XMLSerializer().serializeToString(clone)
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * 从 B站 header 的 <bili-header-channel-panel> 读取所有可用频道（含图标）。
 * 面板可能位于 light DOM 或任意 shadowRoot 中，故递归遍历所有 root。
 * 返回 [] 表示当前页面没有该面板，调用方回退到内置列表。
 */
function readChannelsFromDom(): ChannelItem[] {
  const panels = deepQueryAll(document, 'bili-header-channel-panel, .bili-header-channel-panel')
  if (!panels.length) return []
  const anchors = deepQueryAll(panels[ 0 ], 'a[href]')
  const seen = new Set<string>()
  const channels: ChannelItem[] = []
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') ?? ''
    if (!/^(https?:)?\/\//i.test(href)) continue
    const key = keyOf(href)
    if (!key || key === HOME_KEY || seen.has(key)) continue
    const name = channelName(anchor)
    if (!name) continue
    seen.add(key)
    channels.push({ name, href, icon: channelIcon(anchor) })
  }
  return channels
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
  display: flex;
  flex-direction: column;
  width: 440px;
  max-height: min(560px, calc(100vh - 40px));
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(0,0,0,.2), 0 2px 8px rgba(0,0,0,.08);
  color: #18191c;
  font-size: 14px;
  animation: bb-panel-in .18s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  #${PANEL_ID} { animation: none; }
}
@keyframes bb-panel-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to { opacity: 1; transform: none; }
}
.bb-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 14px;
}
.bb-panel-title { font-size: 17px; font-weight: 600; }
.bb-panel-subtitle { margin-top: 5px; font-size: 12px; color: #9499a0; }
.bb-panel-count {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 10px;
  background: #fff1f5;
  color: #fb7299;
  font-size: 12px;
  font-weight: 500;
  vertical-align: 1px;
}
.bb-panel-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f6f7f8;
  color: #9499a0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}
.bb-panel-close:hover { background: #e3e5e7; color: #18191c; }
.bb-panel-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 22px 14px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #f6f7f8;
}
.bb-panel-search svg { flex: none; }
.bb-panel-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #18191c;
  font-size: 13px;
}
.bb-panel-search input::placeholder { color: #b4b2a9; }
.bb-panel-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 8px; }
.bb-panel-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
}
.bb-panel-item:hover { background: #f6f7f8; }
.bb-panel-item.bb-added { cursor: default; }
.bb-panel-item.bb-added:hover { background: transparent; }
.bb-panel-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f6f7f8;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  overflow: hidden;
}
.bb-panel-avatar img { width: 100%; height: 100%; object-fit: cover; }
.bb-panel-name { flex: 1; font-size: 14px; }
.bb-panel-item.bb-added .bb-panel-name { color: #9499a0; }
.bb-panel-plus {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 1px solid #fb7299;
  border-radius: 50%;
  color: #fb7299;
  font-size: 16px;
  line-height: 1;
}
.bb-panel-item:hover .bb-panel-plus { background: #fb7299; color: #fff; }
.bb-panel-item.bb-added .bb-panel-plus { border-color: #e3e5e7; color: #b4b2a9; background: transparent; }
.bb-panel-empty { padding: 48px 12px; text-align: center; color: #9499a0; }
.bb-panel-footer {
  padding: 12px 22px;
  border-top: 1px solid #e3e5e7;
  color: #9499a0;
  font-size: 12px;
}
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

/** MAIN world 的 Vue ready 信号：mount 完成前绝不碰 header DOM */
function headerVueReady(): boolean {
  // 兜底模式（信号超时失效）才放行，正常路径必须有信号
  return fallbackMode || document.documentElement.getAttribute(READY_ATTR) === '1'
}

/** 轮询检测导航重建；只有在 header Vue mount 完成、且签名稳定后才动手改 DOM */
function poll(): void {
  if (!active || !domReady) return
  if (!headerVueReady()) return
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
  // 正常路径靠 mount 完成信号保证安全，窗口可短；兜底模式用长窗口
  const stableMs = fallbackMode ? FALLBACK_STABLE_WINDOW_MS : STABLE_WINDOW_MS
  if (Date.now() - navStableSince < stableMs) return
  renderAll()
}

function bindNav(nav: HTMLElement): void {
  if (nav.dataset.bbBound === '1') return
  nav.dataset.bbBound = '1'
  const signal = navAbort?.signal

  nav.addEventListener('pointerdown', (e) => {
    if (!active) return
    const target = e.target as HTMLElement
    if (target.closest(`.${DEL_CLASS}, .${ADD_CLASS}`)) return
    const item = target.closest<HTMLElement>(ITEM_SELECTOR)
    if (!item || !nav.contains(item)) return
    longPressPoint = { x: e.clientX, y: e.clientY }
    window.clearTimeout(longPressTimer)
    longPressTimer = window.setTimeout(() => {
      longPressTimer = undefined
      if (!active) return
      if (editing && isHome(item)) exitEditMode()
      else enterEditMode()
    }, LONG_PRESS_MS)
  }, { signal })

  const cancelLongPress = (): void => {
    window.clearTimeout(longPressTimer)
    longPressTimer = undefined
  }
  nav.addEventListener('pointerup', cancelLongPress, { signal })
  nav.addEventListener('pointercancel', cancelLongPress, { signal })
  nav.addEventListener('pointerleave', cancelLongPress, { signal })
  nav.addEventListener('pointermove', (e) => {
    if (longPressTimer === undefined) return
    if (Math.abs(e.clientX - longPressPoint.x) > 8 || Math.abs(e.clientY - longPressPoint.y) > 8) {
      cancelLongPress()
    }
  }, { signal })

  nav.addEventListener('click', (e) => {
    if (!active) return
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
  }, { signal })
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
  if (!active || editing) return
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

/** 频道名 → 稳定的主题色，用于列表头像 */
const AVATAR_COLORS = [
  '#fb7299', '#f5a623', '#23c2a0', '#5b8ff9', '#9b7bf0',
  '#f2764c', '#4dc4d8', '#e0628f', '#7bb13c', '#b07be0',
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[ hash % AVATAR_COLORS.length ]
}

function panelElement(): HTMLElement {
  if (panel?.isConnected) return panel
  panel = document.getElementById(PANEL_ID) as HTMLElement | null
  if (!panel) {
    panel = document.createElement('div')
    panel.id = PANEL_ID

    const head = document.createElement('div')
    head.className = 'bb-panel-head'
    const titleBox = document.createElement('div')
    const title = document.createElement('div')
    title.className = 'bb-panel-title'
    title.textContent = '添加频道'
    const count = document.createElement('span')
    count.className = 'bb-panel-count'
    title.appendChild(count)
    const subtitle = document.createElement('div')
    subtitle.className = 'bb-panel-subtitle'
    subtitle.textContent = '选择一个频道添加到顶部导航'
    titleBox.append(title, subtitle)
    const close = document.createElement('span')
    close.className = 'bb-panel-close'
    close.textContent = '×'
    close.title = '关闭'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      closePanel()
    })
    head.append(titleBox, close)

    const search = document.createElement('div')
    search.className = 'bb-panel-search'
    search.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9499a0" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>'
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = '搜索频道'
    input.value = panelQuery
    input.addEventListener('input', () => {
      panelQuery = input.value.trim()
      renderPanelList()
    })
    search.appendChild(input)

    const list = document.createElement('div')
    list.className = 'bb-panel-list'

    const footer = document.createElement('div')
    footer.className = 'bb-panel-footer'
    footer.textContent = `导航最多显示 ${MAX_NAV_CHANNELS} 项（含原生菜单）`

    panel.append(head, search, list, footer)
    document.body.appendChild(panel)
  }
  return panel
}

function renderPanelList(): void {
  const p = panelElement()
  const list = p.querySelector<HTMLElement>('.bb-panel-list')!
  const countEl = p.querySelector<HTMLElement>('.bb-panel-count')!
  const count = visibleNavCount()
  countEl.textContent = `${count}/${MAX_NAV_CHANNELS}`
  list.replaceChildren()

  // 直接从 header 频道面板 DOM 读取（完整列表 + 图标），读不到再回退内置列表
  const fromDom = readChannelsFromDom()
  const allChannels = fromDom.length ? fromDom : BILIBILI_CHANNELS
  logger.info(`nav-customizer: channels from ${fromDom.length ? `header DOM (${fromDom.length}): ${fromDom.slice(0, 6).map((c) => c.name).join('、')}…` : 'builtin list'}`)
  const channels = panelQuery
    ? allChannels.filter((c) => c.name.toLowerCase().includes(panelQuery.toLowerCase()))
    : allChannels

  if (!channels.length) {
    const empty = document.createElement('div')
    empty.className = 'bb-panel-empty'
    empty.textContent = panelQuery ? '没有匹配的频道' : '暂无可添加的频道'
    list.appendChild(empty)
    return
  }

  const full = count >= MAX_NAV_CHANNELS
  for (const channel of channels) {
    const added = config.channels.some((c) => keyOf(c.href) === keyOf(channel.href))
    const row = document.createElement('div')
    row.className = `bb-panel-item${added || full ? ' bb-added' : ''}`

    const avatar = document.createElement('span')
    avatar.className = 'bb-panel-avatar'
    if (channel.icon) {
      const img = document.createElement('img')
      img.src = channel.icon
      img.alt = ''
      avatar.appendChild(img)
    } else {
      avatar.style.background = avatarColor(channel.name)
      avatar.textContent = channel.name.slice(0, 1)
    }

    const name = document.createElement('span')
    name.className = 'bb-panel-name'
    name.textContent = channel.name

    const plus = document.createElement('span')
    plus.className = 'bb-panel-plus'
    plus.textContent = added ? '✓' : '+'

    row.append(avatar, name, plus)

    if (!added && !full) {
      row.addEventListener('click', (e) => {
        e.stopPropagation()
        // 面板停留期间数量可能已变（如其它设备同步），再校验一次总数
        if (visibleNavCount() >= MAX_NAV_CHANNELS) {
          renderPanelList()
          return
        }
        // 图标只用于弹窗展示，不写入配置，避免 data URI 占用 sync 配额
        config.channels.push({ name: channel.name, href: channel.href })
        save()
        renderAll()
        renderPanelList()
      })
    }
    list.appendChild(row)
  }
}

function openPanel(): void {
  panelQuery = ''
  const p = panelElement()
  const input = p.querySelector<HTMLInputElement>('.bb-panel-search input')
  if (input) input.value = ''
  renderPanelList()
  const rect = p.getBoundingClientRect()
  p.style.top = `${Math.max(12, Math.min(100, (window.innerHeight - rect.height) / 2))}px`
  p.style.left = `${Math.max(12, (window.innerWidth - rect.width) / 2)}px`
}

function closePanel(): void {
  panel?.remove()
  panel = null
}

/** 开始轮询 header：Vue mount 信号到达或兜底超时后调用 */
function activateDom(): void {
  if (!active || domReady) return
  domReady = true
  window.clearTimeout(vueReadyTimeout)
  vueReadyTimeout = undefined
  ensureStyle()
  navAbort = new AbortController()
  for (const nav of findNavs()) bindNav(nav)
  // 立即尝试渲染一次：此时 mount 已完成（或已进兜底），不需要等签名变化
  lastNavSig = ''
  navStableSince = Date.now() - STABLE_WINDOW_MS
  pollTimer = window.setInterval(poll, 300)
  poll()
  logger.info(`nav-customizer: dom ready (${fallbackMode ? 'fallback' : 'vue signal'})`)
}

/** 请求 MAIN world 注入 vue-ready.js，并注册 mount 信号监听 */
function requestVueReady(): void {
  vueReadyListener = () => activateDom()
  document.addEventListener(READY_EVENT, vueReadyListener)
  // 信号可能早于监听器到达（脚本注入很快），先查一次属性
  if (document.documentElement.getAttribute(READY_ATTR) === '1') {
    activateDom()
    return
  }
  void chrome.runtime.sendMessage({ type: INJECT_MESSAGE, file: VUE_READY_SCRIPT }).catch((error: unknown) => {
    logger.warn('vue-ready injection request failed', error)
  })
  // 兜底：信号机制失效时不能让功能彻底不可用
  vueReadyTimeout = window.setTimeout(() => {
    vueReadyTimeout = undefined
    if (domReady) return
    fallbackMode = true
    logger.warn('nav-customizer: vue-ready signal timeout, using fallback window')
    activateDom()
  }, VUE_READY_TIMEOUT_MS)
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
      item.classList.remove(EDITING_CLASS)
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

    // 等 MAIN world 的 Vue mount 完成信号再动手；不依赖视频播放事件
    fallbackMode = false
    requestVueReady()

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
    longPressTimer = undefined
    // 移除所有导航事件监听；下次开启时 activateDom 会重新绑定新的 controller
    navAbort?.abort()
    navAbort = null
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
    lastNavSig = ''
    window.clearTimeout(vueReadyTimeout)
    vueReadyTimeout = undefined
    if (vueReadyListener) {
      document.removeEventListener(READY_EVENT, vueReadyListener)
      vueReadyListener = null
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
