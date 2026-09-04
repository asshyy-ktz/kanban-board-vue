export type SyncActionType = 'create' | 'update' | 'move' | 'delete'
export type SyncEntity = 'card' | 'column' | 'board'

export interface SyncAction {
  id: string
  entity: SyncEntity
  entityId: string
  type: SyncActionType
  description: string
  payload: Record<string, unknown> | null
  createdAt: number
  status: 'pending' | 'syncing' | 'conflict'
}

export interface SyncConflict {
  id: string
  action: SyncAction
  reason: string
  remoteSnapshot: Record<string, unknown> | null
  detectedAt: number
}
