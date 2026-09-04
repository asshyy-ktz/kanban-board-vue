<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    widthClass?: string
  }>(),
  { widthClass: 'max-w-lg' },
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10 sm:pt-16" @mousedown.self="emit('close')">
      <div class="w-full rounded-lg border border-border bg-card text-card-foreground shadow-xl" :class="widthClass">
        <div v-if="props.title" class="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 class="text-base font-semibold">{{ props.title }}</h2>
          <button class="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close" @click="emit('close')">
            ✕
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
