import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Card, ChecklistItem, Comment, ActivityEntry, ActivityType, Attachment } from '@/types/Card'
import {
  getAllCards,
  putCard,
  deleteCardRecord,
  putAttachment,
  getAttachmentsForCard,
  deleteAttachmentRecord,
} from '@/db/indexedDb'
import { useSyncQueueStore } from '@/stores/useSyncQueueStore'
import { useUiStore } from '@/stores/useUiStore'

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isEffectivelyOffline(): boolean {
  return !navigator.onLine || useUiStore().simulatedOffline
}

function activityEntry(type: ActivityType, message: string): ActivityEntry {
  return { id: nextId('act'), type, message, createdAt: Date.now() }
}

export interface CardInput {
  boardId: string
  columnId: string
  swimlaneId: string
  title: string
  description?: string
}

/**
 * Owns card CRUD, drag-and-drop moves, checklist/label/comment mutations,
 * and the per-card activity log. Every write lands in IndexedDB immediately
 * (offline-first) — when the browser is offline the write is additionally
 * queued in the sync queue so it can be replayed (and possibly flagged as a
 * conflict) once connectivity returns.
 */
export const useCardsStore = defineStore('cards', () => {
  const cards = ref<Card[]>([])
  const isLoaded = ref(false)

  async function init() {
    if (isLoaded.value) return
    cards.value = await getAllCards()
    isLoaded.value = true
  }

  function getById(id: string): Card | undefined {
    return cards.value.find((c) => c.id === id)
  }

  function cardsForBoard(boardId: string): Card[] {
    return cards.value.filter((c) => c.boardId === boardId && !c.archived)
  }

  async function persistAndQueue(card: Card, type: 'create' | 'update' | 'delete' | 'move', description: string) {
    card.updatedAt = Date.now()
    const offline = isEffectivelyOffline()
    card.pendingSync = offline || card.pendingSync
    await putCard(card)
    if (offline) {
      const sync = useSyncQueueStore()
      await sync.enqueue('card', card.id, type, description, type === 'delete' ? null : (card as unknown as Record<string, unknown>))
    }
  }

  async function createCard(input: CardInput): Promise<Card> {
    const now = Date.now()
    const columnCards = cards.value.filter((c) => c.columnId === input.columnId)
    const card: Card = {
      id: nextId('card'),
      boardId: input.boardId,
      columnId: input.columnId,
      swimlaneId: input.swimlaneId,
      title: input.title,
      description: input.description ?? '',
      order: columnCards.length,
      priority: 'medium',
      labelIds: [],
      checklist: [],
      dueDate: null,
      comments: [],
      activity: [activityEntry('created', 'Card created')],
      attachmentIds: [],
      createdAt: now,
      updatedAt: now,
      archived: false,
      pendingSync: isEffectivelyOffline(),
    }
    cards.value.push(card)
    await persistAndQueue(card, 'create', card.title)
    return card
  }

  async function updateCard(id: string, patch: Partial<Pick<Card, 'title' | 'description' | 'priority' | 'dueDate'>>) {
    const card = getById(id)
    if (!card) return
    if (patch.title !== undefined && patch.title !== card.title) {
      card.activity.push(activityEntry('renamed', `Renamed to "${patch.title}"`))
    }
    if (patch.description !== undefined && patch.description !== card.description) {
      card.activity.push(activityEntry('description', 'Description updated'))
    }
    if (patch.dueDate !== undefined && patch.dueDate !== card.dueDate) {
      card.activity.push(activityEntry('due-date', patch.dueDate ? `Due date set to ${patch.dueDate}` : 'Due date cleared'))
    }
    Object.assign(card, patch)
    await persistAndQueue(card, 'update', card.title)
  }

  async function deleteCard(id: string) {
    const card = getById(id)
    cards.value = cards.value.filter((c) => c.id !== id)
    await deleteCardRecord(id)
    if (card) {
      const offline = isEffectivelyOffline()
      if (offline) {
        const sync = useSyncQueueStore()
        await sync.enqueue('card', id, 'delete', card.title, null)
      }
    }
  }

  async function archiveCard(id: string) {
    const card = getById(id)
    if (!card) return
    card.archived = true
    card.activity.push(activityEntry('archived', 'Card archived'))
    await persistAndQueue(card, 'update', card.title)
  }

  async function restoreCard(id: string) {
    const card = getById(id)
    if (!card) return
    card.archived = false
    card.activity.push(activityEntry('created', 'Card restored'))
    await persistAndQueue(card, 'update', card.title)
  }

  /** Move a card to a (possibly different) column/swimlane and position, updating order of both source and target columns. */
  async function moveCard(cardId: string, targetColumnId: string, targetSwimlaneId: string, targetIndex: number) {
    const card = getById(cardId)
    if (!card) return
    const sourceColumnId = card.columnId
    const movedAcrossColumn = sourceColumnId !== targetColumnId

    card.columnId = targetColumnId
    card.swimlaneId = targetSwimlaneId

    const targetColumnCards = cards.value
      .filter((c) => c.columnId === targetColumnId && c.id !== cardId && !c.archived)
      .sort((a, b) => a.order - b.order)
    targetColumnCards.splice(targetIndex, 0, card)
    targetColumnCards.forEach((c, index) => {
      c.order = index
    })

    if (movedAcrossColumn) {
      card.activity.push(activityEntry('moved', 'Moved to another column'))
    }

    await Promise.all(targetColumnCards.map((c) => putCard(c)))

    if (movedAcrossColumn || isEffectivelyOffline()) {
      await persistAndQueue(card, 'move', card.title)
    }
  }

  async function reorderWithinColumn(columnId: string, orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const card = getById(id)
      if (card) card.order = index
    })
    await Promise.all(
      cards.value.filter((c) => c.columnId === columnId).map((c) => putCard(c)),
    )
  }

  // ---------- Labels ----------

  async function toggleLabel(cardId: string, labelId: string, labelName: string) {
    const card = getById(cardId)
    if (!card) return
    if (card.labelIds.includes(labelId)) {
      card.labelIds = card.labelIds.filter((id) => id !== labelId)
      card.activity.push(activityEntry('label-remove', `Removed label "${labelName}"`))
    } else {
      card.labelIds = [...card.labelIds, labelId]
      card.activity.push(activityEntry('label-add', `Added label "${labelName}"`))
    }
    await persistAndQueue(card, 'update', card.title)
  }

  // ---------- Checklist ----------

  async function addChecklistItem(cardId: string, text: string) {
    const card = getById(cardId)
    if (!card) return
    const item: ChecklistItem = { id: nextId('chk'), text, done: false }
    card.checklist.push(item)
    card.activity.push(activityEntry('checklist-add', `Added checklist item "${text}"`))
    await persistAndQueue(card, 'update', card.title)
  }

  async function toggleChecklistItem(cardId: string, itemId: string) {
    const card = getById(cardId)
    if (!card) return
    const item = card.checklist.find((i) => i.id === itemId)
    if (!item) return
    item.done = !item.done
    card.activity.push(activityEntry('checklist-toggle', `${item.done ? 'Checked' : 'Unchecked'} "${item.text}"`))
    await persistAndQueue(card, 'update', card.title)
  }

  async function removeChecklistItem(cardId: string, itemId: string) {
    const card = getById(cardId)
    if (!card) return
    const item = card.checklist.find((i) => i.id === itemId)
    card.checklist = card.checklist.filter((i) => i.id !== itemId)
    if (item) card.activity.push(activityEntry('checklist-remove', `Removed checklist item "${item.text}"`))
    await persistAndQueue(card, 'update', card.title)
  }

  // ---------- Comments ----------

  async function addComment(cardId: string, author: string, text: string) {
    const card = getById(cardId)
    if (!card) return
    const comment: Comment = { id: nextId('cmt'), author, text, createdAt: Date.now() }
    card.comments.push(comment)
    card.activity.push(activityEntry('comment', `${author} commented`))
    await persistAndQueue(card, 'update', card.title)
  }

  // ---------- Attachments ----------

  async function addAttachment(cardId: string, file: File): Promise<Attachment> {
    const card = getById(cardId)
    const attachment: Attachment = {
      id: nextId('att'),
      cardId,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: Date.now(),
    }
    await putAttachment(attachment)
    if (card) {
      card.attachmentIds.push(attachment.id)
      card.activity.push(activityEntry('attachment', `Attached "${file.name}"`))
      await persistAndQueue(card, 'update', card.title)
    }
    return attachment
  }

  async function listAttachments(cardId: string): Promise<Attachment[]> {
    return getAttachmentsForCard(cardId)
  }

  async function removeAttachment(cardId: string, attachmentId: string, name: string) {
    const card = getById(cardId)
    await deleteAttachmentRecord(attachmentId)
    if (card) {
      card.attachmentIds = card.attachmentIds.filter((id) => id !== attachmentId)
      card.activity.push(activityEntry('attachment', `Removed attachment "${name}"`))
      await persistAndQueue(card, 'update', card.title)
    }
  }

  async function refreshFromDb() {
    cards.value = await getAllCards()
  }

  return {
    cards,
    isLoaded,
    init,
    getById,
    cardsForBoard,
    createCard,
    updateCard,
    deleteCard,
    archiveCard,
    restoreCard,
    moveCard,
    reorderWithinColumn,
    toggleLabel,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    addComment,
    addAttachment,
    listAttachments,
    removeAttachment,
    refreshFromDb,
  }
})
