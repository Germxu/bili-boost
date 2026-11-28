import { DEFAULT_SETTINGS, SPEED_RANGE } from '../../shared/constants'
import { logger } from '../../shared/logger'
import { getSettings } from '../../shared/storage'
import type { Settings, SpeedWheelSettings } from '../../shared/types'

const SPEED_KEY = 'biliBoost_lastPlaybackRate'
const OVERLAY_HOST_ID = 'bili-boost-speed-host'
const SPEED_TARGET_SELECTOR = [
  "div[aria-label='倍速']",
  '.bpx-player-ctrl-playbackrate',
  '.bpx-player-ctrl-playbackrate-menu',
].join(', ')
const NATIVE_MENU_SELECTOR = '.bpx-player-ctrl-playbackrate-menu'
const SPEED_LABEL_SELECTOR = '.bpx-player-ctrl-playbackrate-result'
const COOLDOWN_MS = 50
const SAVE_DEBOUNCE_MS = 300
const NATIVE_CLICK_WINDOW_MS = 2000

interface BoundVideo {
  video: HTMLVideoElement
  onRateChange: () => void
}

interface BoundTarget {
  element: HTMLElement
  onWheel: (event: WheelEvent) => void
  onContextMenu: (event: MouseEvent) => void
}

let config: SpeedWheelSettings = { ...DEFAULT_SETTINGS.speedWheel }
let observer: MutationObserver | null = null
const boundVideos: BoundVideo[] = []
const boundTargets: BoundTarget[] = []
const boundMenus = new WeakSet<HTMLElement>()
let overlayHost: HTMLElement | null = null
let hideTimer: number | undefined
let saveTimer: number | undefined
let pendingSpeed: number | null = null
let lastSyncedSpeed: number | null = null
let lastWheelAt = 0
let lastNativeClickAt = 0
let nativeClickPending = false

function normalizeSpeed(value: number): number {
  const clamped = Math.min(SPEED_RANGE.max, Math.max(SPEED_RANGE.min, value))
  return Math.round(clamped * 100) / 100
}

function formatSpeed(value: number): string {
  return `${Number(value.toFixed(2))}x`
}

function getPlayerContainer(video: HTMLVideoElement): HTMLElement {
  const candidate = video.closest<HTMLElement>(
    '.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player',
  )
  return candidate ?? (video.parentElement as HTMLElement | null) ?? document.body
}

function findAll<T extends Element>(selector: string, root: ParentNode = document, depth = 0): T[] {
  const found = Array.from(root.querySelectorAll<T>(selector))
  if (depth >= 4) return found
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.shadowRoot) found.push(...findAll<T>(selector, el.shadowRoot, depth + 1))
  })
  return found
}

function findVideos(root: ParentNode = document): HTMLVideoElement[] {
  return findAll<HTMLVideoElement>('video', root)
}

function getVideoForTarget(target: HTMLElement): HTMLVideoElement | null {
  const player = target.closest<HTMLElement>(
    '.bpx-player-container, #bilibiliPlayer, .bilibili-player',
  )
  return (player && findVideos(player)[ 0 ]) || findVideos()[ 0 ] || null
}

