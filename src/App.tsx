// GetSorted — a drag-and-drop priority board for daily task triage.
// Component tree: App > InputBar + Board > Column[] > TaskCard[]
// State lives in App via useState<Task[]>. Drag-and-drop uses @hello-pangea/dnd.
// No persistence; all data is ephemeral in-memory state.

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
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

const COLUMNS: { id: ColumnId; label: string; accent: string; empty: string }[] = [
  { id: 'now',   label: 'NOW',   accent: '#E84545', empty: 'Nothing on fire. Nice.' },
  { id: 'soon',  label: 'SOON',  accent: '#F5A623', empty: 'Queue is clear.' },
  { id: 'later', label: 'LATER', accent: '#4A90D9', empty: 'No backlog. Rare.' },
]

const COLUMN_ORDER: ColumnId[] = ['now', 'soon', 'later']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
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

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')

  const addTask = useCallback(() => {
    const title = input.trim()
    if (!title) return
    const task: Task = {
      id: uuidv4(),
      title,
      column: 'now',
      createdAt: Date.now(),
    }
    setTasks(prev => [...prev, task])
    setInput('')
  }, [input])

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
    <div className="min-h-screen flex flex-col items-center px-4 py-10">
      <header className="mb-8">
        <img
          src="/logo-light.svg"
          alt="GetSorted"
          height={36}
          style={{ display: 'block' }}
        />
      </header>

      {/* ---- Input ---- */}
      <div className="w-full max-w-2xl flex gap-2 mb-10">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What needs doing?"
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-500 text-base"
        />
        <button
          onClick={addTask}
          className="px-6 py-3 rounded-lg bg-[#111111] text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Add
        </button>
      </div>

      {/* ---- Board ---- */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
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

function Column({ column, tasks, onDelete }: ColumnProps) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b bg-[#F5F5F0]"
        style={{ borderBottomColor: column.accent, borderBottomWidth: 3 }}
      >
        <h2
          className="text-sm font-bold tracking-wider"
          style={{ color: column.accent }}
        >
          {column.label}
        </h2>
        <span className="ml-auto text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Task list */}
      <Droppable droppableId={column.id}>
        {(provided: DroppableProvided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 p-3 space-y-2 min-h-[120px]"
          >
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-6 select-none">
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
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task
  index: number
  onDelete: (id: string) => void
}

function TaskCard({ task, index, onDelete }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group flex items-center gap-2 px-3 py-3 rounded-lg border border-gray-200 bg-white transition-colors select-none ${
            snapshot.isDragging ? 'border-gray-400' : ''
          }`}
        >
          {/* Drag handle */}
          <div
            {...provided.dragHandleProps}
            className="flex-shrink-0 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
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
            <p className="text-sm text-gray-800 truncate">{task.title}</p>
            <span className="text-xs text-gray-400">
              {getRelativeTime(task.createdAt)}
            </span>
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(task.id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Delete task"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </Draggable>
  )
}

export default App
