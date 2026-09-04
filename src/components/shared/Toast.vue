<script setup lang="ts">
import { useUiStore } from '@/stores/useUiStore'

const ui = useUiStore()

const variantClasses: Record<string, string> = {
  success: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
  info: 'bg-foreground text-background',
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
    <TransitionGroup name="toast">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="pointer-events-auto w-full max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
        :class="variantClasses[toast.variant]"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
