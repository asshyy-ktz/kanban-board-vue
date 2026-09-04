<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import type { Attachment } from '@/types/Card'
import { useCardsStore } from '@/stores/useCardsStore'
import { useBoardsStore } from '@/stores/useBoardsStore'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ cardId: string }>()
const emit = defineEmits<{ close: [] }>()

const cardsStore = useCardsStore()
const boardsStore = useBoardsStore()
const toast = useToast()

const card = computed(() => cardsStore.getById(props.cardId))
const labels = computed(() => (card.value ? boardsStore.labelsForBoard(card.value.boardId) : []))
const columns = computed(() => (card.value ? boardsStore.columnsForBoard(card.value.boardId) : []))

const titleDraft = ref(card.value?.title ?? '')
const descriptionDraft = ref(card.value?.description ?? '')
const editingTitle = ref(false)
const editingDescription = ref(false)

watch(
  () => card.value?.id,
  () => {
    titleDraft.value = card.value?.title ?? ''
    descriptionDraft.value = card.value?.description ?? ''
    editingTitle.value = false
    editingDescription.value = false
  },
)

async function commitTitle() {
  editingTitle.value = false
  const trimmed = titleDraft.value.trim()
  if (!card.value || !trimmed || trimmed === card.value.title) return
  await cardsStore.updateCard(card.value.id, { title: trimmed })
}

async function commitDescription() {
  editingDescription.value = false
  if (!card.value) return
  await cardsStore.updateCard(card.value.id, { description: descriptionDraft.value })
}

async function setPriority(priority: 'low' | 'medium' | 'high') {
  if (!card.value) return
  await cardsStore.updateCard(card.value.id, { priority })
}

async function setDueDate(value: string) {
  if (!card.value) return
  await cardsStore.updateCard(card.value.id, { dueDate: value || null })
}

async function setColumn(columnId: string) {
  if (!card.value) return
  await cardsStore.moveCard(card.value.id, columnId, card.value.swimlaneId, 0)
}

async function toggleLabel(labelId: string, labelName: string) {
  if (!card.value) return
  await cardsStore.toggleLabel(card.value.id, labelId, labelName)
}

// ---------- Checklist ----------
const newChecklistText = ref('')
const checklistProgress = computed(() => {
  if (!card.value) return { done: 0, total: 0, pct: 0 }
  const total = card.value.checklist.length
  const done = card.value.checklist.filter((i) => i.done).length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
})

async function addChecklistItem() {
  const text = newChecklistText.value.trim()
  if (!text || !card.value) return
  await cardsStore.addChecklistItem(card.value.id, text)
  newChecklistText.value = ''
}

// ---------- Comments ----------
const newComment = ref('')
async function addComment() {
  const text = newComment.value.trim()
  if (!text || !card.value) return
  await cardsStore.addComment(card.value.id, 'Khalil', text)
  newComment.value = ''
}

// ---------- Attachments ----------
const attachments = ref<Attachment[]>([])
const attachmentUrls = ref<Record<string, string>>({})
const fileInput = ref<HTMLInputElement | null>(null)

async function loadAttachments() {
  if (!card.value) {
    attachments.value = []
    return
  }
  attachments.value = await cardsStore.listAttachments(card.value.id)
  for (const url of Object.values(attachmentUrls.value)) URL.revokeObjectURL(url)
  attachmentUrls.value = {}
  for (const att of attachments.value) {
    if (att.mimeType.startsWith('image/')) {
      attachmentUrls.value[att.id] = URL.createObjectURL(att.blob)
    }
  }
}

watch(() => card.value?.id, loadAttachments, { immediate: true })

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || !card.value) return
  for (const file of Array.from(files)) {
    await cardsStore.addAttachment(card.value.id, file)
  }
  input.value = ''
  await loadAttachments()
}

