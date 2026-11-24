import { CAPTURE_FRAME_MESSAGE } from '../../shared/constants'
import { logger } from '../../shared/logger'

const TOAST_HOST_ID = 'bili-boost-capture-toast'
const CAMERA_BTN_ID = 'bili-boost-capture-btn'
const TIME_SELECTOR = '.bpx-player-ctrl-time'

let toastHost: HTMLElement | null = null
let toastTimer: number | undefined
let flashElement: HTMLElement | null = null
let flashTimer: number | undefined
let observer: MutationObserver | null = null
const injected = new WeakMap<Element, HTMLButtonElement>()

function findAll<T extends Element>(selector: string, root: ParentNode = document, depth = 0): T[] {
  const found = Array.from(root.querySelectorAll<T>(selector))
  if (depth >= 4) return found
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.shadowRoot) found.push(...findAll<T>(selector, el.shadowRoot, depth + 1))
  })
  return found
}

function findVideo(): HTMLVideoElement | null {
  return findAll<HTMLVideoElement>('video')[ 0 ] ?? null
}

function getPlayerContainer(video: HTMLVideoElement): HTMLElement {
  const candidate = video.closest<HTMLElement>(
    '.bpx-player-video-wrap, #bilibiliPlayer, .bilibili-player',
  )
  return candidate ?? (video.parentElement as HTMLElement | null) ?? document.body
}

function getVideoTitle(): string {
  const title = document.title
    .replace(/_哔哩哔哩.*$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
  return title || 'bilibili'
}

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}-${pad(m)}-${pad(s)}` : `${pad(m)}-${pad(s)}`
}

function ensureToastHost(): ShadowRoot | null {
  if (toastHost?.isConnected && toastHost.shadowRoot) return toastHost.shadowRoot
  toastHost?.remove()
  toastHost = document.createElement('div')
  toastHost.id = TOAST_HOST_ID
  toastHost.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;'
  const shadow = toastHost.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 18px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.78);
      color: #fff;
      font: 500 14px/1.4 system-ui, -apple-system, sans-serif;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.18s ease;
    }
    .toast.show { opacity: 1; }
  `
  const toast = document.createElement('div')
  toast.className = 'toast'
  shadow.append(style, toast)
  document.body.appendChild(toastHost)
  return shadow
}

function showToast(message: string): void {
  const shadow = ensureToastHost()
  if (!shadow) return
  const toast = shadow.querySelector<HTMLElement>('.toast')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1600)
}

function flashScreen(container: HTMLElement): void {
  flashElement?.remove()
  flashElement = document.createElement('div')
  flashElement.id = 'bili-boost-capture-flash'
  flashElement.style.cssText =
    'position:absolute;inset:0;background:#fff;opacity:0.55;pointer-events:none;z-index:9998;transition:opacity 0.28s ease;'
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  container.appendChild(flashElement)
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    flashElement?.remove()
    flashElement = null
  }, 60)
}

async function captureFrame(): Promise<void> {
  const video = findVideo()
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    showToast('视频未就绪，无法截图')
    return
  }

  try {
    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const url = URL.createObjectURL(blob)
    const fileName = `${getVideoTitle()}_${formatTimestamp(video.currentTime)}.png`

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    flashScreen(getPlayerContainer(video))
    showToast(`已保存 ${fileName}`)
    logger.info('frame-capture: saved', fileName)
  } catch (error) {
    logger.warn('frame-capture: failed', error)
    showToast('截图失败：当前视频不支持导出')
  }
}

function applyButtonSize(btn: HTMLButtonElement, size: number): void {
  // 点击区域宽度固定 36px（与其他控制按钮一致），高度跟随时间元素
  btn.style.width = '36px'
  btn.style.height = `${size}px`
  const svg = btn.querySelector('svg')
  svg?.setAttribute('width', '22')
  svg?.setAttribute('height', '22')
}

function createCameraButton(size: number): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.id = CAMERA_BTN_ID
  btn.type = 'button'
  btn.setAttribute('aria-label', '截图')
  btn.title = '截取当前帧'
  btn.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'flex:none',
    'box-sizing:border-box',
    'padding:0',
    'margin:0 0 0 4px',
    'border:0',
    'border-radius:4px',
    'background:transparent',
    'color:#fff',
    'opacity:0.85',
    'cursor:pointer',
    'vertical-align:middle',
    'transition:opacity .2s,color .2s',
  ].join(';')
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block">
      <path d="M3 8.5h3.6l1.5-2.5h7.8l1.5 2.5H21v10.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>
      <circle cx="12" cy="13.5" r="3.3"/>
    </svg>
  `
  applyButtonSize(btn, size)
  btn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    void captureFrame()
  })
  btn.addEventListener('mousedown', (event) => event.stopPropagation())
  btn.addEventListener('mouseenter', () => {
    btn.style.opacity = '1'
    btn.style.color = '#00aeec'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.opacity = '0.85'
    btn.style.color = '#fff'
  })
  return btn
}

function measureSize(timeEl: HTMLElement): number {
  // 以时间元素实测高度为准，限制在合理区间避免图标过大/过小
  const height = timeEl.getBoundingClientRect().height
  return Math.round(Math.min(44, Math.max(20, height || 36)))
}

function injectButtons(): void {
  findAll<HTMLElement>(TIME_SELECTOR).forEach((timeEl) => {
    const size = measureSize(timeEl)

    // 已注入的按钮同步尺寸（全屏切换、窗口缩放会改变控制条高度）
    const tracked = injected.get(timeEl)
    if (tracked?.isConnected) {
      applyButtonSize(tracked, size)
      return
    }

    // 节点被重建但旧的相机按钮仍在原位时，复用它，避免重复插入
    const sibling = timeEl.nextElementSibling
    if (sibling?.id === CAMERA_BTN_ID) {
      const btn = sibling as HTMLButtonElement
      injected.set(timeEl, btn)
      applyButtonSize(btn, size)
      return
    }

    const btn = createCameraButton(size)
    timeEl.insertAdjacentElement('afterend', btn)
    injected.set(timeEl, btn)
    logger.info('frame-capture: camera button injected', size)
  })
}

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): void {
  if (message !== CAPTURE_FRAME_MESSAGE) return
  void captureFrame()
  sendResponse({ ok: true })
}

/** 截图功能始终启用，不挂到功能开关体系，装了扩展即可用。 */
export function initFrameCapture(): void {
  chrome.runtime.onMessage.addListener(handleMessage)
  observer = new MutationObserver(() => injectButtons())
  observer.observe(document, { childList: true, subtree: true })
  injectButtons()
  logger.info('frame-capture: ready (camera button / popup button)')
}
