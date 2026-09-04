<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { Card } from '@/types/Card'
import { useBoardsStore } from '@/stores/useBoardsStore'
import { useCardsStore } from '@/stores/useCardsStore'
import { useUiStore } from '@/stores/useUiStore'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import AppHeader from '@/components/layout/AppHeader.vue'
import FilterBar from '@/components/board/FilterBar.vue'
import ColumnLane from '@/components/board/ColumnLane.vue'
import CardDetailPanel from '@/components/card/CardDetailPanel.vue'
import Modal from '@/components/shared/Modal.vue'

const props = defineProps<{ boardId: string }>()
const router = useRouter()

const boardsStore = useBoardsStore()
const cardsStore = useCardsStore()
const ui = useUiStore()

const board = computed(() => boardsStore.boards.find((b) => b.id === props.boardId))
const columns = computed(() => boardsStore.columnsForBoard(props.boardId))
const swimlanes = computed(() => boardsStore.swimlanesForBoard(props.boardId))

const draggingCardId = ref<string | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const showColumnForm = ref(false)
const newColumnName = ref('')
const showLaneForm = ref(false)
const newLaneName = ref('')

const dueThresholds = computed(() => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return { startOfToday, weekAhead: startOfToday + 7 * 24 * 60 * 60 * 1000 }
})

function matchesFilters(card: Card): boolean {
  if (card.archived) return false
  const query = ui.searchQuery.trim().toLowerCase()
  if (query && !card.title.toLowerCase().includes(query) && !card.description.toLowerCase().includes(query)) {
    return false
  }
  if (ui.labelFilter.length && !ui.labelFilter.some((id) => card.labelIds.includes(id))) {
    return false
  }
  if (ui.priorityFilter !== 'all' && card.priority !== ui.priorityFilter) {
    return false
  }
  if (ui.dueFilter !== 'all') {
    if (ui.dueFilter === 'none') {
      if (card.dueDate) return false
    } else if (!card.dueDate) {
      return false
    } else {
      const due = new Date(card.dueDate + 'T00:00:00').getTime()
      if (ui.dueFilter === 'overdue' && due >= dueThresholds.value.startOfToday) return false
      if (ui.dueFilter === 'week' && (due < dueThresholds.value.startOfToday || due > dueThresholds.value.weekAhead)) return false
    }
  }
  return true
}

const filteredCards = computed(() => cardsStore.cardsForBoard(props.boardId).filter(matchesFilters))

function cardsFor(columnId: string, swimlaneId: string): Card[] {
  return filteredCards.value.filter((c) => c.columnId === columnId && c.swimlaneId === swimlaneId)
}

function cardsForColumnAcrossLanes(columnId: string): Card[] {
  return filteredCards.value.filter((c) => c.columnId === columnId)
}

async function onDrop(columnId: string, swimlaneId: string, index: number) {
  const cardId = draggingCardId.value
  draggingCardId.value = null
  if (!cardId) return
  await cardsStore.moveCard(cardId, columnId, swimlaneId, index)
}

async function onQuickAdd(columnId: string, swimlaneId: string, title: string) {
  await cardsStore.createCard({ boardId: props.boardId, columnId, swimlaneId, title })
}

async function createColumn() {
  const name = newColumnName.value.trim()
  if (!name) {
    showColumnForm.value = false
    return
  }
  await boardsStore.createColumn(props.boardId, name)
  newColumnName.value = ''
  showColumnForm.value = false
}

async function createLane() {
  const name = newLaneName.value.trim()
  if (!name) {
    showLaneForm.value = false
    return
  }
  await boardsStore.createSwimlane(props.boardId, name)
  newLaneName.value = ''
  showLaneForm.value = false
}

function closeCard() {
  ui.closeCard()
}

// ---------- Keyboard shortcuts ----------
useKeyboardShortcuts({
  n: async () => {
    const firstColumn = columns.value[0]
    const firstLane = swimlanes.value[0]
    if (!firstColumn || !firstLane) return
    const card = await cardsStore.createCard({
      boardId: props.boardId,
      columnId: firstColumn.id,
      swimlaneId: firstLane.id,
      title: 'New card',
    })
    ui.openCard(card.id)
  },
  '/': (e) => {
    e.preventDefault()
    searchInput.value?.focus()
  },
  v: () => ui.toggleLayout(),
  d: () => ui.toggleDark(),
  escape: () => {
    if (ui.activeCardId) closeCard()
  },
})

watch(
  () => board.value,
  (value, oldValue) => {
    if (!value && oldValue === undefined && boardsStore.isLoaded) {
      router.replace('/')
    }
  },
  { immediate: true },
)

