import { logger } from '../../shared/logger'

const PROGRESS_HOST_ID = 'bili-boost-progress-host'
/** 进度条插入完成后发出，供其它功能等播放器就绪后再介入 DOM */
export const PLAYER_READY_EVENT = 'bili-boost:player-ready'
const OBSERVE_OPTIONS: MutationObserverInit = { childList: true, subtree: true }
// 新版 B站 bpx 播放器用这个属性驱动控制栏显隐：true=隐藏，false=显示
const CTRL_HIDDEN_ATTR = 'data-ctrl-hidden'
const CTRL_HOST_SELECTOR = '.bpx-player-container'

interface ProgressBar {
  host: HTMLElement
  track: HTMLElement
  fill: HTMLElement
  time: HTMLElement
  video: HTMLVideoElement
  container: HTMLElement
  listeners: Array<[ keyof HTMLVideoElementEventMap, EventListener ]>
  ctrlHost: HTMLElement | null
  ctrlObserver: MutationObserver | null
}

let observer: MutationObserver | null = null
let injectScheduled = false
const injected = new WeakMap<HTMLElement, ProgressBar>()

function findAll<T extends Element>(selector: string, root: ParentNode = document, depth = 0): T[] {
  const found = Array.from(root.querySelectorAll<T>(selector))
  if (depth >= 4) return found
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.shadowRoot) found.push(...findAll<T>(selector, el.shadowRoot, depth + 1))
  })
  return found
}

function findVideos(): HTMLVideoElement[] {
  return findAll<HTMLVideoElement>('video')
}

/** 找包含视频与控制栏的播放器根节点，可跨越 Shadow DOM。 */
function getPlayerRoot(video: HTMLElement): HTMLElement {
  let el: Element | null = video
  while (el) {
    if (el.matches('.bpx-player, #bilibiliPlayer, .bilibili-player')) return el as HTMLElement
    const parent: HTMLElement | null = el.parentElement
    if (parent) {
      el = parent
      continue
    }
    const node = el.getRootNode()
    el = node instanceof ShadowRoot ? node.host : null
  }
  const node = video.getRootNode()
  return ((node instanceof ShadowRoot ? node.host : null) ?? video.parentElement ?? document.body) as HTMLElement
}

function getPlayerContainer(video: HTMLVideoElement, root: HTMLElement): HTMLElement {
  const candidate = video.closest<HTMLElement>(
    '.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player',
  )
  return candidate ?? (video.parentElement as HTMLElement | null) ?? root
}

