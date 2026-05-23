# GetSorted — How It Works

> A developer's walkthrough of the logic, architecture, and design decisions inside `src/App.tsx`.
> For CSS/tokens/config, see `explanation-allinall.md`.

---

## The Problem

Every morning, you have 15 things to do. Some are on fire. Some can wait. Some are "maybe someday." Most people either keep a flat to-do list (overwhelming — everything looks equally urgent) or over-engineer a system they abandon by lunch.

GetSorted solves this by forcing a simple, spatial decision: **where do I put this?** Three columns. Drag to re-prioritize. No folders, no tags, no due dates. The UI *is* the priority model.

---

## Core Architecture Decision: One Flat Array

```ts
const [tasks, setTasks] = useState<Task[]>([])
```

Every task lives in a single array. There are no separate arrays per column. A task's column membership is just a field:

```ts
interface Task {
  id: string          // UUID — unique forever
  title: string       // whatever the user typed
  column: ColumnId    // 'now' | 'soon' | 'later' — the ONLY source of truth for position
  createdAt: number   // Date.now() timestamp for the "2 mins ago" label
}
```

### Why one array instead of three?

If we used three arrays — `nowTasks`, `soonTasks`, `laterTasks` — moving a task between columns would require removing from one array and adding to another. That's two state updates, two re-renders, and a brief moment where the task exists in neither (or both). With one array, a move is a single mutation: change `task.column` and reorder. One state update, one re-render. Atomic.

The columns derive their tasks at render time:

```tsx
tasks.filter(t => t.column === 'now')   // → what NOW column renders
tasks.filter(t => t.column === 'soon')  // → what SOON column renders
tasks.filter(t => t.column === 'later') // → what LATER column renders
```

`Array.filter()` creates new arrays on every render. This is cheap for small datasets (hundreds of tasks) and avoids the complexity of synchronizing multiple state slices.

---

## Component Tree

```
App (state owner)
├── Header
│   ├── <img> (logo)
│   ├── <input> (controlled, tied to `input` state)
│   └── <button> (Add → fires addTask)
│
└── Board
    └── DragDropContext (onDragEnd → fires the reorder algorithm)
        ├── Column[now]
        │   └── Droppable("now")
        │       └── TaskCard[] (Draggable each, indexed 0..n)
        ├── Column[soon]
        │   └── Droppable("soon")
        │       └── TaskCard[]
        └── Column[later]
            └── Droppable("later")
                └── TaskCard[]
```

**State flows down.** `App` owns `tasks` and `input`. All mutations (`addTask`, `deleteTask`, `onDragEnd`) live in `App` and are passed down as props. No child component ever mutates state directly.

---

## The Three Mutations

### 1. Creating a Task (`addTask`)

```ts
const addTask = useCallback(() => {
  const title = input.trim()
  if (!title) return                          // guard: empty input → noop

  const task: Task = {
    id: uuidv4(),                             // crypto-random, collision-proof
    title,
    column: 'now',                            // always starts in NOW
    createdAt: Date.now(),                    // Unix ms timestamp
  }

  setTasks(prev => [...prev, task])           // append to end of array
  setInput('')                                // clear the input
}, [input])
```

**Key decisions:**
- New tasks always land in NOW. The philosophy: if you bothered to type it, it's probably urgent until proven otherwise. You can immediately drag it to SOON or LATER if not.
- `setTasks(prev => [...prev, task])` uses the functional updater form. `prev` is a guaranteed-fresh reference to the current state. The spread creates a new array (immutability — React won't re-render if the reference doesn't change).
- `uuidv4()` produces a version-4 UUID like `"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`. This is the task's permanent identity — used as the React `key`, the DnD `draggableId`, and the lookup key for deletions and moves.
- `Date.now()` returns milliseconds since Unix epoch. Stored as a number, not a `Date` object, because numbers are trivially comparable (`diff / 60_000`) and serializable.

The `[input]` dependency means `addTask` is recreated whenever the input text changes. This is necessary because `addTask` closes over `input` — if it were memoized with `[]`, it would forever capture the initial empty string.

---

### 2. Deleting a Task (`deleteTask`)

```ts
const deleteTask = useCallback((id: string) => {
  setTasks(prev => prev.filter(t => t.id !== id))
}, [])
```

No confirmation dialog. No undo stack. This is intentional: the cost of a mistaken deletion is a few keystrokes to retype the task. The benefit is zero friction — you swipe through your list deleting done items without a single modal interruption.

