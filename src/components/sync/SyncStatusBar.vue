<script setup lang="ts">
import { computed } from 'vue'
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useUiStore } from '@/stores/useUiStore'

const syncQueue = useSyncQueueStore()
const ui = useUiStore()
const { isOnline } = useOnlineStatus()

const label = computed(() => {
  if (!isOnline.value) return 'Offline'
  if (syncQueue.isSyncing) return 'Syncing…'
  if (syncQueue.pendingCount > 0) return `${syncQueue.pendingCount} pending`
  return 'Synced'
})

const dotClass = computed(() => {
  if (!isOnline.value) return 'bg-muted-foreground'
  if (syncQueue.isSyncing) return 'bg-warning animate-pulse'
  if (syncQueue.pendingCount > 0) return 'bg-warning'
  return 'bg-success'
})
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      class="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
      :title="ui.simulatedOffline ? 'Click to go back online' : 'Click to simulate going offline'"
      @click="ui.toggleSimulatedOffline"
    >
      <span class="h-1.5 w-1.5 rounded-full" :class="dotClass" />
      {{ label }}
    </button>
  </div>
</template>
