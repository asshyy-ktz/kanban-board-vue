import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUiStore } from '@/stores/useUiStore'

/**
 * Tracks navigator.onLine plus a manual "simulate offline" toggle (stored
 * on the ui store) so the offline queue / conflict-banner flow can be
 * demoed without physically disconnecting the network.
 */
export function useOnlineStatus() {
  const ui = useUiStore()
  const browserOnline = ref(navigator.onLine)

  function update() {
    browserOnline.value = navigator.onLine
  }

  onMounted(() => {
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  })

  onUnmounted(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  })

  const isOnline = computed(() => browserOnline.value && !ui.simulatedOffline)

  return { isOnline }
}
