import { onMounted, onUnmounted } from 'vue'

export interface ShortcutMap {
  [combo: string]: (e: KeyboardEvent) => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

/**
 * Registers global keyboard shortcuts while the owning component is mounted.
 * Keys are lowercase single characters or names like "escape", "/", "n".
 * Ignored while the user is typing in a form field, except "escape".
 */
export function useKeyboardShortcuts(map: ShortcutMap) {
  function handler(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if (isTypingTarget(e.target) && key !== 'escape') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const fn = map[key]
    if (fn) fn(e)
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
