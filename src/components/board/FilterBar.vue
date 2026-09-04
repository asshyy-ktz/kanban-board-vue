<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/useUiStore'
import { useBoardsStore } from '@/stores/useBoardsStore'

const props = defineProps<{ boardId: string }>()

const ui = useUiStore()
const boardsStore = useBoardsStore()

const labels = computed(() => boardsStore.labelsForBoard(props.boardId))

const hasActiveFilters = computed(
  () => ui.searchQuery.trim() !== '' || ui.labelFilter.length > 0 || ui.dueFilter !== 'all' || ui.priorityFilter !== 'all',
)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
    <div class="relative">
      <input
        id="board-search"
        v-model="ui.searchQuery"
        type="search"
        placeholder="Search cards…"
        class="w-44 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
      />
    </div>

    <select v-model="ui.dueFilter" class="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
      <option value="all">Any due date</option>
      <option value="overdue">Overdue</option>
      <option value="week">Due this week</option>
      <option value="none">No due date</option>
    </select>

    <select v-model="ui.priorityFilter" class="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
      <option value="all">Any priority</option>
      <option value="high">High priority</option>
      <option value="medium">Medium priority</option>
      <option value="low">Low priority</option>
    </select>

    <div class="flex flex-wrap items-center gap-1">
      <button
        v-for="label in labels"
        :key="label.id"
        class="rounded-full border px-2 py-0.5 text-xs font-medium transition"
        :style="
          ui.labelFilter.includes(label.id)
            ? { backgroundColor: label.color, borderColor: label.color, color: 'white' }
            : { borderColor: label.color, color: label.color }
        "
        @click="ui.toggleLabelFilter(label.id)"
      >
        {{ label.name }}
      </button>
    </div>

    <button v-if="hasActiveFilters" class="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground" @click="ui.clearFilters">
      Clear filters
    </button>

    <button
      class="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium hover:bg-secondary"
      :class="{ 'ml-auto': !hasActiveFilters }"
      title="Toggle board / list layout (v)"
      @click="ui.toggleLayout"
    >
      {{ ui.layout === 'board' ? '☰ List view' : '▦ Board view' }}
    </button>
  </div>
</template>
