<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardsStore } from '@/stores/useBoardsStore'
import { useCardsStore } from '@/stores/useCardsStore'
import { useUiStore } from '@/stores/useUiStore'
import Modal from '@/components/shared/Modal.vue'

const router = useRouter()
const boards = useBoardsStore()
const cards = useCardsStore()
const ui = useUiStore()

const showCreate = ref(false)
const name = ref('')
const description = ref('')
const palette = ['#8b5cf6', '#06b6d4', '#f97316', '#22c55e', '#ec4899', '#3b82f6', '#ef4444', '#eab308']
const color = ref(palette[0])

function cardCount(boardId: string): number {
  return cards.cardsForBoard(boardId).length
}

function columnCount(boardId: string): number {
  return boards.columnsForBoard(boardId).length
}

async function submitCreate() {
  if (!name.value.trim()) return
  const board = await boards.createBoard(name.value.trim(), description.value.trim(), color.value)
  showCreate.value = false
  name.value = ''
  description.value = ''
  color.value = palette[0]
  ui.pushToast(`Board "${board.name}" created`, 'success')
  router.push({ name: 'board', params: { boardId: board.id } })
}

function openBoard(boardId: string) {
  router.push({ name: 'board', params: { boardId } })
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <header class="border-b border-border bg-card px-4 py-4 sm:px-6">
      <div class="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <h1 class="text-lg font-bold text-card-foreground">Your boards</h1>
          <p class="text-sm text-muted-foreground">{{ boards.activeBoards.length }} active workspace{{ boards.activeBoards.length === 1 ? '' : 's' }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-md p-2 text-muted-foreground hover:bg-muted"
            :aria-pressed="ui.isDark"
            title="Toggle dark mode"
            @click="ui.toggleDark()"
          >
            <span v-if="ui.isDark">☀️</span>
            <span v-else>🌙</span>
          </button>
          <button
            class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            @click="showCreate = true"
          >
            + New board
          </button>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div v-if="boards.activeBoards.length === 0" class="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        No boards yet. Create your first board to get started.
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="board in boards.activeBoards"
          :key="board.id"
          class="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          @click="openBoard(board.id)"
        >
          <div class="h-2" :style="{ backgroundColor: board.color }"></div>
          <div class="flex flex-1 flex-col gap-2 p-4">
            <h3 class="font-semibold text-card-foreground group-hover:text-primary">{{ board.name }}</h3>
            <p class="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{{ board.description || 'No description' }}</p>
            <div class="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
              <span>{{ columnCount(board.id) }} columns</span>
              <span>•</span>
              <span>{{ cardCount(board.id) }} cards</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <Modal v-if="showCreate" title="Create a new board" @close="showCreate = false">
      <form class="space-y-4 p-5" @submit.prevent="submitCreate">
        <div>
          <label class="mb-1 block text-xs font-medium text-muted-foreground">Board name</label>
          <input
            v-model="name"
            type="text"
            required
            autofocus
            placeholder="e.g. Product Launch"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            v-model="description"
            rows="2"
            placeholder="What is this board for?"
            class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          ></textarea>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-muted-foreground">Color</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in palette"
              :key="c"
              type="button"
              class="h-7 w-7 rounded-full border-2"
              :class="color === c ? 'border-foreground' : 'border-transparent'"
              :style="{ backgroundColor: c }"
              @click="color = c"
            ></button>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted" @click="showCreate = false">Cancel</button>
          <button type="submit" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Create board</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
