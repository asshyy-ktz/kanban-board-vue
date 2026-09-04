import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SyncAction, SyncActionType, SyncEntity, SyncConflict } from '@/types/Sync'
import {
  getSyncQueue,
  putSyncAction,
  deleteSyncAction,
  getSyncConflicts,
  putSyncConflict,
  deleteSyncConflict,
  putCard,
  deleteCardRecord,
} from '@/db/indexedDb'
import type { Card } from '@/types/Card'

function nextId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Queues card/column/board mutations performed while offline, persists the
 * queue to IndexedDB so it survives a reload, and replays it once the app
 * detects it is back online — surfacing a conflict banner when the
 * simulated "remote" state no longer matches what the queued action
 * expected (mirroring a real backend's 409 response).
 */
export const useSyncQueueStore = defineStore('syncQueue', () => {
  const queue = ref<SyncAction[]>([])
  const conflicts = ref<SyncConflict[]>([])
  const isLoaded = ref(false)
  const isSyncing = ref(false)

  const pendingCount = computed(() => queue.value.filter((a) => a.status === 'pending').length)

  async function init() {
    if (isLoaded.value) return
    queue.value = await getSyncQueue()
    conflicts.value = await getSyncConflicts()
    isLoaded.value = true
  }

  async function enqueue(entity: SyncEntity, entityId: string, type: SyncActionType, description: string, payload: Record<string, unknown> | null) {
    const action: SyncAction = {
      id: nextId(),
      entity,
      entityId,
      type,
      description,
      payload,
      createdAt: Date.now(),
      status: 'pending',
    }
    queue.value.push(action)
    await putSyncAction(action)
    return action
  }

  /**
   * Replays the queue against the current in-memory card list. This demo
   * has no real backend, so "remote state" is simulated: a random chance
   * per action produces a conflict, standing in for another collaborator
   * having changed the same card while this client was offline.
   */
  async function flush(getCards: () => Card[]) {
    if (isSyncing.value) return
    isSyncing.value = true
    try {
      const pending = queue.value.filter((a) => a.status === 'pending')
      for (const action of pending) {
        action.status = 'syncing'
        await new Promise((resolve) => setTimeout(resolve, 250))

        const stillExists = getCards().some((c) => c.id === action.entityId)
        const isConflict = Math.random() < 0.25 || (action.type !== 'create' && action.type !== 'delete' && !stillExists)

        if (!isConflict) {
          queue.value = queue.value.filter((a) => a.id !== action.id)
          await deleteSyncAction(action.id)

          if (action.entity === 'card' && action.payload && action.type !== 'delete') {
            const record = action.payload as unknown as Card
            record.pendingSync = false
            await putCard(record)
          }
        } else {
          action.status = 'conflict'
          await putSyncAction(action)

          const remoteSnapshot =
            action.entity === 'card' && action.payload
              ? { ...action.payload, title: `${action.payload.title as string} (edited elsewhere)` }
              : action.payload

          const conflict: SyncConflict = {
            id: `conflict-${action.id}`,
            action,
            reason: `"${action.description}" was changed elsewhere before this ${action.type} could sync.`,
            remoteSnapshot,
            detectedAt: Date.now(),
          }
          conflicts.value.push(conflict)
          await putSyncConflict(conflict)
        }
      }
    } finally {
      isSyncing.value = false
    }
  }

  /** Keep the local (queued) change — drop the conflict and clear the pending flag. */
  async function resolveKeepLocal(conflictId: string) {
    const conflict = conflicts.value.find((c) => c.id === conflictId)
    if (!conflict) return
    conflicts.value = conflicts.value.filter((c) => c.id !== conflictId)
    queue.value = queue.value.filter((a) => a.id !== conflict.action.id)
    await deleteSyncConflict(conflictId)
    await deleteSyncAction(conflict.action.id)

    if (conflict.action.entity === 'card' && conflict.action.payload && conflict.action.type !== 'delete') {
      const record = { ...conflict.action.payload, pendingSync: false } as unknown as Card
      await putCard(record)
    }
  }

  /** Discard the queued action and accept the simulated remote state. */
  async function resolveAcceptRemote(conflictId: string) {
    const conflict = conflicts.value.find((c) => c.id === conflictId)
    if (!conflict) return
    conflicts.value = conflicts.value.filter((c) => c.id !== conflictId)
    queue.value = queue.value.filter((a) => a.id !== conflict.action.id)
    await deleteSyncConflict(conflictId)
    await deleteSyncAction(conflict.action.id)

    if (conflict.action.type === 'delete') {
      return
    }
    if (conflict.action.entity === 'card') {
      if (conflict.remoteSnapshot) {
        const record = { ...conflict.remoteSnapshot, pendingSync: false } as unknown as Card
        await putCard(record)
      } else {
        await deleteCardRecord(conflict.action.entityId)
      }
    }
  }

  return {
    queue,
    conflicts,
    isLoaded,
    isSyncing,
    pendingCount,
    init,
    enqueue,
    flush,
    resolveKeepLocal,
    resolveAcceptRemote,
  }
})
