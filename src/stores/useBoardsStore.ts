import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Board, Swimlane, Column, Label } from '@/types/Board'
import {
  getAllBoards,
  putBoard,
  deleteBoardRecord,
  getAllSwimlanes,
  putSwimlane,
  deleteSwimlaneRecord,
  getAllColumns,
  putColumn,
  deleteColumnRecord,
  getAllLabels,
  putLabel,
  deleteLabelRecord,
} from '@/db/indexedDb'

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const LABEL_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

/**
 * Holds the structural entities of the workspace: boards, their swimlanes,
 * columns, and labels. Cards live in useCardsStore since they change far
 * more often and are keyed off these ids.
 */
export const useBoardsStore = defineStore('boards', () => {
  const boards = ref<Board[]>([])
  const swimlanes = ref<Swimlane[]>([])
  const columns = ref<Column[]>([])
  const labels = ref<Label[]>([])
  const isLoaded = ref(false)

  const activeBoards = computed(() => boards.value.filter((b) => !b.archived).sort((a, b) => a.createdAt - b.createdAt))

  async function init() {
    if (isLoaded.value) return
    boards.value = await getAllBoards()
    swimlanes.value = await getAllSwimlanes()
    columns.value = await getAllColumns()
    labels.value = await getAllLabels()
    isLoaded.value = true
  }

  function getById(id: string): Board | undefined {
    return boards.value.find((b) => b.id === id)
  }

  function columnsForBoard(boardId: string): Column[] {
    return columns.value.filter((c) => c.boardId === boardId).sort((a, b) => a.order - b.order)
  }

  function swimlanesForBoard(boardId: string): Swimlane[] {
    return swimlanes.value.filter((s) => s.boardId === boardId).sort((a, b) => a.order - b.order)
  }

  function labelsForBoard(boardId: string): Label[] {
    return labels.value.filter((l) => l.boardId === boardId)
  }

  async function createBoard(name: string, description: string, color: string): Promise<Board> {
    const board: Board = {
      id: nextId('board'),
      name,
      description,
      color,
      createdAt: Date.now(),
      archived: false,
    }
    boards.value.push(board)
    await putBoard(board)

    const defaultLane: Swimlane = { id: nextId('lane'), boardId: board.id, name: 'Default', order: 0 }
    swimlanes.value.push(defaultLane)
    await putSwimlane(defaultLane)

    const defaultColumns = ['To Do', 'In Progress', 'Done']
    for (let i = 0; i < defaultColumns.length; i++) {
      const col: Column = { id: nextId('col'), boardId: board.id, name: defaultColumns[i], order: i, wipLimit: null, createdAt: Date.now() }
      columns.value.push(col)
      await putColumn(col)
    }

    return board
  }

  async function updateBoard(id: string, patch: Partial<Board>) {
    const board = boards.value.find((b) => b.id === id)
    if (!board) return
    Object.assign(board, patch)
    await putBoard(board)
  }

  async function archiveBoard(id: string) {
    await updateBoard(id, { archived: true })
  }

  async function deleteBoard(id: string) {
    boards.value = boards.value.filter((b) => b.id !== id)
    await deleteBoardRecord(id)
    for (const col of columns.value.filter((c) => c.boardId === id)) {
      columns.value = columns.value.filter((c) => c.id !== col.id)
      await deleteColumnRecord(col.id)
    }
    for (const lane of swimlanes.value.filter((s) => s.boardId === id)) {
      swimlanes.value = swimlanes.value.filter((s) => s.id !== lane.id)
      await deleteSwimlaneRecord(lane.id)
    }
    for (const label of labels.value.filter((l) => l.boardId === id)) {
      labels.value = labels.value.filter((l) => l.id !== label.id)
      await deleteLabelRecord(label.id)
    }
  }

  async function createColumn(boardId: string, name: string): Promise<Column> {
    const order = columnsForBoard(boardId).length
    const column: Column = { id: nextId('col'), boardId, name, order, wipLimit: null, createdAt: Date.now() }
    columns.value.push(column)
    await putColumn(column)
    return column
  }

  async function updateColumn(id: string, patch: Partial<Column>) {
    const column = columns.value.find((c) => c.id === id)
    if (!column) return
    Object.assign(column, patch)
    await putColumn(column)
  }

  async function deleteColumn(id: string) {
    columns.value = columns.value.filter((c) => c.id !== id)
    await deleteColumnRecord(id)
  }

  async function reorderColumns(boardId: string, orderedIds: string[]) {
    orderedIds.forEach(async (id, index) => {
      const column = columns.value.find((c) => c.id === id && c.boardId === boardId)
      if (!column) return
      column.order = index
      await putColumn(column)
    })
  }

  async function createSwimlane(boardId: string, name: string): Promise<Swimlane> {
    const order = swimlanesForBoard(boardId).length
    const lane: Swimlane = { id: nextId('lane'), boardId, name, order }
    swimlanes.value.push(lane)
    await putSwimlane(lane)
    return lane
  }

  async function deleteSwimlane(id: string) {
    swimlanes.value = swimlanes.value.filter((s) => s.id !== id)
    await deleteSwimlaneRecord(id)
  }

  async function createLabel(boardId: string, name: string, color?: string): Promise<Label> {
    const usedColors = labelsForBoard(boardId).map((l) => l.color)
    const nextColor = color ?? LABEL_PALETTE.find((c) => !usedColors.includes(c)) ?? LABEL_PALETTE[labelsForBoard(boardId).length % LABEL_PALETTE.length]
    const label: Label = { id: nextId('label'), boardId, name, color: nextColor }
    labels.value.push(label)
    await putLabel(label)
    return label
  }

  async function deleteLabel(id: string) {
    labels.value = labels.value.filter((l) => l.id !== id)
    await deleteLabelRecord(id)
  }

  return {
    boards,
    swimlanes,
    columns,
    labels,
    isLoaded,
    activeBoards,
    init,
    getById,
    columnsForBoard,
    swimlanesForBoard,
    labelsForBoard,
    createBoard,
    updateBoard,
    archiveBoard,
    deleteBoard,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    createSwimlane,
    deleteSwimlane,
    createLabel,
    deleteLabel,
  }
})
