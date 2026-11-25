/**
 * Bili Boost - 检测 B站 header 的 Vue 组件 mount 完成（MAIN world）
 *
 * B站 header 是异步 Vue 组件。content script（isolated world）读不到页面脚本
 * 挂在 DOM 上的 Vue 实例 expando，因此检测必须在 MAIN world 进行，
 * 再把结果通过 documentElement 上的属性 + CustomEvent 传给 isolated world。
 *
 * Vue3 在 app.mount() 完成后会把 app 挂到挂载容器的 __vue_app__ 上，
 * 组件根 DOM 节点上会有 __vueParentComponent；两者都带 isMounted 标志。
 */
;(function (): void {
  'use strict'

  const TAG = '[BiliBoost][vue-ready]'
  const READY_ATTR = 'data-bb-header-vue-ready'
  const READY_EVENT = 'bili-boost:header-vue-ready'
  const INTERVAL_MS = 100

  interface VueInstance {
    isMounted?: boolean
    isUnmounted?: boolean
  }
  interface VueApp {
    _instance?: VueInstance
  }
  type VueNode = HTMLElement & {
    __vueParentComponent?: VueInstance
    __vue_app__?: VueApp
  }

  let ready = false
  let waitingLogCount = 0

  /** header 相关容器：挂载点本身 + 导航区域，覆盖 Vue2 / Vue3 不同挂法 */
  function headerAnchors(): VueNode[] {
    const selectors = [
      '#bili-header-mount',
      'bili-header',
      '.bili-header',
      '.bili-header__bar',
      '.bili-header__bar .left-entry',
    ]
    const anchors: VueNode[] = []
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el) anchors.push(el as VueNode)
    }
    return anchors
  }

  function mountedFrom(el: VueNode): boolean {
    // Vue3：app.mount() 完成后在容器上留下 __vue_app__
    const app = el.__vue_app__
    if (app?._instance?.isMounted === true && app._instance.isUnmounted !== true) return true
    // Vue3：组件根 DOM 节点上的父组件实例
    const vm = el.__vueParentComponent
    if (vm?.isMounted === true && vm.isUnmounted !== true) return true
    return false
  }

  function isHeaderMounted(): boolean {
    for (const anchor of headerAnchors()) {
      let el: VueNode | null = anchor
      while (el) {
        if (mountedFrom(el)) return true
        el = el.parentElement as VueNode | null
      }
    }
    // 兜底：扫描 header 子树里带 Vue 实例的节点（挂载点可能是内层元素）
    const root = document.querySelector('#bili-header-mount, bili-header, .bili-header')
    if (root) {
      const nodes = root.querySelectorAll<VueNode>('*')
      for (let i = 0; i < nodes.length; i += 1) {
        if (mountedFrom(nodes[ i ])) return true
      }
    }
    return false
  }

  function setReady(next: boolean): void {
    if (next === ready) return
    ready = next
    if (next) {
      document.documentElement.setAttribute(READY_ATTR, '1')
      document.dispatchEvent(new CustomEvent(READY_EVENT))
    } else {
      // header 被卸载（SPA 切页等），收回信号，等新的 mount 完成
      document.documentElement.removeAttribute(READY_ATTR)
    }
    console.info(TAG, next ? 'header Vue mounted' : 'header Vue unmounted/reset')
  }

  const timer = window.setInterval(() => {
    const mounted = isHeaderMounted()
    if (!mounted && waitingLogCount < 5) {
      waitingLogCount += 1
      console.info(TAG, 'waiting for header Vue mount...')
    }
    setReady(mounted)
  }, INTERVAL_MS)

  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true })

  console.info(TAG, 'loaded')
})()
