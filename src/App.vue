<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useMagicKeys, whenever } from '@vueuse/core'
import { useBoardsStore } from '@/stores/useBoardsStore'
import { useCardsStore } from '@/stores/useCardsStore'
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
import { useUiStore } from '@/stores/useUiStore'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { ensureSeeded } from '@/seed/seedData'
import ConflictBanner from '@/components/sync/ConflictBanner.vue'
import Toast from '@/components/shared/Toast.vue'
import ShortcutsHelp from '@/components/shared/ShortcutsHelp.vue'

const boards = useBoardsStore()
const cards = useCardsStore()
const syncQueue = useSyncQueueStore()
const ui = useUiStore()
const { isOnline } = useOnlineStatus()

const { shift, question } = useMagicKeys()
whenever(() => shift.value && question.value, () => {
  ui.shortcutsHelpOpen = !ui.shortcutsHelpOpen
})

let stopWatchingOnline: (() => void) | null = null

onMounted(async () => {
  await ensureSeeded()
  await Promise.all([boards.init(), cards.init(), syncQueue.init()])

  const trySync = async () => {
    if (isOnline.value && syncQueue.pendingCount > 0) {
      await syncQueue.flush(() => cards.cards)
      await cards.refreshFromDb()
      if (syncQueue.conflicts.length === 0) {
        ui.pushToast('All changes synced', 'success')
      } else {
        ui.pushToast(`${syncQueue.conflicts.length} item(s) need your attention`, 'error')
      }
    }
  }

  window.addEventListener('online', trySync)
  stopWatchingOnline = () => window.removeEventListener('online', trySync)
  await trySync()
})

onUnmounted(() => {
  stopWatchingOnline?.()
})
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <ConflictBanner />
    <div v-if="!isOnline" class="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-medium text-warning-foreground">
      <span class="h-1.5 w-1.5 rounded-full bg-warning-foreground"></span>
      You're offline — changes are queued and will sync automatically when you reconnect.
    </div>

    <main class="min-h-0 flex-1 overflow-hidden">
      <RouterView />
    </main>

    <Toast />
    <ShortcutsHelp />
  </div>
</template>
