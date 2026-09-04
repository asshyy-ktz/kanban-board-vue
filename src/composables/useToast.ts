import { useUiStore } from '@/stores/useUiStore'

/** Thin wrapper so components don't need to know toasts live on the ui store. */
export function useToast() {
  const ui = useUiStore()
  return {
    success: (message: string) => ui.pushToast(message, 'success'),
    error: (message: string) => ui.pushToast(message, 'error'),
    info: (message: string) => ui.pushToast(message, 'info'),
  }
}