`Array.filter()` returns a new array excluding the matched ID. The empty dependency array `[]` is safe here because the callback doesn't close over any state — it receives the `id` as an argument and uses the functional updater internally.

---

### 3. Moving a Task (`onDragEnd`) — The Core Algorithm

This is where the app earns its name. Here's the full handler:

```ts
const onDragEnd = useCallback((result: DropResult) => {
  const { source, destination, draggableId } = result

  // Guard 1: dropped outside any column
  if (!destination) return

  // Guard 2: dropped in the exact same position
  if (
    source.droppableId === destination.droppableId &&
    source.index === destination.index
  ) return

  setTasks(prev => {
    const dragged = prev.find(t => t.id === draggableId)!
    const others = prev.filter(t => t.id !== draggableId)

    // Calculate the global insertion index
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
```

#### What `@hello-pangea/dnd` gives us

When a drag completes, the library calls `onDragEnd` with a `DropResult`:

| Field | Type | Meaning |
|---|---|---|
| `source.droppableId` | `string` | Which column the card was picked up from (`"now"`, `"soon"`, `"later"`) |
| `source.index` | `number` | The card's position within that column *before* the drag |
| `destination.droppableId` | `string \| null` | Which column it was dropped on (null = dropped outside) |
| `destination.index` | `number` | Where in the destination column it should land *after* removal from source |
| `draggableId` | `string` | The task's UUID — used to find it in the array |

Critical detail: **`destination.index` is already adjusted.** The library calculates this index as if the dragged item has been removed from the source. So if you drag the 3rd item from NOW to the 1st position in SOON, `destination.index` is `0`, not `1`. You don't need to manually account for the removal shift.

#### The insertion algorithm, step by step

Imagine this state:

```
Tasks array (global order):
  [A:now, B:now, C:soon, D:soon, E:later]
```

User drags `D` (index 1 in SOON) to NOW, slotting after `A` (index 1 in NOW).

**Step 1 — Find the dragged task and remove it:**

```ts
const dragged = prev.find(t => t.id === draggableId)!   // { id: 'D', column: 'soon', ... }
const others = prev.filter(t => t.id !== draggableId)   // [A:now, B:now, C:soon, E:later]
```

The `!` is a TypeScript non-null assertion. We know the task exists because we just dragged it. If somehow it didn't, the app would crash — which is the correct behavior (fail fast on a bug, don't silently corrupt state).

**Step 2 — Calculate the global insertion index:**

```ts
let insertAt = 0
for (const col of COLUMN_ORDER) {           // ['now', 'soon', 'later']
  if (col === destination.droppableId) {    // col === 'now' → yes, first iteration
    insertAt += destination.index           // insertAt = 0 + 1 = 1
    break
  }
  insertAt += others.filter(t => t.column === col).length
}
```

Here's the loop trace:

| Iteration | `col` | Match? | Action | `insertAt` |
|---|---|---|---|---|
| 1 | `'now'` | Yes (destination is NOW) | Add `destination.index` (1), break | 1 |

Result: `insertAt = 1`. This means "insert at index 1 in the global array," which lands after `A:now` and before `B:now`.

Let's do a cross-column move to see why the loop matters. Same starting state, but drag `A` (index 0 in NOW) to position 2 in LATER:

| Iteration | `col` | Match? | Action | `insertAt` |
|---|---|---|---|---|
| 1 | `'now'` | No | Add NOW count (B = 1 task) | 1 |
| 2 | `'soon'` | No | Add SOON count (C, D = 2 tasks) | 3 |
| 3 | `'later'` | Yes | Add `destination.index` (2), break | 5 |

`others` after removing `A`: `[B:now, C:soon, D:soon, E:later]`

Insert at index 2 in LATER = index 5 globally. After insertion: `[B:now, C:soon, D:soon, E:later, A:later, ...]`. Wait — that puts A at the end of LATER. But we said position 2 in LATER. Let me recheck...

Actually, position 2 means after the 2nd item. LATER currently has E at position 0. After removing A, E is still at position 0. Position 2 would be... but there's only 1 item in LATER after A's removal. This is valid because `destination.index` can exceed the current length — it means "append to end." The library allows this.

**Step 3 — Splice the task back in:**

```ts
others.splice(insertAt, 0, {
  ...dragged,
  column: destination.droppableId as ColumnId,   // update the column field
})
return others
```

