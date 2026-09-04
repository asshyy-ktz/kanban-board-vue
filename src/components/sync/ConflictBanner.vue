<script setup lang="ts">
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
import { useCardsStore } from '@/stores/useCardsStore'
import { useToast } from '@/composables/useToast'

const syncQueue = useSyncQueueStore()
const cards = useCardsStore()
const toast = useToast()

async function keepLocal(id: string) {
  await syncQueue.resolveKeepLocal(id)
  await cards.refreshFromDb()
  toast.success('Kept your local change')
}

async function acceptRemote(id: string) {
  await syncQueue.resolveAcceptRemote(id)
  await cards.refreshFromDb()
  toast.info('Accepted the remote version')
}
</script>

<template>
  <div v-if="syncQueue.conflicts.length > 0" class="border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900 dark:bg-amber-950">
    <div v-for="conflict in syncQueue.conflicts" :key="conflict.id" class="flex flex-wrap items-center justify-between gap-2 py-1">
      <div class="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
        <span>⚠️</span>
        <span>{{ conflict.reason }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
          @click="keepLocal(conflict.id)"
        >
          Keep my change
        </button>
        <button
          class="rounded-md px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
          @click="acceptRemote(conflict.id)"
        >
          Accept remote
        </button>
      </div>
    </div>
  </div>
</template>
