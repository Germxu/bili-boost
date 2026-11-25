/**
 * 通用「指针空闲检测」工具。
 *
 * 浏览器没有「鼠标已隐藏 / 已停止移动」这类事件，播放器控制栏普遍靠
 * 「移动即激活、静止超时即空闲」这套逻辑实现显隐。这里把它抽出来，
 * 供后续任何需要跟随鼠标空闲状态的功能复用。
 */

/** 默认静止时长：调到贴近 B站 原生控制栏自动收起的节奏。 */
export const DEFAULT_IDLE_MS = 1500

export interface PointerIdleOptions {
  /** 指针静止多久判定为空闲（ms），默认 DEFAULT_IDLE_MS */
  idleDelay?: number
  /** 从空闲转为活动（指针移动）时触发 */
  onActive?: () => void
  /** 判定为空闲（静止超时或指针离开）时触发 */
  onIdle?: () => void
}

export interface PointerIdleTracker {
  /** 手动进入活动状态并重新开始计时（如元素刚注入时调用） */
  poke(): void
  /** 立即判定为空闲，清除计时器并触发 onIdle */
  idle(): void
  /** 移除监听与计时器，元素销毁时调用 */
  destroy(): void
}

/**
 * 监听目标元素上的指针活动，维护「活动 / 空闲」两态：
 * - 指针移动 → 进入活动态（仅在首次从空闲切换时触发 onActive），并重置计时；
 * - 静止超过 idleDelay → 回到空闲态，触发 onIdle；
 * - 指针离开元素 → 立即回到空闲态。
 *
 * 初始状态为空闲，创建时不触发任何回调。
 */
export function createPointerIdleTracker(
  target: HTMLElement,
  options: PointerIdleOptions = {},
): PointerIdleTracker {
  const { idleDelay = DEFAULT_IDLE_MS, onActive, onIdle } = options
  let isIdle = true
  let timer: number | undefined

  const goIdle = (): void => {
    window.clearTimeout(timer)
    timer = undefined
    if (isIdle) return
    isIdle = true
    onIdle?.()
  }

  const goActive = (): void => {
    if (!isIdle) return
    isIdle = false
    onActive?.()
  }

  const schedule = (): void => {
    window.clearTimeout(timer)
    timer = window.setTimeout(goIdle, idleDelay)
  }

  const onPointerMove = (): void => {
    goActive()
    schedule()
  }
  const onPointerLeave = (): void => goIdle()

  target.addEventListener('pointermove', onPointerMove, { passive: true })
  target.addEventListener('pointerleave', onPointerLeave, { passive: true })

  return {
    poke() {
      goActive()
      schedule()
    },
    idle: goIdle,
    destroy() {
      window.clearTimeout(timer)
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerleave', onPointerLeave)
    },
  }
}