`splice(index, 0, item)` inserts at `index` without deleting anything (the `0` means delete zero elements). The spread `...dragged` copies all existing fields, and `column: destination.droppableId` overrides just the column assignment.

The `as ColumnId` type assertion is safe because `destination.droppableId` can only be `"now"`, `"soon"`, or `"later"` — those are the only `droppableId` values we assign to `<Droppable>` components.

#### Why `[]` in the dependency array is correct

`onDragEnd` is wrapped in `useCallback` with `[]`. This means the function reference never changes across renders. This is safe because:

1. It doesn't close over any state — it uses the functional updater `setTasks(prev => ...)`
2. `DropResult` is passed as an argument, not captured from closure
3. `COLUMN_ORDER` is a module-level constant, not state

A stable function reference prevents unnecessary re-renders of `DragDropContext` (which would reset drag state mid-drag).

---

## The Render Props Pattern (DnD Library)

`@hello-pangea/dnd` uses the render props pattern — components that take a function as `children`:

```tsx
<Droppable droppableId="now">
  {(provided, snapshot) => (
    <div ref={provided.innerRef} {...provided.droppableProps}>
      {/* card list */}
      {provided.placeholder}
    </div>
  )}
</Droppable>
```

### `provided` — Infrastructure you MUST wire

| Property | Where it goes | Why |
|---|---|---|
| `provided.innerRef` | The container div's `ref` | The library uses this to measure the droppable's dimensions for auto-scrolling and drop target calculation |
| `provided.droppableProps` | Spread on the container div | Injects data attributes and event handlers that make the div a valid drop target |
| `provided.placeholder` | Rendered inside the droppable | A zero-height element that prevents the droppable from collapsing when all items are dragged out. Without it, the column would shrink to 0px and become impossible to drop into |

These are mandatory. If you forget `innerRef`, drag-and-drop silently fails. If you forget `placeholder`, empty columns become unusable drop targets.

### `snapshot` — Reactive drag state

| Field | Type | Meaning |
|---|---|---|
| `snapshot.isDraggingOver` | `boolean` | `true` when any draggable is currently hovering over this droppable |
| `snapshot.draggingOverWith` | `string \| null` | The `draggableId` of the item being dragged over (null if none) |
| `snapshot.draggingFromThisWith` | `string \| null` | The `draggableId` of an item that was picked up FROM this droppable |

We use `snapshot.isDraggingOver` to conditionally render the dashed drop-zone border:

```tsx
className={`... ${snapshot.isDraggingOver ? 'border-2 border-dashed ...' : ''}`}
```

This creates the visual cue: "this column is an active drop target."

### Draggable's `provided` — Drag handle pattern

```tsx
<Draggable draggableId={task.id} index={index}>
  {(provided, snapshot) => (
    <div ref={provided.innerRef} {...provided.draggableProps}>
      <div {...provided.dragHandleProps}>   {/* ← the grip icon */}
        ⋮⋮
      </div>
      {/* task content and delete button */}
    </div>
  )}
</Draggable>
```

By splitting `draggableProps` (on the whole card) from `dragHandleProps` (only on the grip), we create a **drag handle**: you can only initiate a drag by clicking the grip dots. Clicking the task text or the delete button won't trigger a drag. This is essential for UX — you need to be able to select text and click buttons without accidentally moving the card.

