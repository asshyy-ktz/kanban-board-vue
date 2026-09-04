import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDark, useToggle, useStorage } from '@vueuse/core'

export interface Toast {
  id: string
  message: string
  variant: 'success' | 'error' | 'info'
}

export type BoardLayout = 'board' | 'list'

export const useUiStore = defineStore('ui', () => {
  const isDark = useDark({ storageKey: 'kanban-dark-mode' })
  const toggleDark = useToggle(isDark)

  const simulatedOffline = useStorage('kanban-simulated-offline', false)
  const layout = useStorage<BoardLayout>('kanban-board-layout', 'board')

  const toasts = ref<Toast[]>([])
  const activeCardId = ref<string | null>(null)
  const shortcutsHelpOpen = ref(false)

  // Filters
  const searchQuery = ref('')
  const labelFilter = ref<string[]>([])
  const dueFilter = ref<'all' | 'overdue' | 'week' | 'none'>('all')
  const priorityFilter = ref<'all' | 'low' | 'medium' | 'high'>('all')

  function pushToast(message: string, variant: Toast['variant'] = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    toasts.value.push({ id, message, variant })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 3500)
  }

  function dismissToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function toggleSimulatedOffline() {
    simulatedOffline.value = !simulatedOffline.value
  }

  function openCard(id: string) {
    activeCardId.value = id
  }

  function closeCard() {
    activeCardId.value = null
  }

  function toggleLayout() {
    layout.value = layout.value === 'board' ? 'list' : 'board'
  }

  function toggleLabelFilter(labelId: string) {
    labelFilter.value = labelFilter.value.includes(labelId)
      ? labelFilter.value.filter((id) => id !== labelId)
      : [...labelFilter.value, labelId]
  }

  function clearFilters() {
    searchQuery.value = ''
    labelFilter.value = []
    dueFilter.value = 'all'
    priorityFilter.value = 'all'
  }

  return {
    isDark,
    toggleDark,
    simulatedOffline,
    toggleSimulatedOffline,
    layout,
    toggleLayout,
    toasts,
    pushToast,
    dismissToast,
    activeCardId,
    openCard,
    closeCard,
    shortcutsHelpOpen,
    searchQuery,
    labelFilter,
    dueFilter,
    priorityFilter,
    toggleLabelFilter,
    clearFilters,
  }
})
