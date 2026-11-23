/**
 * Bili Boost - 评论区 IP 属地注入（MAIN world）
 *
 * B站视频评论区使用 Lit Web Component。评论数据挂在组件实例的 data 属性上，
 * 而内容脚本运行在 isolated world，拿不到页面脚本设置的 expando 属性，
 * 所以必须在 MAIN world 中 patch 组件。
 *
 * 此文件是源代码，编译后输出到 public/ip-location.js，再由 Vite 复制到 dist/。
 */
;(function (): void {
  'use strict'

  const TAG = '[BiliBoost][main]'
  const FLAG_KEY = 'biliBoost_ipEnabled'
  const CE_NAME = 'bili-comment-action-buttons-renderer'
  const BADGE_ID = 'bili-boost-ip'
  let debugCount = 0

  interface ReplyPayload {
    reply_control?: { location?: string }
  }

  interface ActionButtonsRenderer extends HTMLElement {
    data?: ReplyPayload
    update(): void
    __biliBoostPatched?: boolean
  }

  type RendererConstructor = {
    new (...args: never[]): ActionButtonsRenderer
    prototype: ActionButtonsRenderer
  }

  function isEnabled(): boolean {
    return localStorage.getItem(FLAG_KEY) !== '0'
  }

  function readLocation(data: ReplyPayload | undefined): string | null {
    const raw = data?.reply_control?.location
    if (!raw) return null
    return String(raw).replace(/^IP属地[:：]?/, '').trim() || null
  }

  function updateElement(el: ActionButtonsRenderer): void {
    const root = el.shadowRoot
    if (!root) return

    const pubdate = root.querySelector<HTMLElement>('#pubdate')
    if (!pubdate) return

    let badge = root.querySelector<HTMLElement>(`#${BADGE_ID}`)
    const location = isEnabled() ? readLocation(el.data) : null

    if (debugCount < 4) {
      debugCount += 1
      console.info(
        TAG,
        'component seen, data =',
        el.data ? Object.keys(el.data).slice(0, 12) : 'undefined',
        'location =',
        location,
      )
    }

    if (!location) {
      badge?.remove()
      return
    }

    if (badge) {
      if (badge.textContent !== location) badge.textContent = location
      return
    }

    badge = document.createElement('div')
    badge.id = BADGE_ID
    badge.textContent = location
    badge.style.cssText = 'margin-top:2px;color:#9499a0;font-size:12px;line-height:1.4;'
    pubdate.insertAdjacentElement('afterend', badge)
  }

  function patchConstructor(ctor: RendererConstructor | undefined): void {
    if (!ctor?.prototype || typeof ctor.prototype.update !== 'function') return
    if (ctor.prototype.__biliBoostPatched) return

    const original = ctor.prototype.update as (...args: unknown[]) => void
    ctor.prototype.update = function (this: ActionButtonsRenderer, ...args: unknown[]): void {
      const result = original.apply(this, args)
      try {
        updateElement(this)
      } catch (error) {
        console.warn(TAG, 'update failed', error)
      }
      return result
    }
    ctor.prototype.__biliBoostPatched = true
    console.info(TAG, 'patched update() of', CE_NAME)
  }

  function scan(root: ParentNode, depth: number): void {
    if (depth > 6) return
    root.querySelectorAll<ActionButtonsRenderer>(CE_NAME).forEach(updateElement)
    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.shadowRoot) scan(el.shadowRoot, depth + 1)
    })
  }

  function removeAllBadges(): void {
    document.querySelectorAll<HTMLElement>(`#${BADGE_ID}`).forEach((el) => el.remove())
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.shadowRoot?.querySelectorAll<HTMLElement>(`#${BADGE_ID}`).forEach((badge) => badge.remove())
    })
  }

  const registry = window.customElements
  if (registry) {
    const existing = registry.get(CE_NAME) as RendererConstructor | undefined
    if (existing) patchConstructor(existing)

    const originalDefine = registry.define.bind(registry)
    registry.define = function (
      name: string,
      ctor: CustomElementConstructor,
      options?: ElementDefinitionOptions,
    ): void {
      if (name === CE_NAME) patchConstructor(ctor as unknown as RendererConstructor)
      originalDefine(name, ctor, options)
    } as typeof registry.define
  }

  // 兜底扫描：覆盖 data 晚于首次 update 赋值、以及切换评论列表的情况。
  const timer = window.setInterval(() => {
    if (!isEnabled()) {
      removeAllBadges()
      return
    }
    scan(document, 0)
  }, 1200)
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true })

  window.addEventListener('storage', (event) => {
    if (event.key === FLAG_KEY && event.newValue === '0') removeAllBadges()
  })

  console.info(TAG, 'loaded')
})()
