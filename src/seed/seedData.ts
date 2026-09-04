import type { Board, Swimlane, Column, Label } from '@/types/Board'
import type { Card, ActivityEntry } from '@/types/Card'
import { getMeta, setMeta, putBoard, putSwimlane, putColumn, putLabel, putCard } from '@/db/indexedDb'

const SEED_FLAG = 'seeded-v1'

function id(prefix: string, n: number | string): string {
  return `${prefix}-seed-${n}`
}

function activity(type: ActivityEntry['type'], message: string, at: number): ActivityEntry {
  return { id: `act-${Math.random().toString(36).slice(2, 9)}`, type, message, createdAt: at }
}

const now = Date.now()
const day = 24 * 60 * 60 * 1000

/**
 * Populates IndexedDB with a handful of boards, columns, swimlanes, labels
 * and ~25 cards the first time the app loads, so the UI is never empty.
 * Guarded by a meta flag so it only ever runs once per browser profile.
 */
export async function ensureSeeded(): Promise<void> {
  const seeded = await getMeta<boolean>(SEED_FLAG)
  if (seeded) return

  const boards: Board[] = [
    { id: id('board', 1), name: 'Product Launch', description: 'Q3 website relaunch', color: '#8b5cf6', createdAt: now - 30 * day, archived: false },
    { id: id('board', 2), name: 'Engineering Sprint', description: 'Sprint 14 backlog', color: '#06b6d4', createdAt: now - 20 * day, archived: false },
    { id: id('board', 3), name: 'Marketing Calendar', description: 'Campaign planning', color: '#f97316', archived: false, createdAt: now - 10 * day },
  ]
  for (const b of boards) await putBoard(b)

  const swimlanes: Swimlane[] = []
  const columns: Column[] = []
  const labels: Label[] = []
  const cards: Card[] = []

  const columnNames = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']
  const laneNames = ['Default', 'Bugs']
  const labelDefs: [string, string][] = [
    ['bug', '#ef4444'],
    ['feature', '#22c55e'],
    ['design', '#a855f7'],
    ['urgent', '#f97316'],
    ['docs', '#0ea5e9'],
    ['chore', '#64748b'],
  ]

  const cardTitlesByBoard: Record<string, string[]> = {
    [boards[0].id]: [
      'Draft landing page copy',
      'Finalize hero illustration',
      'Set up analytics tracking',
      'Write launch announcement email',
      'QA checkout flow on mobile',
      'Configure CDN caching rules',
      'Record product demo video',
      'Coordinate press embargo list',
      'Localize pricing page (ES/FR)',
      'Fix broken footer links',
    ],
    [boards[1].id]: [
      'Migrate auth service to JWT',
      'Fix flaky CI test suite',
      'Add rate limiting to API gateway',
      'Refactor billing module',
      'Investigate memory leak in worker',
      'Upgrade Node runtime to 22',
      'Write integration tests for webhook',
      'Set up feature flag service',
      'Reduce bundle size below 250kb',
      'Patch XSS in comment renderer',
    ],
    [boards[2].id]: [
      'Plan September newsletter',
      'Design Instagram carousel ad',
      'Book podcast sponsorship slot',
      'A/B test signup CTA copy',
      'Draft customer case study',
      'Schedule webinar with sales team',
    ],
  }

  let cardCounter = 0
  for (const board of boards) {
    const boardLanes = laneNames.map((name, i) => ({
      id: id('lane', `${board.id}-${i}`),
      boardId: board.id,
      name,
      order: i,
    }))
    swimlanes.push(...boardLanes)

    const boardColumns = columnNames.map((name, i) => ({
      id: id('col', `${board.id}-${i}`),
      boardId: board.id,
      name,
      order: i,
      wipLimit: name === 'In Progress' ? 4 : null,
      createdAt: now - 30 * day,
    }))
    columns.push(...boardColumns)

    const boardLabels = labelDefs.map(([name, color]) => ({
      id: id('label', `${board.id}-${name}`),
      boardId: board.id,
      name,
      color,
    }))
    labels.push(...boardLabels)

    const titles = cardTitlesByBoard[board.id] ?? []
    titles.forEach((title, i) => {
      cardCounter++
      const column = boardColumns[i % boardColumns.length]
      const lane = boardLanes[i % 2 === 0 ? 0 : i % boardLanes.length]
      const priority = (['low', 'medium', 'high'] as const)[i % 3]
      const createdAt = now - (30 - i) * day
      const hasDueDate = i % 3 !== 2
      const dueDate = hasDueDate ? new Date(now + (i % 5 === 0 ? -2 : i) * day).toISOString().slice(0, 10) : null
      const done = column.name === 'Done'

      const card: Card = {
        id: id('card', cardCounter),
        boardId: board.id,
        columnId: column.id,
        swimlaneId: lane.id,
        title,
        description: `Details for "${title}". Add context, acceptance criteria, and links here.`,
        order: Math.floor(i / boardColumns.length),
        priority,
        labelIds: [boardLabels[i % boardLabels.length].id, ...(i % 4 === 0 ? [boardLabels[(i + 2) % boardLabels.length].id] : [])],
        checklist: [
          { id: `chk-${cardCounter}-1`, text: 'Confirm requirements', done: done || i % 2 === 0 },
          { id: `chk-${cardCounter}-2`, text: 'Get design/eng sign-off', done: done },
          { id: `chk-${cardCounter}-3`, text: 'Ship & verify', done: done },
        ],
        dueDate,
        comments:
          i % 3 === 0
            ? [{ id: `cmt-${cardCounter}-1`, author: 'Khalil', text: 'Picking this up next.', createdAt: createdAt + day }]
            : [],
        activity: [activity('created', `Created "${title}"`, createdAt)],
        attachmentIds: [],
        createdAt,
        updatedAt: createdAt,
        archived: false,
        pendingSync: false,
      }
      cards.push(card)
    })
  }

  for (const lane of swimlanes) await putSwimlane(lane)
  for (const col of columns) await putColumn(col)
  for (const label of labels) await putLabel(label)
  for (const card of cards) await putCard(card)

  await setMeta(SEED_FLAG, true)
}
