<script setup lang="ts">
import { useUiStore } from '@/stores/useUiStore'
import Modal from '@/components/shared/Modal.vue'

const ui = useUiStore()

const shortcuts: { keys: string; description: string }[] = [
  { keys: 'N', description: 'Create a new card in the first column' },
  { keys: '/', description: 'Focus the search box' },
  { keys: 'V', description: 'Toggle board / list layout' },
  { keys: 'D', description: 'Toggle dark mode' },
  { keys: 'Esc', description: 'Close the open card or dialog' },
  { keys: 'Shift + ?', description: 'Show this shortcuts panel' },
]
</script>

<template>
  <Modal v-if="ui.shortcutsHelpOpen" title="Keyboard shortcuts" @close="ui.shortcutsHelpOpen = false">
    <ul class="divide-y divide-border">
      <li v-for="s in shortcuts" :key="s.keys" class="flex items-center justify-between px-5 py-3 text-sm">
        <span class="text-card-foreground">{{ s.description }}</span>
        <kbd class="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{{ s.keys }}</kbd>
      </li>
    </ul>
  </Modal>
</template>
