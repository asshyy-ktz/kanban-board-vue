<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useUiStore } from '@/stores/useUiStore'
import SyncStatusBar from '@/components/sync/SyncStatusBar.vue'

defineProps<{ boardName?: string }>()

const ui = useUiStore()
</script>

<template>
  <header class="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
    <div class="flex min-w-0 items-center gap-2 text-sm">
      <RouterLink to="/" class="flex shrink-0 items-center gap-1.5 font-semibold text-foreground">
        <span class="text-lg leading-none">🗂️</span>
        <span class="hidden sm:inline">Kanban</span>
      </RouterLink>
      <template v-if="boardName">
        <span class="text-muted-foreground">/</span>
        <span class="truncate font-medium text-foreground">{{ boardName }}</span>
      </template>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <SyncStatusBar />
      <button
        class="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        @click="ui.shortcutsHelpOpen = true"
      >
        ⌨️
      </button>
      <button
        class="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Toggle dark mode"
        aria-label="Toggle dark mode"
        @click="ui.toggleDark()"
      >
        {{ ui.isDark ? '☀️' : '🌙' }}
      </button>
    </div>
  </header>
</template>