function ensureOverlay(container: HTMLElement): ShadowRoot {
  if (overlayHost && overlayHost.parentElement === container && overlayHost.shadowRoot) {
    return overlayHost.shadowRoot
  }

  overlayHost?.remove()
  overlayHost = document.createElement('div')
  overlayHost.id = OVERLAY_HOST_ID
  overlayHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9999;'

  const shadow = overlayHost.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    .badge {
      position: absolute;
      top: 14px;
      right: 16px;
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      font: 500 16px/1.2 system-ui, -apple-system, sans-serif;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .badge.show { opacity: 1; }
  `
  const badge = document.createElement('div')
  badge.className = 'badge'
  shadow.append(style, badge)

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  container.appendChild(overlayHost)
  return shadow
}

function showSpeed(speed: number, container: HTMLElement): void {
  const shadow = ensureOverlay(container)
  const badge = shadow.querySelector<HTMLElement>('.badge')
  if (!badge) return
  badge.textContent = formatSpeed(speed)
  badge.classList.add('show')
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => badge.classList.remove('show'), 1200)
}

function updateNativeLabel(speed: number): void {
  const text = speed === 1 ? '倍速' : formatSpeed(speed)
  findAll<HTMLElement>(SPEED_LABEL_SELECTOR).forEach((el) => {
    el.textContent = text
  })
}

/** 主存储：本机 localStorage，读写都不依赖云同步。 */
function loadLocalSpeed(): number | null {
  try {
    const raw = window.localStorage.getItem(SPEED_KEY)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? normalizeSpeed(value) : null
  } catch (error) {
    logger.warn('speed-wheel: failed to read local speed', error)
    return null
  }
}

function writeLocalSpeed(speed: number): void {
  try {
    window.localStorage.setItem(SPEED_KEY, String(speed))
  } catch (error) {
    logger.warn('speed-wheel: failed to write local speed', error)
  }
}

/** 辅助同步：写 sync 失败只记日志，绝不影响本地倍速。沿用原来的 300ms 防抖。 */
async function flushSync(): Promise<void> {
  if (pendingSpeed === null) return
  const speed = pendingSpeed
  pendingSpeed = null
  if (speed === lastSyncedSpeed) return
  try {
    await chrome.storage.sync.set({ [ SPEED_KEY ]: speed })
    lastSyncedSpeed = speed
  } catch (error) {
    logger.warn('speed-wheel: failed to sync speed', error)
  }
}

function scheduleSync(speed: number): void {
  pendingSpeed = normalizeSpeed(speed)
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void flushSync(), SAVE_DEBOUNCE_MS)
}

/** 用户主动调速：先落地本地，再顺便同步到云端。 */
function saveSpeed(speed: number): void {
  const normalized = normalizeSpeed(speed)
  writeLocalSpeed(normalized)
  scheduleSync(normalized)
  logger.info('speed-wheel: saved speed', normalized)
}

/** 把某个速率应用到 video，不写入任何存储。 */
function applySpeed(video: HTMLVideoElement, speed: number): void {
  if (Math.abs(video.playbackRate - speed) < 0.001) return
  video.playbackRate = speed
  updateNativeLabel(speed)
}

/** 应用本机记忆倍速。 */
function applyRememberedSpeed(video: HTMLVideoElement): void {
  if (!config.remember) return
  const speed = loadLocalSpeed()
  if (speed === null) return
  applySpeed(video, speed)
}

/** 云端只作辅助：有同步值就更新本地并应用，没有或失败就保持本地现状。 */
async function loadSyncedSpeed(): Promise<void> {
  if (!config.remember) return
  try {
    const stored = await chrome.storage.sync.get(SPEED_KEY)
    const value = stored[ SPEED_KEY ]
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    const normalized = normalizeSpeed(value)
    lastSyncedSpeed = normalized
    writeLocalSpeed(normalized)
    boundVideos.forEach(({ video }) => applySpeed(video, normalized))
  } catch (error) {
    logger.warn('speed-wheel: failed to load synced speed', error)
  }
}

function createOnWheel(target: HTMLElement): (event: WheelEvent) => void {
  return (event) => {
    if (event.deltaY === 0) return
    const video = getVideoForTarget(target)
    if (!video) return

    const now = Date.now()
    if (now - lastWheelAt < COOLDOWN_MS) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    lastWheelAt = now
    event.preventDefault()
    event.stopImmediatePropagation()

    const direction = event.deltaY > 0 ? -1 : 1
    const current = video.playbackRate || 1
    const step = current > 2 ? 0.15 : 0.05
    const next = normalizeSpeed(current + direction * step)
    if (next === current) return

    video.playbackRate = next
    updateNativeLabel(next)
    showSpeed(next, getPlayerContainer(video))
    if (config.remember) saveSpeed(next)
  }
}

function createOnContextMenu(target: HTMLElement): (event: MouseEvent) => void {
  return (event) => {
    const video = getVideoForTarget(target)
    if (!video) return

    event.preventDefault()
    event.stopImmediatePropagation()

    video.playbackRate = 1
    updateNativeLabel(1)
    showSpeed(1, getPlayerContainer(video))
    if (config.remember) saveSpeed(1)
    logger.info('speed-wheel: reset to 1x via context menu')
  }
}

/**
 * 监听 B站 原生倍速菜单的点击，标记接下来由它引起的 ratechange 是用户主动调速，
 * 这样才保存新速率；其它 ratechange（B站 初始化 / 切视频重置）则纠正回记忆值。
 */
function bindNativeMenus(): void {
  findAll<HTMLElement>(NATIVE_MENU_SELECTOR).forEach((menu) => {
    if (boundMenus.has(menu)) return
    const markNative = () => {
      lastNativeClickAt = Date.now()
      nativeClickPending = true
    }
    // pointerdown / click 都标记，兼容 B站 用 mousedown 或 click 触发调速
    menu.addEventListener('pointerdown', markNative, { capture: true })
    menu.addEventListener('click', markNative, { capture: true })
    boundMenus.add(menu)
  })
}

function bindVideos(): void {
  findVideos(document).forEach((video) => {
    if (boundVideos.some((item) => item.video === video)) return
    const onRateChange = () => {
      const speed = normalizeSpeed(video.playbackRate)
      updateNativeLabel(speed)
      if (!config.remember) return

      // 用户刚点过原生倍速菜单：这次是用户选的速率，保存下来
      if (nativeClickPending && Date.now() - lastNativeClickAt < NATIVE_CLICK_WINDOW_MS) {
        nativeClickPending = false
        saveSpeed(speed)
        return
      }

      // 已经是记忆值，无需纠正
      const remembered = loadLocalSpeed()
      if (remembered !== null && Math.abs(speed - remembered) < 0.001) return

      // B站 初始化 / 切视频把速率重置了，纠正回记忆值
      applyRememberedSpeed(video)
    }
    video.addEventListener('ratechange', onRateChange)
    boundVideos.push({ video, onRateChange })
    applyRememberedSpeed(video)
  })
}

function bindSpeedTargets(): void {
  findAll<HTMLElement>(SPEED_TARGET_SELECTOR).forEach((element) => {
    if (boundTargets.some((item) => item.element === element)) return
    const onWheel = createOnWheel(element)
    const onContextMenu = createOnContextMenu(element)
    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    element.addEventListener('contextmenu', onContextMenu, { capture: true })
    boundTargets.push({ element, onWheel, onContextMenu })
  })
}

function rescan(): void {
  bindVideos()
  bindSpeedTargets()
  bindNativeMenus()
}

function handleStorageChanged(
  changes: { [ key: string ]: chrome.storage.StorageChange },
  areaName: string,
): void {
  if (areaName !== 'sync') return
  if (changes.settings) {
    const settings = changes.settings.newValue as Settings | undefined
    if (settings?.speedWheel) config = { ...settings.speedWheel }
  }
  if (changes[ SPEED_KEY ]) {
    const value = changes[ SPEED_KEY ].newValue
    if (typeof value === 'number' && Number.isFinite(value)) {
      const normalized = normalizeSpeed(value)
      lastSyncedSpeed = normalized
      writeLocalSpeed(normalized)
      boundVideos.forEach(({ video }) => applySpeed(video, normalized))
    }
  }
}

/** 滚轮倍速常驻启用，无功能开关；「记住倍速」与 sync 速度同步仍走设置项 */
export async function initSpeedWheel(): Promise<void> {
  const settings = await getSettings()
  config = { ...settings.speedWheel }
  chrome.storage.onChanged.addListener(handleStorageChanged)
  observer = new MutationObserver(() => rescan())
  observer.observe(document, { childList: true, subtree: true, attributes: true })
  rescan()
  void loadSyncedSpeed()
  logger.info('speed-wheel: ready', config)
}
