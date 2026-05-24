import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type {
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd'
import { v4 as uuidv4 } from 'uuid'

type ColumnId = 'now' | 'soon' | 'later'

interface Task {
  id: string
  title: string
  column: ColumnId
  createdAt: number
}

const COLUMNS: { id: ColumnId; label: string; empty: string }[] = [
  { id: 'now', label: 'Now', empty: 'Nothing on fire. Nice.' },
  { id: 'soon', label: 'Soon', empty: 'Queue is clear.' },
  { id: 'later', label: 'Later', empty: 'Queue is clear.' },
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

const columnStyles: Record<ColumnId, ColumnStyle> = {
  now: {
    headerBg: 'bg-gs-now-header-bg',
    headerText: 'text-gs-now-header-text',
    colBg: 'bg-gs-now-col-bg',
    badgeBg: 'bg-gs-now-badge-bg',
    badgeText: 'text-gs-now-badge-text',
    accent: 'border-gs-now-accent',
    accentBorder: 'border-gs-now-accent/50',
  },
  soon: {
    headerBg: 'bg-gs-soon-header-bg',
    headerText: 'text-gs-soon-header-text',
    colBg: 'bg-gs-soon-col-bg',
    badgeBg: 'bg-gs-soon-badge-bg',
    badgeText: 'text-gs-soon-badge-text',
    accent: 'border-gs-soon-accent',
    accentBorder: 'border-gs-soon-accent/50',
  },
  later: {
    headerBg: 'bg-gs-later-header-bg',
    headerText: 'text-gs-later-header-text',
    colBg: 'bg-gs-later-col-bg',
    badgeBg: 'bg-gs-later-badge-bg',
    badgeText: 'text-gs-later-badge-text',
    accent: 'border-gs-later-accent',
    accentBorder: 'border-gs-later-accent/50',
  },
}

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

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem('gs-tasks')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [input, setInput] = useState('')
  const inputRef = useRef('')

  useEffect(() => {
    localStorage.setItem('gs-tasks', JSON.stringify(tasks))
  }, [tasks])

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
      <header className="shrink-0 gs-header">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <svg width="30" height="28" viewBox="0 0 30 36" fill="currentColor" className="gs-logo-svg">
              <circle cx="7" cy="6" r="3.5" />
              <circle cx="23" cy="6" r="3.5" />
              <circle cx="7" cy="18" r="3.5" />
              <circle cx="23" cy="18" r="3.5" />
              <circle cx="7" cy="30" r="3.5" opacity="0.5" />
              <circle cx="23" cy="30" r="3.5" opacity="0.5" />
            </svg>
            <h1 className="tracking-tight select-none gs-logo-text">
              GetSorted
            </h1>
          </div>
        </div>
      </header>

      <div className="w-full shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-6 flex gap-3">
          <label htmlFor="task-input" className="sr-only">Add a new task</label>
          <input
            id="task-input"
            type="text"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="What needs doing?"
            className="flex-1 px-4 outline-none rounded-lg font-medium gs-input"
          />
          <button
            onClick={addTask}
            className="rounded-lg font-bold transition-all hover:translate-y-[-1px] active:translate-y-[0px] shadow-sm hover:shadow-md gs-btn"
          >
            Add
          </button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pb-12">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

interface ColumnProps {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  onDelete: (id: string) => void
}

const Column = memo(function Column({ column, tasks, onDelete }: ColumnProps) {
  const s = columnStyles[column.id]

  return (
    <div className={`flex flex-col overflow-hidden gs-col gs-col-${column.id}`}>
      <div className="flex items-center shrink-0 px-4 gs-col-header">
        <h2 className="font-bold gs-col-header-text">
          {column.label}
        </h2>
        <span className="ml-auto flex items-center justify-center rounded-full font-semibold gs-badge">
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={column.id}>
        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col ${s.colBg} gs-col-body ${snapshot.isDraggingOver ? `border-2 border-dashed ${s.accentBorder}` : ''}`}
          >
            {tasks.length === 0 ? (
              <p className="text-center select-none gs-empty">
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
          style={{
            ...provided.draggableProps.style,
            '--card-accent': `var(--gs-${task.column}-accent)`,
          } as any}
          className={`group flex items-center select-none transition-colors cursor-grab gs-card ${snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag' : isHovered ? 'gs-card-hovered' : 'gs-card-idle'}`}
        >
          <div
            {...provided.dragHandleProps}
            role="button"
            aria-label={`Drag "${task.title}" to reorder`}
            tabIndex={0}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing gs-drag-handle"
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

          <div className="flex-1 min-w-0">
            <p className="truncate gs-card-title">
              {task.title}
            </p>
            <div className="flex items-center gs-card-meta">
              <svg
                aria-hidden="true"
                width="11"
                height="11"
                viewBox="0 0 11 11"
                fill="none"
                className="shrink-0 gs-clock-icon"
              >
                <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1" />
                <path d="M5.5 3v3l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span className="gs-timestamp">
                {getRelativeTime(task.createdAt)}
              </span>
            </div>
          </div>

          <button
            onClick={() => onDelete(task.id)}
            className="flex-shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity gs-delete-btn"
            aria-label="Delete task"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
