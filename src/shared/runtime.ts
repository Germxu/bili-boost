/**
 * 扩展重载 / 禁用后，旧 content script 仍留在页面上，此时调用 chrome.* 会抛
 * "Extension context invalidated"。上下文一旦失效就无法恢复，只能静默降级。
 */
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

export function isContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /extension context invalidated/i.test(error.message)
  )
}
