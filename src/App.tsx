// GetSorted — a drag-and-drop priority board for daily task triage.
// Component tree: App > Header + Board > Column[] > TaskCard[]
// State lives in App via useState<Task[]>. Drag-and-drop uses @hello-pangea/dnd.
// No persistence; all data is ephemeral in-memory state.
// All colours via CSS variables from tokens.css; no hardcoded hex values.

import { useState, useCallback, useRef, memo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type {
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd'
import { v4 as uuidv4 } from 'uuid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ColumnId = 'now' | 'soon' | 'later'

interface Task {
  id: string
  title: string
  column: ColumnId
  createdAt: number
}

// ---------------------------------------------------------------------------
// Column configuration
// ---------------------------------------------------------------------------

const COLUMNS = [
  { id: 'now' as const,   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon' as const,  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later' as const, label: 'LATER', empty: 'No backlog. Rare.' },
]

const COLUMN_ORDER = COLUMNS.map(col => col.id) as ColumnId[]

interface ColumnStyle {
  headerBg: string
  headerText: string
  colBg: string
  badgeBg: string
  badgeText: string
  accent: string
  accentBorder: string
}

function buildColumnStyle(id: ColumnId): ColumnStyle {
  return {
    headerBg:    `bg-gs-${id}-header-bg`,
    headerText:  `text-gs-${id}-header-text`,
    colBg:       `bg-gs-${id}-col-bg`,
    badgeBg:     `bg-gs-${id}-badge-bg`,
    badgeText:   `text-gs-${id}-badge-text`,
    accent:      `border-gs-${id}-accent`,
    accentBorder:`border-gs-${id}-accent/50`,
  }
}

const columnStyles: Record<ColumnId, ColumnStyle> = {
  now:   buildColumnStyle('now'),
  soon:  buildColumnStyle('soon'),
  later: buildColumnStyle('later'),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  const mins = Math.floor(diff / 60_000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

const MAX_TASKS = 500

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const inputRef = useRef('')

  const addTask = useCallback(() => {
    const title = inputRef.current.trim()
    if (!title) return
    if (tasks.length >= MAX_TASKS) return

    const task: Task = {
      id: uuidv4(),
      title,
      column: 'now',
      createdAt: Date.now(),
    }
    setTasks(prev => [...prev, task])
    setInput('')
    inputRef.current = ''
  }, [tasks.length])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    inputRef.current = value
    setInput(value)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') addTask()
    },
    [addTask],
  )

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const onDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return

    setTasks(prev => {
      const dragged = prev.find(t => t.id === draggableId)!
      const others = prev.filter(t => t.id !== draggableId)

      let insertAt = 0
      for (const col of COLUMN_ORDER) {
        if (col === (destination.droppableId as ColumnId)) {
          insertAt += destination.index
          break
        }
        insertAt += others.filter(t => t.column === col).length
      }

      others.splice(insertAt, 0, {
        ...dragged,
        column: destination.droppableId as ColumnId,
      })
      return others
    })
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gs-app-bg">
      <h1 className="sr-only">GetSorted — Task Board</h1>

      {/* ── Header ── */}
      <header
        className="flex items-center px-6 shrink-0"
        style={{
          height: 64,
          backgroundColor: 'var(--gs-header-bg)',
          borderBottom: '1px solid var(--gs-header-border)',
        }}
      >
        <img
          src="/logo-dark.svg"
          alt="GetSorted"
          height={36}
          style={{ display: 'block' }}
        />

        <div className="ml-auto flex items-center" style={{ gap: 8, marginRight: 24 }}>
          <label htmlFor="task-input" className="sr-only">Add a new task</label>
          <input
            id="task-input"
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="What needs doing?"
            className="px-4 outline-none rounded-lg text-[14px] font-medium"
            style={{
              width: 280,
              height: 38,
              backgroundColor: 'var(--gs-input-bg)',
              border: '1px solid var(--gs-input-border)',
              color: 'var(--gs-input-text)',
            }}
          />
          <button
            onClick={addTask}
            className="rounded-lg text-[14px] font-bold transition-opacity hover:opacity-90"
            style={{
              height: 38,
              padding: '0 18px',
              backgroundColor: 'var(--gs-btn-bg)',
              color: 'var(--gs-btn-text)',
            }}
          >
            Add
          </button>
        </div>
      </header>

      {/* ── Board ── */}
      <main className="flex-1" style={{ padding: '20px 24px' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
            {COLUMNS.map(col => (
              <Column
                key={col.id}
                column={col}
                tasks={tasks.filter(t => t.column === col.id)}
                onDelete={deleteTask}
              />
            ))}
          </div>
        </DragDropContext>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  onDelete: (id: string) => void
}

const Column = memo(function Column({ column, tasks, onDelete }: ColumnProps) {
  const s = columnStyles[column.id]

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--gs-col-bg)',
        borderRadius: 14,
        border: '1px solid var(--gs-col-border)',
      }}
    >
      {/* ── Column header ── */}
      <div
        className={`flex items-center shrink-0 px-4 ${s.headerBg}`}
        style={{ height: 48 }}
      >
        <h2
          className={`font-bold ${s.headerText}`}
          style={{ fontSize: 13, lineHeight: 1.25, letterSpacing: '0.08em' }}
        >
          {column.label}
        </h2>
        <span
          className={`ml-auto flex items-center justify-center rounded-full font-semibold ${s.badgeBg} ${s.badgeText}`}
          style={{ width: 22, height: 22, fontSize: 12, lineHeight: 1 }}
        >
          {tasks.length}
        </span>
      </div>

      {/* ── Column body ── */}
      <Droppable droppableId={column.id}>
        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col ${s.colBg} ${
              snapshot.isDraggingOver
                ? `border-2 border-dashed ${s.accentBorder}`
                : ''
            }`}
            style={{
              padding: 12,
              gap: 8,
              minHeight: 300,
              transition: 'border-color 0.2s',
            }}
          >
            {tasks.length === 0 ? (
              <p
                className="text-center select-none"
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: 'var(--gs-text-muted)',
                  paddingTop: 40,
                }}
              >
                {column.empty}
              </p>
            ) : (
              tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onDelete={onDelete}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
})

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task
  index: number
  onDelete: (id: string) => void
}

const TaskCard = memo(function TaskCard({ task, index, onDelete }: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          tabIndex={0}
          onMouseEnter={() => { if (!snapshot.isDragging) setIsHovered(true) }}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={() => setIsHovered(false)}
          className={`group flex items-center select-none transition-colors cursor-grab ${
            snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: snapshot.isDragging
              ? undefined
              : isHovered
                ? 'var(--gs-card-hover)'
                : 'var(--gs-card-bg)',
            border: '1px solid var(--gs-card-border)',
            borderLeftWidth: 3,
            borderLeftColor: `var(--gs-${task.column}-accent)`,
            borderRadius: 10,
            padding: '12px 14px',
            gap: 10,
            borderColor: isHovered && !snapshot.isDragging
              ? 'var(--gs-card-border-hover)'
              : 'var(--gs-card-border)',
          }}
        >
          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            role="button"
            aria-label={`Drag "${task.title}" to reorder`}
            tabIndex={0}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--gs-text-muted)' }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="4" cy="2" r="1.5" />
              <circle cx="10" cy="2" r="1.5" />
              <circle cx="4" cy="7" r="1.5" />
              <circle cx="10" cy="7" r="1.5" />
              <circle cx="4" cy="12" r="1.5" />
              <circle cx="10" cy="12" r="1.5" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className="truncate"
              style={{
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.55,
                color: 'var(--gs-text-primary)',
              }}
            >
              {task.title}
            </p>
            <div
              className="flex items-center"
              style={{ gap: 4, marginTop: 2 }}
            >
              {/* Clock icon */}
              <svg
                aria-hidden="true"
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <circle
                  cx="5.5" cy="5.5" r="4.5"
                  stroke="currentColor"
                  strokeWidth="1"
                  style={{ color: 'var(--gs-text-secondary)' }}
                />
                <path
                  d="M5.5 3v3l2 1"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  style={{ color: 'var(--gs-text-secondary)' }}
                />
              </svg>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  lineHeight: 1.4,
                  color: 'var(--gs-text-secondary)',
                }}
              >
                {getRelativeTime(task.createdAt)}
              </span>
            </div>
          </div>

          {/* Delete button */}
          <button
            onClick={() => onDelete(task.id)}
            className="flex-shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
            style={{ width: 22, height: 22, color: 'var(--gs-text-muted)' }}
            aria-label="Delete task"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path
                d="M4.5 4.5l5 5M9.5 4.5l-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </Draggable>
  )
}, (prev, next) =>
  prev.task.id === next.task.id &&
  prev.task.title === next.task.title &&
  prev.task.column === next.task.column &&
  prev.index === next.index
)

export default App
