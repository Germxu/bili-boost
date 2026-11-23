import { DEFAULT_SETTINGS, SPEED_RANGE } from '../../shared/constants'
import { logger } from '../../shared/logger'
import { isContextInvalidatedError, isExtensionContextValid } from '../../shared/runtime'
import { getSettings } from '../../shared/storage'
import type { Feature, Settings, SpeedWheelSettings } from '../../shared/types'

const LAST_SPEED_KEY = 'biliBoost_lastPlaybackRate'
const OVERLAY_HOST_ID = 'bili-boost-speed-host'
const SPEED_TARGET_SELECTOR = [
  "div[aria-label='倍速']",
  '.bpx-player-ctrl-playbackrate',
  '.bpx-player-ctrl-playbackrate-menu',
].join(', ')
const SPEED_LABEL_SELECTOR = '.bpx-player-ctrl-playbackrate-result'
const COOLDOWN_MS = 50
const SAVE_DEBOUNCE_MS = 300

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
let overlayHost: HTMLElement | null = null
let hideTimer: number | undefined
let saveTimer: number | undefined
let pendingSpeed: number | null = null
let lastWheelAt = 0

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

let lastSavedSpeed: number | null = null

async function flushSave(): Promise<void> {
  if (pendingSpeed === null || !isExtensionContextValid()) return
  const speed = pendingSpeed
  pendingSpeed = null
  if (speed === lastSavedSpeed) return
  try {
    await chrome.storage.sync.set({ [ LAST_SPEED_KEY ]: speed })
    lastSavedSpeed = speed
  } catch (error) {
    if (isContextInvalidatedError(error)) return
    logger.warn('speed-wheel: failed to save speed', error)
  }
}

function scheduleSave(speed: number): void {
  if (!isExtensionContextValid()) return
  pendingSpeed = normalizeSpeed(speed)
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS)
}

async function applyRememberedSpeed(video: HTMLVideoElement): Promise<void> {
  if (!config.remember || !isExtensionContextValid()) return
  try {
    const stored = await chrome.storage.sync.get(LAST_SPEED_KEY)
    const speed = stored[ LAST_SPEED_KEY ]
    if (typeof speed !== 'number' || !Number.isFinite(speed)) return
    const normalized = normalizeSpeed(speed)
    lastSavedSpeed = normalized
    if (Math.abs(video.playbackRate - normalized) > 0.001) {
      video.playbackRate = normalized
      updateNativeLabel(normalized)
    }
  } catch (error) {
    if (isContextInvalidatedError(error)) return
    logger.warn('speed-wheel: failed to restore speed', error)
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
    const step = current > 2 ? 0.3 : 0.05
    const next = normalizeSpeed(current + direction * step)
    if (next === current) return

    video.playbackRate = next
    updateNativeLabel(next)
    showSpeed(next, getPlayerContainer(video))
    if (config.remember) scheduleSave(next)
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
    if (config.remember) scheduleSave(1)
    logger.info('speed-wheel: reset to 1x via context menu')
  }
}

function bindVideos(): void {
  findVideos(document).forEach((video) => {
    if (boundVideos.some((item) => item.video === video)) return
    const onRateChange = () => {
      const speed = normalizeSpeed(video.playbackRate)
      updateNativeLabel(speed)
      if (config.remember) scheduleSave(speed)
    }
    video.addEventListener('ratechange', onRateChange)
    boundVideos.push({ video, onRateChange })
    void applyRememberedSpeed(video)
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
}

function handleStorageChanged(
  changes: { [ key: string ]: chrome.storage.StorageChange },
  areaName: string,
): void {
  if (areaName !== 'sync' || !changes.settings) return
  const settings = changes.settings.newValue as Settings | undefined
  if (!settings?.speedWheel) return
  config = { ...settings.speedWheel }
}

function unbindAll(): void {
  for (const item of boundVideos) {
    item.video.removeEventListener('ratechange', item.onRateChange)
  }
  for (const item of boundTargets) {
    item.element.removeEventListener('wheel', item.onWheel, { capture: true })
    item.element.removeEventListener('contextmenu', item.onContextMenu, { capture: true })
  }
  boundVideos.length = 0
  boundTargets.length = 0
  overlayHost?.remove()
  overlayHost = null
  window.clearTimeout(hideTimer)
  window.clearTimeout(saveTimer)
  void flushSave()
}

export const speedWheelFeature: Feature = {
  id: 'speedWheel',
  name: '滚轮倍速播放',
  description: '悬停倍速按钮滚轮调速（0.25x–5x），右键恢复 1x',
  enabledByDefault: false,

  async start(): Promise<void> {
    const settings = await getSettings()
    config = { ...settings.speedWheel }
    chrome.storage.onChanged.addListener(handleStorageChanged)
    observer = new MutationObserver(() => rescan())
    observer.observe(document, { childList: true, subtree: true, attributes: true })
    rescan()
    logger.info('speed-wheel: started', config)
  },

  stop(): void {
    chrome.storage.onChanged.removeListener(handleStorageChanged)
    observer?.disconnect()
    observer = null
    unbindAll()
    logger.info('speed-wheel: stopped')
  },
}
