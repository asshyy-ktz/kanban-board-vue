# Kanban Board (Vue 3 + TypeScript)

An offline-first, multi-board Kanban app: drag-and-drop cards and columns, per-card
detail panels (checklist, labels, due dates, blob attachments, comments, activity
log), swimlanes and filters, keyboard shortcuts, and an offline action queue with
conflict resolution — all backed by IndexedDB so the app is fully usable without a
network connection.

## Tech stack

- **Vue 3** (`<script setup>`, Composition API) + **TypeScript**
- **Vite** for dev/build tooling
- **Pinia** (setup-store style) for state
- **Vue Router 4** for `/` (board list) and `/boards/:boardId` (single board)
- **IndexedDB** via [`idb`](https://github.com/jakearchibald/idb) for offline-first
  persistence, including attachment blobs
- **VueUse** for dark mode (`useDark`), persisted UI state (`useStorage`), and the
  global `?` shortcut (`useMagicKeys` + `whenever`)
- **Tailwind CSS** with an HSL custom-property design system and a `.dark` variant

## Architecture

```
src/
  types/            Board, Card, Sync domain types (shared, no logic)
  db/indexedDb.ts    Thin typed wrapper around `idb` — one function per
                     store operation, no business logic
  seed/seedData.ts   One-time demo data seed (guarded by a `meta` flag)
  stores/            Pinia setup-stores — see "State management" below
  composables/       useOnlineStatus, useToast, useKeyboardShortcuts
  components/
    board/           ColumnLane, CardTile, FilterBar — board-canvas pieces
    card/            CardDetailPanel — the full card editor slide-over
    layout/          AppHeader
    shared/          Modal, Toast, ShortcutsHelp — generic UI primitives
    sync/            ConflictBanner, SyncStatusBar — offline-sync UI
  views/
    BoardListView.vue  Workspace: grid of boards, create-board flow
    BoardView.vue       Single board: swimlanes, columns, drag & drop,
                         filters, card detail panel
  router/            history-mode router, board list + board detail
  App.vue            Shell: online/offline banner, conflict banner,
                       toasts, shortcuts modal, global "?" shortcut
```

### State management

Responsibilities are split by *how often data changes* and *what it's keyed off
of*, not by feature:

- **`useBoardsStore`** — boards, swimlanes, columns, labels. This is the
  "structural" data a board is built from. Changes rarely (creating a column,
  renaming a board) relative to cards.
- **`useCardsStore`** — cards and everything embedded in a card (checklist,
  comments, activity log, attachment ids). Changes constantly (drag-and-drop,
  edits, checklist toggles), and every mutation is the thing that needs to be
  offline-queued.
- **`useSyncQueueStore`** — the offline action queue and conflict list. Doesn't
  know about UI; `useCardsStore` calls `enqueue()` when a write happens while
  offline, and `App.vue` calls `flush()` when connectivity returns.
- **`useUiStore`** — cross-cutting UI/view state: dark mode, board/list layout
  toggle, active card id, toasts, filters, the simulated-offline flag.

Splitting boards from cards keeps card writes (the hot path, and the one that
needs sync-queue instrumentation) independent from board-structure writes, and
keeps both stores small enough to reason about in isolation.

## IndexedDB schema

Database `kanban-board-db`, version 1, opened once via a module-level singleton
(`getDb()` in `src/db/indexedDb.ts`):

| Store | Key | Indexes | Notes |
|---|---|---|---|
| `boards` | `id` | `by-createdAt` | |
| `swimlanes` | `id` | `by-board` | |
| `columns` | `id` | `by-board` | |
| `labels` | `id` | `by-board` | |
| `cards` | `id` | `by-board`, `by-column` | includes embedded checklist, comments, activity, label/attachment id arrays |
| `attachments` | `id` | `by-card` | `blob: Blob` stored directly — IndexedDB natively supports Blob values, so files never touch the network or get base64-encoded |
| `syncQueue` | `id` | `by-createdAt` | pending/syncing/conflict actions, replayed on reconnect |
| `syncConflicts` | `id` | `by-detectedAt` | surfaced by the conflict banner |
| `meta` | `key` | — | misc flags, e.g. the one-time seed guard |

Every store read on app boot loads its full contents into the matching Pinia
store's reactive array (`init()` on each store); after that, all reads are from
memory and every write goes to both the in-memory array and IndexedDB in the same
function, so the UI never has to wait on IndexedDB round-trips.

## Offline-first / sync design

1. **Every write lands in IndexedDB immediately**, online or offline — there is
   no separate "sync" step for normal usage. `useCardsStore` and
   `useBoardsStore` mutate their local array, then `await put...()`.
2. **Offline detection** combines `navigator.onLine` with a manual
   "simulate offline" toggle (`useUiStore.simulatedOffline`, exposed via the
   status pill in `AppHeader` → `SyncStatusBar`) so the whole flow is
   demonstrable without physically disconnecting.
3. **While offline**, every card mutation additionally calls
   `useSyncQueueStore.enqueue()`, recording the action type
   (`create`/`update`/`move`/`delete`), a human-readable description, and a
   snapshot of the card payload. The queue itself is persisted to the
   `syncQueue` IndexedDB store, so it survives a reload.
4. **On reconnect** (`window`'s `online` event, checked in `App.vue`),
   `syncQueue.flush()` replays each pending action against a simulated
   "remote": a short delay stands in for a network round trip, and a random
   chance (plus a same-id-missing check) produces a conflict — mirroring a
   real backend returning `409 Conflict` because another collaborator changed
   the same card while this client was offline.
5. **Conflicts** are written to the `syncConflicts` store and rendered by
   `ConflictBanner` at the top of the app. Each conflict offers **Keep my
   change** (re-applies the locally-queued payload and clears `pendingSync`)
   or **Accept remote** (applies the simulated remote snapshot, or deletes the
   card if the simulated remote deleted it).
6. Cards with an unsynced local write are marked `pendingSync: true` and show
   a small amber dot in both the card tile and the detail panel until they
   sync or their conflict is resolved.

## Responsive layout

- **Board view** exposes a `board` (swimlanes with horizontally-scrolling
  columns — the classic Kanban canvas) and `list` layout (columns stacked
  full-width, one row per card) toggled from `FilterBar` or the `V` shortcut;
  `list` is the better fit on narrow/mobile viewports where horizontal
  drag-and-drop is awkward.
- The board list, filter bar, and card detail panel all reflow with Tailwind's
  responsive utilities (`sm:`/`lg:` grid columns, `w-full sm:w-[36rem]` for the
  detail panel, wrapping filter controls) rather than separate mobile
  components.
- The card detail panel renders as a full-width slide-over on small screens and
  a fixed-width side panel (`max-w-xl`/`sm:w-[36rem]`) on larger ones, always
  scrollable independently of the board behind it.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | Create a card in the first column/swimlane and open its detail panel |
| `/` | Focus the search field |
| `V` | Toggle board / list layout |
| `D` | Toggle dark mode |
| `Esc` | Close the open card detail panel or dialog |
| `Shift` + `?` | Open the keyboard shortcuts reference |

Shortcuts are ignored while typing in an input/textarea/contenteditable
(except `Esc`), via `useKeyboardShortcuts`.

## Dark mode

Handled by VueUse's `useDark`/`useToggle`, toggling a `.dark` class on
`<html>` and persisting the preference to `localStorage`. All colors are HSL
custom properties defined once in `src/style.css` (`:root` for light, `.dark`
for dark) and consumed through Tailwind's `theme.extend.colors`
(`bg-background`, `text-foreground`, `bg-card`, etc.), so no component branches
on dark mode directly.

## Getting started

```bash
npm install
npm run dev
```

No backend is required — all data lives in IndexedDB in the browser, seeded
with a handful of demo boards/cards on first load.
