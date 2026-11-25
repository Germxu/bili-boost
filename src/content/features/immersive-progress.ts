import { logger } from '../../shared/logger'
import { createPointerIdleTracker, type PointerIdleTracker } from '../utils/pointer-idle'

const PROGRESS_HOST_ID = 'bili-boost-progress-host'

interface ProgressBar {
  host: HTMLElement
  track: HTMLElement
  fill: HTMLElement
  time: HTMLElement
  video: HTMLVideoElement
  container: HTMLElement
  listeners: Array<[ keyof HTMLVideoElementEventMap, EventListener ]>
  idleTracker?: PointerIdleTracker
}

let observer: MutationObserver | null = null
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

function getPlayerContainer(video: HTMLVideoElement): HTMLElement {
  const candidate = video.closest<HTMLElement>(
    '.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player',
  )
  return candidate ?? (video.parentElement as HTMLElement | null) ?? document.body
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

function cleanup(bar: ProgressBar): void {
  bar.host.remove()
  bar.idleTracker?.destroy()
  for (const [ event, handler ] of bar.listeners) {
    bar.video.removeEventListener(event, handler)
  }
}

function createBar(video: HTMLVideoElement, container: HTMLElement): ProgressBar {
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
    'right:8px',
    'bottom:6px',
    'padding:2px 6px',
    'border-radius:4px',
    'background:rgba(0,0,0,.6)',
    'color:#fff',
    'font:11px/1.4 system-ui,-apple-system,sans-serif',
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
  }

  // 鼠标一动就隐藏（原生控制栏会出现），静止超时后自动显示。
  // 显隐只由空闲检测驱动，timeupdate 等只更新宽度/文字，避免覆盖判定。
  bar.idleTracker = createPointerIdleTracker(container, {
    onActive: () => setVisible(bar, false),
    onIdle: () => setVisible(bar, true),
  })

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
  // 注入时先显示；若鼠标正停在画面上，随后的 pointermove 会隐藏并重新计时
  setVisible(bar, true)
  return bar
}

function injectBars(): void {
  findVideos().forEach((video) => {
    const container = getPlayerContainer(video)
    const tracked = injected.get(container)
    if (tracked?.host.isConnected) {
      if (tracked.video === video) return
      cleanup(tracked)
    }

    // 容器节点被重建但旧 host 仍在原位时，清掉避免重复
    container.querySelectorAll(`#${PROGRESS_HOST_ID}`).forEach((el) => el.remove())

    const bar = createBar(video, container)
    injected.set(container, bar)
    logger.info('immersive-progress: injected')
  })
}

/** 沉浸式进度条始终启用，不挂到功能开关体系，装了扩展即可用。 */
export function initImmersiveProgress(): void {
  observer = new MutationObserver(() => injectBars())
  observer.observe(document, { childList: true, subtree: true })
  injectBars()
  logger.info('immersive-progress: ready')
}