async function removeAttachment(attachmentId: string, name: string) {
  if (!card.value) return
  await cardsStore.removeAttachment(card.value.id, attachmentId, name)
  await loadAttachments()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function archive() {
  if (!card.value) return
  await cardsStore.archiveCard(card.value.id)
  toast.info('Card archived')
  emit('close')
}

async function remove() {
  if (!card.value) return
  if (!confirm('Delete this card permanently?')) return
  await cardsStore.deleteCard(card.value.id)
  toast.success('Card deleted')
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end bg-black/50" @mousedown.self="emit('close')">
      <aside
        v-if="card"
        class="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card text-card-foreground shadow-2xl sm:w-[36rem]"
      >
        <header class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div class="min-w-0 flex-1">
            <input
              v-if="editingTitle"
              v-model="titleDraft"
              autofocus
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-lg font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              @blur="commitTitle"
              @keydown.enter="commitTitle"
              @keydown.esc="editingTitle = false"
            />
            <h2
              v-else
              class="cursor-text truncate rounded-md px-2 py-1 text-lg font-semibold hover:bg-secondary"
              @click="editingTitle = true"
            >
              {{ card.title }}
            </h2>
            <p v-if="card.pendingSync" class="mt-1 px-2 text-xs font-medium text-warning">● Not yet synced</p>
          </div>
          <button class="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close" @click="emit('close')">
            ✕
          </button>
        </header>

        <div class="flex-1 space-y-6 px-5 py-4">
          <!-- Meta row -->
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Column</label>
              <select
                :value="card.columnId"
                class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                @change="setColumn(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="col in columns" :key="col.id" :value="col.id">{{ col.name }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <select
                :value="card.priority"
                class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                @change="setPriority(($event.target as HTMLSelectElement).value as 'low' | 'medium' | 'high')"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Due date</label>
              <input
                type="date"
                :value="card.dueDate ?? ''"
                class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                @change="setDueDate(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <!-- Labels -->
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labels</h3>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="label in labels"
                :key="label.id"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs font-medium transition"
                :style="
                  card.labelIds.includes(label.id)
                    ? { backgroundColor: label.color, borderColor: label.color, color: 'white' }
                    : { borderColor: label.color, color: label.color }
                "
                @click="toggleLabel(label.id, label.name)"
              >
                {{ label.name }}
              </button>
              <span v-if="!labels.length" class="text-xs text-muted-foreground">No labels on this board yet.</span>
            </div>
          </div>

          <!-- Description -->
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
            <textarea
              v-if="editingDescription"
              v-model="descriptionDraft"
              rows="4"
              autofocus
              class="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              @blur="commitDescription"
              @keydown.esc="editingDescription = false"
            ></textarea>
            <p
              v-else
              class="min-h-[2.5rem] cursor-text whitespace-pre-wrap rounded-md px-3 py-2 text-sm hover:bg-secondary"
              :class="card.description ? 'text-card-foreground' : 'text-muted-foreground italic'"
              @click="editingDescription = true"
            >
              {{ card.description || 'Add a more detailed description…' }}
            </p>
          </div>

          <!-- Checklist -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Checklist
                <span v-if="checklistProgress.total">({{ checklistProgress.done }}/{{ checklistProgress.total }})</span>
              </h3>
            </div>
            <div v-if="checklistProgress.total" class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div class="h-full rounded-full bg-success transition-all" :style="{ width: checklistProgress.pct + '%' }"></div>
            </div>
            <ul class="space-y-1.5">
              <li v-for="item in card.checklist" :key="item.id" class="group flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="item.done"
                  class="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  @change="cardsStore.toggleChecklistItem(card.id, item.id)"
                />
                <span class="flex-1 text-sm" :class="item.done ? 'text-muted-foreground line-through' : 'text-card-foreground'">{{ item.text }}</span>
                <button
                  class="rounded p-1 text-xs text-muted-foreground opacity-0 hover:bg-secondary hover:text-destructive group-hover:opacity-100"
                  aria-label="Remove item"
                  @click="cardsStore.removeChecklistItem(card.id, item.id)"
                >
                  ✕
                </button>
              </li>
            </ul>
            <form class="mt-2 flex gap-2" @submit.prevent="addChecklistItem">
              <input
                v-model="newChecklistText"
                type="text"
                placeholder="Add a checklist item…"
                class="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="submit" class="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
                Add
              </button>
            </form>
          </div>

          <!-- Attachments -->
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</h3>
            <div v-if="attachments.length" class="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="att in attachments" :key="att.id" class="group relative overflow-hidden rounded-md border border-border">
                <img v-if="attachmentUrls[att.id]" :src="attachmentUrls[att.id]" :alt="att.name" class="h-20 w-full object-cover" />
                <div v-else class="flex h-20 w-full flex-col items-center justify-center gap-1 bg-secondary text-secondary-foreground">
                  <span class="text-lg">📎</span>
                </div>
                <div class="truncate bg-secondary px-1.5 py-1 text-[11px] text-secondary-foreground" :title="att.name">{{ att.name }}</div>
                <div class="px-1.5 pb-1 text-[10px] text-muted-foreground">{{ formatBytes(att.size) }}</div>
                <button
                  class="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100"
                  @click="removeAttachment(att.id, att.name)"
                >
                  ✕
                </button>
              </div>
            </div>
            <input ref="fileInput" type="file" multiple class="hidden" @change="onFilesSelected" />
            <button
              class="rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              @click="fileInput?.click()"
            >
              + Attach files
            </button>
          </div>

          <!-- Comments -->
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</h3>
            <ul class="space-y-3">
              <li v-for="comment in card.comments" :key="comment.id" class="rounded-md bg-secondary px-3 py-2 text-sm">
                <div class="mb-0.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span class="font-medium text-secondary-foreground">{{ comment.author }}</span>
                  <span>{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="text-secondary-foreground">{{ comment.text }}</p>
              </li>
              <li v-if="!card.comments.length" class="text-xs text-muted-foreground">No comments yet.</li>
            </ul>
            <form class="mt-2 flex gap-2" @submit.prevent="addComment">
              <input
                v-model="newComment"
                type="text"
                placeholder="Write a comment…"
                class="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="submit" class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                Comment
              </button>
            </form>
          </div>

          <!-- Activity -->
          <div>
            <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h3>
            <ul class="space-y-2 border-l border-border pl-3">
              <li v-for="entry in [...card.activity].reverse()" :key="entry.id" class="text-xs text-muted-foreground">
                <span class="text-card-foreground">{{ entry.message }}</span>
                <span class="ml-1.5">· {{ formatDate(entry.createdAt) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button class="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary" @click="archive">Archive</button>
          <button class="rounded-md px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10" @click="remove">Delete</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