/** 找驱动控制栏显隐的 .bpx-player-container，先查子树再查祖先，均跨 Shadow DOM。 */
function findCtrlHost(root: HTMLElement): HTMLElement | null {
  const found = findAll<HTMLElement>(CTRL_HOST_SELECTOR, root)[ 0 ]
  if (found) return found
  let el: Element | null = root
  for (let depth = 0; el && depth < 16; depth++) {
    if (el instanceof HTMLElement && el.matches(CTRL_HOST_SELECTOR)) return el
    const parent: HTMLElement | null = el.parentElement
    if (parent) {
      el = parent
      continue
    }
    const node = el.getRootNode()
    el = node instanceof ShadowRoot ? node.host : null
  }
  return null
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function render(bar: ProgressBar): void {
  const { video, fill, time } = bar
  const duration = video.duration
  const pct =
    Number.isFinite(duration) && duration > 0
      ? Math.min(100, Math.max(0, (video.currentTime / duration) * 100))
      : 0
  fill.style.width = `${pct}%`
  time.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`
}

/** 进度条与时间文字一起显隐，避免遮挡 B站 原生控制栏。 */
function setVisible(bar: ProgressBar, visible: boolean): void {
  bar.track.style.opacity = visible ? '0.7' : '0'
  bar.time.style.opacity = visible ? '1' : '0'
}

/**
 * 唯一的显隐依据：控制栏的 data-ctrl-hidden。
 * - "false"（控制栏显示中）→ 隐藏我们自己的进度条，避免遮挡；
 * - "true"（控制栏隐藏）→ 显示进度条；
 * - 属性缺失 / 找不到容器（状态未知）→ 默认显示，保证功能仍可见。
 */
function syncVisibility(bar: ProgressBar): void {
  const raw = bar.ctrlHost?.getAttribute(CTRL_HIDDEN_ATTR)
  setVisible(bar, raw !== 'false')
}

function cleanup(bar: ProgressBar): void {
  bar.host.remove()
  bar.ctrlObserver?.disconnect()
  for (const [ event, handler ] of bar.listeners) {
    bar.video.removeEventListener(event, handler)
  }
}

function createBar(
  video: HTMLVideoElement,
  container: HTMLElement,
  ctrlHost: HTMLElement | null,
): ProgressBar {
  const host = document.createElement('div')
  host.id = PROGRESS_HOST_ID
  host.style.cssText = [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'height:3px',
    'pointer-events:none',
    'z-index:9997',
  ].join(';')

  // 进度条单独一层，和时间文字一起做淡出
  const track = document.createElement('div')
  track.style.cssText = [
    'position:absolute',
    'inset:0',
    'background:rgba(255,255,255,.2)',
    'opacity:0',
    'transition:opacity .2s ease',
  ].join(';')

  const fill = document.createElement('div')
  fill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;background:#00aeec;'

  const time = document.createElement('div')
  time.style.cssText = [
    'position:absolute',
    'right:4px',
    'bottom:6px',
    'padding:2px 6px',
    'border-radius:4px',
    'background:rgba(0,0,0,.38)',
    'color:#fff9',
    'font:12px/1.4 system-ui,-apple-system,sans-serif',
    'white-space:nowrap',
    'opacity:0',
    'transition:opacity .2s ease',
  ].join(';')

  track.appendChild(fill)
  host.append(track, time)
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  container.appendChild(host)

  const bar: ProgressBar = {
    host,
    track,
    fill,
    time,
    video,
    container,
    listeners: [],
    ctrlHost,
    ctrlObserver: null,
  }

  // 只跟随 B站 自己的控制栏状态：属性一变就同步，与鼠标事件解耦。
  if (ctrlHost) {
    bar.ctrlObserver = new MutationObserver(() => syncVisibility(bar))
    bar.ctrlObserver.observe(ctrlHost, {
      attributes: true,
      attributeFilter: [ CTRL_HIDDEN_ATTR ],
    })
  }

  const update = () => render(bar)
  const events: Array<keyof HTMLVideoElementEventMap> = [
    'timeupdate',
    'loadedmetadata',
    'durationchange',
    'seeked',
  ]
  events.forEach((event) => {
    video.addEventListener(event, update)
    bar.listeners.push([ event, update ])
  })

  render(bar)
  syncVisibility(bar)
  return bar
}

function injectBars(): void {
  // 注入过程会改动 DOM，先断开观察，避免自己的改动反过来触发下一轮注入
  observer?.disconnect()
  try {
    const seen = new Set<HTMLElement>()
    findVideos().forEach((video) => {
      const root = getPlayerRoot(video)
      const container = getPlayerContainer(video, root)
      // 一个容器只挂一条进度条，避免多个 video（广告/小窗等）互相顶替造成重注入循环
      if (seen.has(container)) return
      seen.add(container)

      const ctrlHost = findCtrlHost(root)
      const tracked = injected.get(container)
      // 已有进度条及其绑定的视频、控制栏容器都还在页面上就沿用，不反复重建
      if (
        tracked?.host.isConnected &&
        tracked.video.isConnected &&
        tracked.ctrlHost === ctrlHost &&
        (!tracked.ctrlHost || tracked.ctrlHost.isConnected)
      ) return
      if (tracked) cleanup(tracked)
      container.querySelectorAll(`#${PROGRESS_HOST_ID}`).forEach((el) => el.remove())

      const bar = createBar(video, container, ctrlHost)
      injected.set(container, bar)
      document.dispatchEvent(new CustomEvent(PLAYER_READY_EVENT))
    })
  } finally {
    observer?.observe(document, OBSERVE_OPTIONS)
  }
}

/** 合并短时间内的大量 DOM 变动，避免播放器频繁重建时反复注入。 */
function scheduleInject(): void {
  if (injectScheduled) return
  injectScheduled = true
  window.setTimeout(() => {
    injectScheduled = false
    injectBars()
  }, 100)
}

/** 沉浸式进度条始终启用，不挂到功能开关体系，装了扩展即可用。 */
export function initImmersiveProgress(): void {
  observer = new MutationObserver(scheduleInject)
  observer.observe(document, OBSERVE_OPTIONS)
  injectBars()
  logger.info('immersive-progress: ready')
}