// Give FilterBar's search input a ref via DOM query since it lives in a child component.
watch(
  () => ui.searchQuery,
  () => {
    nextTick(() => {
      if (!searchInput.value) {
        searchInput.value = document.getElementById('board-search') as HTMLInputElement | null
      }
    })
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="board" class="flex h-full flex-col">
    <AppHeader :board-name="board.name" />
    <FilterBar :board-id="board.id" />

    <div class="min-h-0 flex-1 overflow-auto p-4">
      <div v-if="!columns.length" class="flex h-full items-center justify-center text-sm text-muted-foreground">
        No columns yet — add one to get started.
      </div>

      <!-- Board layout: swimlanes stacked, columns scroll horizontally within each -->
      <div v-else-if="ui.layout === 'board'" class="space-y-6">
        <section v-for="lane in swimlanes" :key="lane.id">
          <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ lane.name }}</h2>
          <div class="flex items-start gap-3 overflow-x-auto pb-2">
            <ColumnLane
              v-for="column in columns"
              :key="column.id"
              :column="column"
              :cards="cardsFor(column.id, lane.id)"
              :labels="boardsStore.labelsForBoard(board.id)"
              :swimlane-id="lane.id"
              :dragging-card-id="draggingCardId"
              @drag-start="(id) => (draggingCardId = id)"
              @drag-end="draggingCardId = null"
              @drop="onDrop"
              @quick-add="onQuickAdd"
            />

            <div class="w-72 shrink-0">
              <button
                v-if="!showColumnForm"
                class="w-full rounded-lg border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:border-primary hover:text-primary"
                @click="showColumnForm = true"
              >
                + Add column
              </button>
              <form v-else class="space-y-2 rounded-lg border border-border bg-card p-3" @submit.prevent="createColumn">
                <input
                  v-model="newColumnName"
                  autofocus
                  type="text"
                  placeholder="Column name…"
                  class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  @keydown.esc="showColumnForm = false"
                />
                <div class="flex gap-2">
                  <button type="submit" class="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">Add</button>
                  <button type="button" class="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted" @click="showColumnForm = false">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <div>
          <button
            v-if="!showLaneForm"
            class="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            @click="showLaneForm = true"
          >
            + Add swimlane
          </button>
          <form v-else class="flex max-w-xs gap-2" @submit.prevent="createLane">
            <input
              v-model="newLaneName"
              autofocus
              type="text"
              placeholder="Swimlane name…"
              class="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              @keydown.esc="showLaneForm = false"
            />
            <button type="submit" class="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">Add</button>
          </form>
        </div>
      </div>

      <!-- List layout: one column per row, full width, swimlanes ignored for compactness -->
      <div v-else class="space-y-4">
        <section v-for="column in columns" :key="column.id" class="rounded-lg border border-border bg-card">
          <header class="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 class="text-sm font-semibold text-card-foreground">{{ column.name }}</h3>
            <span class="text-xs text-muted-foreground">{{ cardsForColumnAcrossLanes(column.id).length }} cards</span>
          </header>
          <ul class="divide-y divide-border">
            <li
              v-for="card in cardsForColumnAcrossLanes(column.id)"
              :key="card.id"
              class="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-secondary"
              @click="ui.openCard(card.id)"
            >
              <span class="flex items-center gap-2 truncate">
                <span v-if="card.pendingSync" class="text-warning" title="Not yet synced">●</span>
                {{ card.title }}
              </span>
              <span class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <span v-if="card.dueDate">📅 {{ card.dueDate }}</span>
                <span
                  class="rounded-full px-1.5 py-0.5 font-medium"
                  :class="{
                    'bg-sky-500/15 text-sky-600 dark:text-sky-400': card.priority === 'low',
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400': card.priority === 'medium',
                    'bg-rose-500/15 text-rose-600 dark:text-rose-400': card.priority === 'high',
                  }"
                >
                  {{ card.priority }}
                </span>
              </span>
            </li>
            <li v-if="!cardsForColumnAcrossLanes(column.id).length" class="px-4 py-3 text-xs text-muted-foreground">No cards.</li>
          </ul>
        </section>
      </div>
    </div>

    <CardDetailPanel v-if="ui.activeCardId" :card-id="ui.activeCardId" @close="closeCard" />
  </div>

  <div v-else class="flex h-full items-center justify-center">
    <Modal title="Board not found" width-class="max-w-sm" @close="router.push('/')">
      <div class="space-y-3 p-5 text-sm text-muted-foreground">
        <p>This board doesn't exist or was deleted.</p>
        <button class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" @click="router.push('/')">
          Back to boards
        </button>
      </div>
    </Modal>
  </div>
</template>
