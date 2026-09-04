export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Comment {
  id: string
  author: string
  text: string
  createdAt: number
}

export type ActivityType =
  | 'created'
  | 'moved'
  | 'renamed'
  | 'description'
  | 'checklist-add'
  | 'checklist-toggle'
  | 'checklist-remove'
  | 'label-add'
  | 'label-remove'
  | 'due-date'
  | 'comment'
  | 'attachment'
  | 'archived'

export interface ActivityEntry {
  id: string
  type: ActivityType
  message: string
  createdAt: number
}

export type Priority = 'low' | 'medium' | 'high'

export interface Card {
  id: string
  boardId: string
  columnId: string
  swimlaneId: string
  title: string
  description: string
  order: number
  priority: Priority
  labelIds: string[]
  checklist: ChecklistItem[]
  dueDate: string | null
  comments: Comment[]
  activity: ActivityEntry[]
  attachmentIds: string[]
  createdAt: number
  updatedAt: number
  archived: boolean
  /** True while this card only reflects a locally-queued, unsynced change. */
  pendingSync: boolean
}

export interface Attachment {
  id: string
  cardId: string
  name: string
  mimeType: string
  size: number
  blob: Blob
  createdAt: number
}