The `snapshot.isDragging` boolean lets us apply a "lifted" style while the card is in flight:
```tsx
className={`... ${snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag' : ''}`}
```

---

## The `getRelativeTime` Utility

```ts
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60_000)

  if (mins < 1) return 'Just now'           // < 60 seconds
  if (mins < 60) return `${mins} min...`     // 1–59 minutes
  // ...
}
```

This is called inside every `TaskCard` render. It computes "how long ago" on each render, not on a timer. This means the display doesn't auto-update from "2 mins ago" to "3 mins ago" — it updates when the component re-renders (which happens when tasks are added, moved, or deleted). For a task board, this is acceptable. Adding a `setInterval` for live timestamp updates would be wasteful — the resolution is minutes, not seconds.

The `60_000` is 60 × 1000 = 1 minute in milliseconds. The underscore is JavaScript's numeric separator — `60_000` is identical to `60000` but more readable.

---

## The Column Configuration Pattern

```ts
const COLUMNS = [
  { id: 'now',   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon',  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later', label: 'LATER', empty: 'No backlog. Rare.' },
]
```

This is a data-driven UI pattern. Instead of writing three `<Column>` components by hand, we `map()` over this config array. If we ever want to add a fourth column (e.g., "Done"), we add one object here and the entire UI updates — header, empty state, drag target, accent color — all from a single data change.

The `ColumnStyle` map (`columnStyles`) extends this pattern to styling. Each column ID maps to a set of Tailwind class strings:

```ts
const columnStyles: Record<ColumnId, ColumnStyle> = {
  now: {
    headerBg:   'bg-gs-now-header-bg',
    accent:     'border-gs-now-accent',
    // ...
  },
  // ...
}
```

Inside `Column`, we look up the style with `const s = columnStyles[column.id]` and interpolate the classes:

```tsx
<div className={`... ${s.headerBg}`}>   // resolves to "bg-gs-now-header-bg"
```

This avoids per-column `if/else` chains in the JSX and keeps the column component completely generic — it renders any column without knowing which one it is.

---

## Data Flow Diagram

```
User types "Buy milk" → press Enter
  │
  ▼
handleKeyDown(e) → if e.key === 'Enter' → addTask()
  │
  ▼
addTask() → uuidv4() → Date.now()
         → setTasks([...prev, { id, title: "Buy milk", column: "now", createdAt }])
         → setInput('')
  │
  ▼
React re-renders App with updated tasks array
  │
  ▼
Column[now] receives     tasks.filter(t => t.column === 'now')     → [{title: "Buy milk", ...}]
Column[soon] receives    tasks.filter(t => t.column === 'soon')    → []
Column[later] receives   tasks.filter(t => t.column === 'later')   → []
  │
  ▼
Each TaskCard becomes a <Draggable draggableId={task.id} index={0..n}>
  │
  ▼
User drags card from NOW (index 0) to SOON (index 0)
  │
  ▼
onDragEnd({ source: { droppableId: 'now', index: 0 },
             destination: { droppableId: 'soon', index: 0 },
             draggableId: 'abc-123' })
  │
  ▼
Algorithm: remove 'abc-123' from array → others = [all except it]
         → iterate COLUMN_ORDER → count tasks before SOON → add dest.index
         → splice into others at calculated position
         → setTasks(others) triggers re-render
  │
  ▼
Column[now] → empty (task moved out)
Column[soon] → [{title: "Buy milk", column: "soon"}]
Card renders with amber accent instead of red
```

---

## Design Decisions & Tradeoffs

### No persistence
State is purely in-memory. Refresh the page → everything resets. Why? Because GetSorted is a **triage tool for right now**, not a long-term project tracker. Adding `localStorage` persistence would be ~5 lines of code (`useEffect` + `JSON.stringify`), but it would introduce a contract: the data must survive across sessions, which means we'd need to handle data migration, corruption recovery, and stale data. By keeping it ephemeral, we keep the scope focused.

### No confirmation on delete
Deleting is instant. No "Are you sure?" dialog. This is a deliberate UX choice: the cost of an accidental deletion (retype the task) is lower than the cost of a confirmation dialog every time (interrupts flow). This is the same philosophy behind apps like Clear (the to-do app) and Things — frictionless deletion encourages you to actually remove completed items instead of letting them accumulate.

### Single input, shared across columns
There's no per-column input. You type into one field at the top, and it always goes to NOW. This enforces the workflow: dump everything into NOW first, then drag to triage. It prevents "analysis paralysis" at input time — you don't need to decide priority while typing, only while sorting.

### Controlled input with imperative focus styling
The input is a standard React controlled component (`value={input}` + `onChange`), but the focus/blur border colors are applied imperatively via `onFocus`/`onBlur` + `e.target.style`. This is because the focus color comes from a CSS variable (`--gs-input-focus`), and Tailwind v4 doesn't generate `focus:border-gs-input-focus` unless the color is explicitly configured in `@theme`. Since we sometimes use inline styles for CSS variable references, the imperative approach keeps things consistent.

### UUIDs over incremental IDs
Using `uuidv4()` instead of a counter (`tasks.length + 1`) or `crypto.randomUUID()` (the browser built-in) is a choice for portability. `uuid` works in all environments (Node, browsers, tests). `crypto.randomUUID()` would be fewer bytes but isn't available in all JS runtimes. The tradeoff is ~3KB of bundle size for a dependency that's proven and universal.
