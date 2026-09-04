export interface Board {
  id: string
  name: string
  description: string
  color: string
  createdAt: number
  archived: boolean
}

export interface Swimlane {
  id: string
  boardId: string
  name: string
  order: number
}

export interface Column {
  id: string
  boardId: string
  name: string
  order: number
  wipLimit: number | null
  createdAt: number
}

export interface Label {
  id: string
  boardId: string
  name: string
  color: string
}
