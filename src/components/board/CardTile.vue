<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@/types/Card'
import type { Label } from '@/types/Board'
import { useUiStore } from '@/stores/useUiStore'

const props = defineProps<{ card: Card; labels: Label[] }>()
const emit = defineEmits<{ dragstart: [event: DragEvent]; dragend: [event: DragEvent] }>()

const ui = useUiStore()

const cardLabels = computed(() => props.labels.filter((l) => props.card.labelIds.includes(l.id)))

const checklistDone = computed(() => props.card.checklist.filter((i) => i.done).length)
const checklistTotal = computed(() => props.card.checklist.length)

const dueState = computed<'overdue' | 'soon' | 'normal' | null>(() => {
  if (!props.card.dueDate) return null
  const due = new Date(props.card.dueDate + 'T23:59:59').getTime()
  const now = Date.now()
  if (due < now) return 'overdue'
  if (due - now < 3 * 24 * 60 * 60 * 1000) return 'soon'
  return 'normal'
})

const priorityClasses: Record<string, string> = {
  low: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  high: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
}

function openDetail() {
  ui.openCard(props.card.id)
}
</script>

<template>
  <div
    class="group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition hover:shadow-md"
    :class="{ 'opacity-60': card.pendingSync }"
    draggable="true"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend', $event)"
    @click="openDetail"
  >
    <div v-if="cardLabels.length" class="mb-2 flex flex-wrap gap-1">
      <span
        v-for="label in cardLabels"
        :key="label.id"
        class="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
        :style="{ backgroundColor: label.color }"
      >
        {{ label.name }}
      </span>
    </div>

    <p class="text-sm font-medium leading-snug text-card-foreground">{{ card.title }}</p>

    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span class="rounded px-1.5 py-0.5 font-medium" :class="priorityClasses[card.priority]">{{ card.priority }}</span>

      <span v-if="checklistTotal > 0" class="flex items-center gap-1">
        ☑ {{ checklistDone }}/{{ checklistTotal }}
      </span>

      <span
        v-if="card.dueDate"
        class="flex items-center gap-1 rounded px-1.5 py-0.5"
        :class="{
          'bg-destructive/15 text-destructive': dueState === 'overdue',
          'bg-warning/20 text-warning-foreground dark:text-warning': dueState === 'soon',
        }"
      >
        📅 {{ card.dueDate }}
      </span>

      <span v-if="card.comments.length" class="flex items-center gap-1">💬 {{ card.comments.length }}</span>
      <span v-if="card.attachmentIds.length" class="flex items-center gap-1">📎 {{ card.attachmentIds.length }}</span>
      <span v-if="card.pendingSync" class="ml-auto flex items-center gap-1 text-[10px] italic">⏳ syncing</span>
    </div>
  </div>
</template>
