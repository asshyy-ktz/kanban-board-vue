import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Board, Swimlane, Column, Label } from '@/types/Board'
import type { Card, Attachment } from '@/types/Card'
import type { SyncAction, SyncConflict } from '@/types/Sync'

const DB_NAME = 'kanban-board-db'
const DB_VERSION = 1

interface KanbanDB extends DBSchema {
  boards: {
    key: string
    value: Board
    indexes: { 'by-createdAt': number }
  }
  swimlanes: {
    key: string
    value: Swimlane
    indexes: { 'by-board': string }
  }
  columns: {
    key: string
    value: Column
    indexes: { 'by-board': string }
  }
  labels: {
    key: string
    value: Label
    indexes: { 'by-board': string }
  }
  cards: {
    key: string
    value: Card
    indexes: { 'by-board': string; 'by-column': string }
  }
  attachments: {
    key: string
    value: Attachment
    indexes: { 'by-card': string }
  }
  syncQueue: {
    key: string
    value: SyncAction
    indexes: { 'by-createdAt': number }
  }
  syncConflicts: {
    key: string
    value: SyncConflict
    indexes: { 'by-detectedAt': number }
  }
  meta: {
    key: string
    value: { key: string; value: unknown }
  }
}

let dbPromise: Promise<IDBPDatabase<KanbanDB>> | null = null

export function getDb(): Promise<IDBPDatabase<KanbanDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KanbanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('boards')) {
          const store = db.createObjectStore('boards', { keyPath: 'id' })
          store.createIndex('by-createdAt', 'createdAt')
        }
        if (!db.objectStoreNames.contains('swimlanes')) {
          const store = db.createObjectStore('swimlanes', { keyPath: 'id' })
          store.createIndex('by-board', 'boardId')
        }
        if (!db.objectStoreNames.contains('columns')) {
          const store = db.createObjectStore('columns', { keyPath: 'id' })
          store.createIndex('by-board', 'boardId')
        }
        if (!db.objectStoreNames.contains('labels')) {
          const store = db.createObjectStore('labels', { keyPath: 'id' })
          store.createIndex('by-board', 'boardId')
        }
        if (!db.objectStoreNames.contains('cards')) {
          const store = db.createObjectStore('cards', { keyPath: 'id' })
          store.createIndex('by-board', 'boardId')
          store.createIndex('by-column', 'columnId')
        }
        if (!db.objectStoreNames.contains('attachments')) {
          const store = db.createObjectStore('attachments', { keyPath: 'id' })
          store.createIndex('by-card', 'cardId')
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' })
          store.createIndex('by-createdAt', 'createdAt')
        }
        if (!db.objectStoreNames.contains('syncConflicts')) {
          const store = db.createObjectStore('syncConflicts', { keyPath: 'id' })
          store.createIndex('by-detectedAt', 'detectedAt')
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

// ---------- Boards ----------

export async function putBoard(board: Board): Promise<void> {
  const db = await getDb()
  await db.put('boards', board)
}

export async function getAllBoards(): Promise<Board[]> {
  const db = await getDb()
  return db.getAll('boards')
}

export async function deleteBoardRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('boards', id)
}

// ---------- Swimlanes ----------

export async function putSwimlane(lane: Swimlane): Promise<void> {
  const db = await getDb()
  await db.put('swimlanes', lane)
}

export async function getAllSwimlanes(): Promise<Swimlane[]> {
  const db = await getDb()
  return db.getAll('swimlanes')
}

export async function deleteSwimlaneRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('swimlanes', id)
}

// ---------- Columns ----------

export async function putColumn(column: Column): Promise<void> {
  const db = await getDb()
  await db.put('columns', column)
}

export async function getAllColumns(): Promise<Column[]> {
  const db = await getDb()
  return db.getAll('columns')
}

export async function deleteColumnRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('columns', id)
}

// ---------- Labels ----------

export async function putLabel(label: Label): Promise<void> {
  const db = await getDb()
  await db.put('labels', label)
}

export async function getAllLabels(): Promise<Label[]> {
  const db = await getDb()
  return db.getAll('labels')
}

export async function deleteLabelRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('labels', id)
}

// ---------- Cards ----------

export async function putCard(card: Card): Promise<void> {
  const db = await getDb()
  await db.put('cards', card)
}

export async function putCards(cards: Card[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('cards', 'readwrite')
  await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done])
}

export async function getAllCards(): Promise<Card[]> {
  const db = await getDb()
  return db.getAll('cards')
}

export async function deleteCardRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('cards', id)
}

// ---------- Attachments ----------

export async function putAttachment(attachment: Attachment): Promise<void> {
  const db = await getDb()
  await db.put('attachments', attachment)
}

export async function getAttachmentsForCard(cardId: string): Promise<Attachment[]> {
  const db = await getDb()
  return db.getAllFromIndex('attachments', 'by-card', cardId)
}

export async function getAllAttachments(): Promise<Attachment[]> {
  const db = await getDb()
  return db.getAll('attachments')
}

export async function deleteAttachmentRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('attachments', id)
}

// ---------- Sync queue ----------

export async function putSyncAction(action: SyncAction): Promise<void> {
  const db = await getDb()
  await db.put('syncQueue', action)
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('syncQueue', 'by-createdAt')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function deleteSyncAction(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('syncQueue', id)
}

export async function putSyncConflict(conflict: SyncConflict): Promise<void> {
  const db = await getDb()
  await db.put('syncConflicts', conflict)
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('syncConflicts', 'by-detectedAt')
  return all.sort((a, b) => b.detectedAt - a.detectedAt)
}

export async function deleteSyncConflict(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('syncConflicts', id)
}

// ---------- Meta (seed flag, etc.) ----------

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return row?.value as T | undefined
}
