<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Column, Label } from '@/types/Board'
import type { Card } from '@/types/Card'
import CardTile from '@/components/board/CardTile.vue'

const props = defineProps<{
  column: Column
  cards: Card[]
  labels: Label[]
  swimlaneId: string
  draggingCardId: string | null
}>()

const emit = defineEmits<{
  'drag-start': [cardId: string]
  'drag-end': []
  drop: [columnId: string, swimlaneId: string, index: number]
  'quick-add': [columnId: string, swimlaneId: string, title: string]
}>()

const isDragOver = ref(false)
const showQuickAdd = ref(false)
const quickAddTitle = ref('')

const sortedCards = computed(() => [...props.cards].sort((a, b) => a.order - b.order))
const overWipLimit = computed(() => props.column.wipLimit !== null && sortedCards.value.length > props.column.wipLimit)

function onDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(event: DragEvent, index: number) {
  event.preventDefault()
  isDragOver.value = false
  emit('drop', props.column.id, props.swimlaneId, index)
}

function submitQuickAdd() {
  const title = quickAddTitle.value.trim()
  if (!title) {
    showQuickAdd.value = false
    return
  }
  emit('quick-add', props.column.id, props.swimlaneId, title)
  quickAddTitle.value = ''
}
</script>

<template>
  <div
    class="flex w-72 shrink-0 flex-col rounded-lg bg-secondary/60"
    :class="{ 'drag-over': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop($event, sortedCards.length)"
  >
    <div class="flex items-center justify-between px-3 pt-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-secondary-foreground">{{ column.name }}</h3>
        <span class="rounded-full bg-background px-1.5 py-0.5 text-xs text-muted-foreground">{{ sortedCards.length }}</span>
      </div>
      <span v-if="column.wipLimit" class="text-xs" :class="overWipLimit ? 'font-semibold text-destructive' : 'text-muted-foreground'">
        WIP {{ sortedCards.length }}/{{ column.wipLimit }}
      </span>
    </div>

    <div class="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      <template v-for="(card, index) in sortedCards" :key="card.id">
        <div
          class="h-1.5 rounded transition-colors"
          :class="{ 'bg-primary/40': isDragOver && draggingCardId && draggingCardId !== card.id }"
          @dragover.stop="onDragOver"
          @drop.stop="onDrop($event, index)"
        ></div>
        <CardTile
          :card="card"
          :labels="labels"
          @dragstart="emit('drag-start', card.id)"
          @dragend="emit('drag-end')"
        />
      </template>

      <div class="h-1.5 rounded" @dragover.stop="onDragOver" @drop.stop="onDrop($event, sortedCards.length)"></div>

      <form v-if="showQuickAdd" class="space-y-2" @submit.prevent="submitQuickAdd">
        <textarea
          v-model="quickAddTitle"
          rows="2"
          autofocus
          placeholder="Card title…"
          class="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          @keydown.enter.exact.prevent="submitQuickAdd"
          @keydown.esc="showQuickAdd = false"
        ></textarea>
        <div class="flex items-center gap-2">
          <button type="submit" class="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90">Add card</button>
          <button type="button" class="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted" @click="showQuickAdd = false">Cancel</button>
        </div>
      </form>
      <button
        v-else
        class="rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-background hover:text-foreground"
        @click="showQuickAdd = true"
      >
        + Add a card
      </button>
    </div>
  </div>
</template>
