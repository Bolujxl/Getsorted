# Engineering Principles — GetSorted

---

## Single Responsibility Principle

**What it means**
Every function, component, or module should have exactly one reason to change — one job, one responsibility. If you describe what a piece of code does and have to use the word "and," it's probably doing too much.

**How GetSorted uses it**
Each function handles one operation (`addTask` creates, `deleteTask` removes, `onDragEnd` reorders) and each component handles one part of the UI (`Column` renders a column, `TaskCard` renders a card). No component mixes logic with presentation — event handlers are separate from render functions.

**Evidence**

`src/App.tsx` — lines 87–101
```ts
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
```
**Why it matters:** `getRelativeTime` only formats timestamps. If we change how "2 mins ago" is displayed (e.g., add seconds, switch to absolute dates), we edit one function. If this logic were inlined inside `TaskCard`, we'd have to find and edit every occurrence, and we'd risk the `TaskCard` component growing into a monolithic renderer.

`src/App.tsx` — lines 131–133
```ts
const deleteTask = useCallback((id: string) => {
  setTasks(prev => prev.filter(t => t.id !== id))
}, [])
```
**Why it matters:** `deleteTask` only removes a task from the array. It doesn't confirm, animate, or log — those would be separate responsibilities. If we ever add an undo stack, we modify this function without touching the UI layer.

`src/App.tsx` — lines 250–327 (Column component) and lines 339–465 (TaskCard component)
```tsx
function Column({ column, tasks, onDelete }: ColumnProps) { ... }
function TaskCard({ task, index, onDelete }: TaskCardProps) { ... }
```
**Why it matters:** Each component renders one conceptual piece of UI. If we change the column header layout, we edit `Column` and `TaskCard` stays untouched. If we change how timestamps display on cards, we edit `TaskCard` and `Column` is unaffected. This isolation means changes stay local — a change to the drag handle SVG doesn't risk breaking the column layout.

---

## Separation of Concerns

**What it means**
Different layers of the application handle different kinds of work. Structure (HTML), presentation (CSS), behaviour (JavaScript), and data (state) live in separate files or clearly separated sections. You don't mix paint colours with business logic.

**How GetSorted uses it**
Design values live in `tokens.css`, Tailwind bridging lives in `style.css`, all application logic and UI structure lives in `App.tsx`, and the document shell (meta tags, favicon) lives in `index.html`. No CSS values leak into JSX and no JSX logic leaks into CSS.

**Evidence**

`src/tokens.css` — lines 8–12
```css
:root {
  --gs-now-500:    #E84545;
  --gs-now-50:     #FFF0F0;
  --gs-now-200:    #FFB3B3;
  --gs-now-800:    #7A0E0E;
```
**Why it matters:** Raw colour hex codes exist in exactly one file (`tokens.css`). Components reference them by semantic name (`var(--gs-text-primary)`) via the `@theme` bridge in `style.css`. If the design team changes the app background from `#0F0F0F` to `#111111`, the change is one line in `tokens.css` — zero JSX files touched.

`src/style.css` — lines 4–7
```css
@theme {
  --color-gs-app-bg: var(--gs-app-bg);
  --color-gs-header-bg: var(--gs-header-bg);
```
**Why it matters:** This file is the adapter between raw design tokens and Tailwind's class system. It knows nothing about columns, cards, or task logic — it only knows "map token name X to utility class Y." The `App.tsx` file knows nothing about how those tokens are defined or what hex values they resolve to.

`src/main.tsx` — lines 1–10
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
**Why it matters:** The entry point's only job is mounting React. It imports the app and the styles, then renders. It has no task logic, no column config, no event handlers. If we ever switch from React to another framework, this is the only file that changes.

---

## Composition over Inheritance

**What it means**
Build complex things by combining simple things, not by creating parent-child class hierarchies. In React, this means composing functions and components — wrapping one component inside another rather than extending a base class.

**How GetSorted uses it**
Every component is a plain function. `App` composes `Column` + `Header`. `Column` composes `Droppable` + `TaskCard`. `TaskCard` is wrapped by `Draggable` from the external library. There are zero classes and zero `extends` keywords in the entire codebase.

**Evidence**

`src/App.tsx` — lines 166–237
```tsx
return (
  <div className="min-h-screen flex flex-col bg-gs-app-bg">
    <header ...>
      ...
    </header>
    <main ...>
      <DragDropContext onDragEnd={onDragEnd}>
        <div ...>
          {COLUMNS.map(col => (
            <Column key={col.id} column={col} tasks={...} onDelete={deleteTask} />
          ))}
        </div>
      </DragDropContext>
    </main>
  </div>
)
```
**Why it matters:** The `App` component doesn't extend anything — it assembles smaller components. Adding a fourth column means adding one entry to the `COLUMNS` array; the composition structure (`DragDropContext` wrapping a map of `Column` components) stays unchanged. If we used inheritance, adding a column might mean creating a new subclass that overrides behaviour, which is harder to trace and test.

`src/App.tsx` — lines 339–342
```tsx
function TaskCard({ task, index, onDelete }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
```
**Why it matters:** `TaskCard` doesn't inherit "draggable behaviour" from a parent class — it wraps itself in the `<Draggable>` component from the library. The library provides the drag capability; `TaskCard` provides the visual rendering. These are composed together, not merged through inheritance.

---

## Immutability

**What it means**
Never modify existing data in place. Instead, create a new copy with the desired changes. This prevents accidental side effects, makes state changes predictable, and enables React's rendering optimisations (it compares object references to decide if a re-render is needed).

**How GetSorted uses it**
Every state update creates a new array or object instead of mutating the existing one. `setTasks` always receives a brand-new array. Task objects are spread (`{...dragged}`) rather than modified in place.

**Evidence**

`src/App.tsx` — line 120
```ts
setTasks(prev => [...prev, task])
```
**Why it matters:** The spread operator `[...prev]` creates a new array. React's `useState` compares the old array reference to the new one. If we called `prev.push(task)` instead (mutation), the reference wouldn't change, React would skip the re-render, and the new task would never appear on screen.

`src/App.tsx` — line 132
```ts
setTasks(prev => prev.filter(t => t.id !== id))
```
**Why it matters:** `Array.filter()` returns a new array — it never mutates the original. If we used `splice` on the original array to remove the task, we'd be mutating React state directly, which leads to bugs where the UI and internal state disagree.

`src/App.tsx` — lines 157–159
```ts
others.splice(insertAt, 0, {
  ...dragged,
  column: destination.droppableId as ColumnId,
})
```
**Why it matters:** Though `splice` mutates `others`, `others` is already a copy (created via `filter` on line 146). The original `prev` array from state is never mutated. The spread `{...dragged, column: ...}` creates a new task object rather than writing `dragged.column = ...` which would modify the task in place.

---

## DRY (Don't Repeat Yourself)

**What it means**
Every piece of knowledge should have a single, authoritative representation. If a value or pattern appears in multiple places, extract it into a shared constant, function, or component. When the knowledge changes, you change one place, not twelve.

**How GetSorted uses it**
Column configuration is defined once in an array and rendered with `map()`. Per-column styling is defined once in a `Record` lookup. The `getRelativeTime` function is defined once and called everywhere timestamps need formatting. The `COLUMN_ORDER` array is used both for rendering and for the drag-and-drop insertion algorithm.

**Evidence**

`src/App.tsx` — lines 35–39 and 225
```ts
const COLUMNS: { id: ColumnId; label: string; empty: string }[] = [
  { id: 'now',   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon',  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later', label: 'LATER', empty: 'No backlog. Rare.' },
]
...
{COLUMNS.map(col => (
  <Column key={col.id} column={col} tasks={tasks.filter(t => t.column === col.id)} onDelete={deleteTask} />
))}
```
**Why it matters:** Without the `COLUMNS` array, we'd write three separate `<Column>` invocations with hardcoded `id`, `label`, and `empty` props — nine repeated pieces of data. Adding a fourth column would mean copying and pasting, which is how two of the three copies drift out of sync over time.

`src/App.tsx` — lines 53–81
```ts
const columnStyles: Record<ColumnId, ColumnStyle> = {
  now: {
    headerBg:    'bg-gs-now-header-bg',
    headerText:  'text-gs-now-header-text',
    colBg:       'bg-gs-now-col-bg',
    badgeBg:     'bg-gs-now-badge-bg',
    badgeText:   'text-gs-now-badge-text',
    accent:      'border-gs-now-accent',
    accentBorder:'border-gs-now-accent/50',
  },
  soon: { ... },
  later: { ... },
}
```
**Why it matters:** The `Column` component doesn't contain per-column `if (column === 'now') { ... }` branching. It does `const s = columnStyles[column.id]` (line 251) and interpolates `s.headerBg`, `s.headerText`, etc. Changing the NOW column's accent colour means editing one value in this map — not finding and updating six conditional branches in the JSX.

`src/App.tsx` — lines 41, 149
```ts
const COLUMN_ORDER: ColumnId[] = ['now', 'soon', 'later']
...
for (const col of COLUMN_ORDER) {
```
**Why it matters:** `COLUMN_ORDER` is used in both the rendering order (implicitly via `COLUMNS` array order) and the drag-and-drop insertion algorithm. If we ever reorder columns to "Soon, Now, Later," we change one array and both the visual layout and the insertion math update automatically.

---

## Unidirectional Data Flow

**What it means**
Data flows in one direction: parent components pass data down to children via props, and children communicate back up via callbacks. No child ever reaches up and directly modifies a parent's state. The flow forms a predictable cycle: state → render → event → update state → render again.

**How GetSorted uses it**
The `App` component is the sole state owner. It passes `tasks` down to `Column`, which passes individual tasks down to `TaskCard`. When a user clicks delete, `TaskCard` calls `onDelete(task.id)` — a callback that `App` passed down through `Column`. The callback runs `setTasks` in `App`, which triggers a re-render that flows fresh data back down.

**Evidence**

`src/App.tsx` — lines 108–109, 226–231
```ts
const [tasks, setTasks] = useState<Task[]>([])
const [input, setInput] = useState('')
...
<Column
  key={col.id}
  column={col}
  tasks={tasks.filter(t => t.column === col.id)}
  onDelete={deleteTask}
/>
```
**Why it matters:** State lives in `App` only. `Column` receives a filtered slice of `tasks` as a prop — it never calls `setTasks` itself. If data flow were bidirectional (children modifying parent state directly), debugging a "why did this task disappear?" bug would require checking every component. With unidirectional flow, you only check `App.tsx` for `setTasks` calls.

`src/App.tsx` — lines 444, 446–447
```tsx
<button
  onClick={() => onDelete(task.id)}
  ...
>
```
**Why it matters:** The `TaskCard` doesn't know what `onDelete` does. It just calls the callback with the task's ID. The actual deletion logic (`setTasks(prev => prev.filter(...))`) lives in `App`. If we ever replace deletion with archiving (moving to a "Trash" column), we change `deleteTask` in `App` and the `TaskCard` component stays exactly the same — it's still calling `onDelete(task.id)`.

---

## Declarative over Imperative

**What it means**
Declarative code describes *what* should happen, not *how* step by step. In React, JSX declares the UI structure and data transformations declare what to display — the framework figures out the DOM operations. Imperative code would manually create, append, and remove DOM elements.

**How GetSorted uses it**
The column layout is declared with `COLUMNS.map(col => <Column .../>)` — "render a Column for each entry in this array." The task filtering is declared with `tasks.filter(t => t.column === col.id)` — "give this column only the tasks that belong to it." No manual DOM manipulation, no `document.createElement`, no `appendChild`.

**Evidence**

`src/App.tsx` — lines 223–233
```tsx
<DragDropContext onDragEnd={onDragEnd}>
  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
    {COLUMNS.map(col => (
      <Column key={col.id} column={col} tasks={tasks.filter(t => t.column === col.id)} onDelete={deleteTask} />
    ))}
  </div>
</DragDropContext>
```
**Why it matters:** Adding a new task triggers a re-render, which re-runs the `map` and `filter` — the correct cards appear in the correct columns without any manual DOM rearrangement. An imperative equivalent would need to track which column each card's DOM node is in and physically move elements between containers on every drag.

`src/App.tsx` — lines 299–320
```tsx
{tasks.length === 0 ? (
  <p ...>{column.empty}</p>
) : (
  tasks.map((task, index) => (
    <TaskCard key={task.id} task={task} index={index} onDelete={onDelete} />
  ))
)}
```
**Why it matters:** The empty state vs. populated state is expressed as a conditional in JSX — "if there are no tasks, show the placeholder; otherwise, map over the tasks." The imperative alternative would be: "if tasks.length === 0, create a placeholder element and append it; else, remove the placeholder, loop through tasks, create card elements, append them" — more code, more bugs, more edge cases.

---

## Co-location

**What it means**
Keep code that changes together physically close together. When you need to understand or modify a feature, all related code should be within reach — ideally in the same file or a neighbouring file — rather than scattered across distant directories.

**How GetSorted uses it**
The entire application logic lives in `src/App.tsx`: types, configuration, helper functions, state management, and all three components. Design tokens are in `src/tokens.css` and their Tailwind bridge is in the adjacent `src/style.css`. The project has a flat structure — a single `src/` directory with no nested feature folders.

**Evidence**

`src/App.tsx` — lines 22–29 (types), 35–39 (config), 53–81 (styles lookup), 87–101 (helpers), 107–238 (App), 250–327 (Column), 339–465 (TaskCard)
```
src/App.tsx
  ├── lines 22–29   Types (ColumnId, Task)
  ├── lines 35–39   Column config (COLUMNS, COLUMN_ORDER)
  ├── lines 53–81   Style lookup (columnStyles)
  ├── lines 87–101  Helper (getRelativeTime)
  ├── lines 107–238 App component
  ├── lines 250–327 Column component
  └── lines 339–465 TaskCard component
```
**Why it matters:** To understand how a task gets from the input to the screen, a developer reads one file top to bottom — types, then config, then helpers, then components — without jumping between directories. If types were in `src/types/task.ts`, config in `src/config/columns.ts`, and components in separate files, tracing the data flow would require constantly switching tabs.

`src/style.css` — lines 1–2
```css
@import "tailwindcss";
@import "./tokens.css";
```
**Why it matters:** The CSS imports are adjacent — `style.css` is in the same directory as `tokens.css` and `App.tsx`. The design system files live where the developer expects to find them, not in a separate `styles/` or `theme/` directory that needs to be discovered.

---

## Lifting State Up

**What it means**
When multiple components need access to the same data, move that data to their closest common ancestor and pass it down via props. This is the React pattern for sharing state — no global variables, no singletons, just props flowing down from a shared parent.

**How GetSorted uses it**
`App` is the closest common ancestor of the input field, the drag context, every `Column`, and every `TaskCard`. All shared state (`tasks`, `input`) and all mutation callbacks (`addTask`, `deleteTask`, `onDragEnd`) are defined in `App` and passed down. No child component owns state that another sibling needs.

**Evidence**

`src/App.tsx` — lines 107–109
```ts
function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
```
**Why it matters:** `tasks` is needed by every `Column` (to filter by column) and `input` is needed by the Header's text field. If either were defined inside a child component, sibling components couldn't access them. Lifting both to `App` makes them available everywhere via props.

`src/App.tsx` — lines 230, 247, 317
```tsx
// App → Column  (line 230)
onDelete={deleteTask}

// Column props interface  (line 247)
onDelete: (id: string) => void

// Column → TaskCard  (line 317)
onDelete={onDelete}
```
**Why it matters:** `deleteTask` is defined in `App` (line 131) and drilled through two levels: `App` → `Column` → `TaskCard`. At each level, the component only knows it received a function called `onDelete` — it doesn't know or care what that function does. This is prop drilling, which is the natural consequence of lifting state up.

---

## Guard Clauses / Early Returns

**What it means**
Check for invalid or edge-case conditions at the top of a function and bail out immediately, rather than nesting the entire logic inside an `if` block. This keeps the "happy path" at the root indentation level and makes the code read linearly.

**How GetSorted uses it**
Every state mutation function begins with guard clauses. `addTask` bails if the input is empty. `onDragEnd` bails if the drop target is null or if the card didn't move. Hover handlers bail during active drags. No mutation logic is nested inside an `if` — the guard exits early.

**Evidence**

`src/App.tsx` — lines 112–113
```ts
const title = input.trim()
if (!title) return
```
**Why it matters:** Without this guard, pressing Enter on an empty input would create a task with an empty title — an invisible ghost card. The guard prevents the mutation from ever running. The rest of `addTask` (lines 114–121) is the happy path, at the root indentation level, un-nested.

`src/App.tsx` — lines 137–141
```ts
if (!destination) return
if (
  source.droppableId === destination.droppableId &&
  source.index === destination.index
)
  return
```
**Why it matters:** The first guard handles "dropped outside any column" (would crash on `destination.droppableId`). The second guard handles "picked up and put back in the same spot" (would trigger a pointless state update and re-render). The insertion algorithm (lines 144–162) only runs when a real move happened.

`src/App.tsx` — lines 362, 371
```ts
if (!snapshot.isDragging) {
  e.currentTarget.style.backgroundColor = 'var(--gs-card-hover)'
  ...
}
...
if (!snapshot.isDragging) {
  e.currentTarget.style.backgroundColor = 'var(--gs-card-bg)'
  ...
}
```
**Why it matters:** During an active drag, the DnD library controls the card's position via `transform`. If our hover handlers ran and changed `backgroundColor` or `borderColor` mid-drag, they'd fight with the library's post-drop transition animation. The guard ensures our visual logic and the library's drag logic never overlap.

---

## Single Source of Truth

**What it means**
Every piece of data has exactly one place where it is stored authoritatively. Derived values are computed on the fly, never stored separately. If a value appears to exist in two places and they disagree, you have a bug.

**How GetSorted uses it**
The `column` field on each `Task` object is the sole determinant of which column a task belongs to. Tasks are never stored in per-column arrays. The columns derive their task lists by filtering the single `tasks` array at render time — `tasks.filter(t => t.column === 'now')`. There is no `nowTasks` state slice that needs to be kept in sync.

**Evidence**

`src/App.tsx` — lines 24–29
```ts
interface Task {
  id: string
  title: string
  column: ColumnId
  createdAt: number
}
```
**Why it matters:** The `column` field on each task is the single source of truth for column membership. When `onDragEnd` updates `column` (line 159: `column: destination.droppableId`), every column's filtered list updates automatically on the next render. If we stored three separate arrays (`nowTasks`, `soonTasks`, `laterTasks`), moving a task would require two state updates (remove from one, add to another) and an intermediate render where the task is in neither — a classic "two sources of truth" bug.

`src/App.tsx` — line 229
```tsx
tasks={tasks.filter(t => t.column === col.id)}
```
**Why it matters:** Column membership is never stored — it's always computed. If a task's `column` field changes (via drag), the filter produces a different result on the next render. There's no "update the column's internal list" step because there is no internal list — only the one array and one filter.

---

## Design Tokens / Semantic Abstraction

**What it means**
Raw values (colours, sizes, fonts) are given meaningful names and referenced indirectly. Components never use a raw hex code or pixel value — they reference a token that describes *what the value is for*, not *what the value is*. This enables changing the entire visual theme by editing one file, with zero component changes.

**How GetSorted uses it**
`tokens.css` defines raw colour values and semantic role variables. `style.css` bridges those to Tailwind utility classes via `@theme`. `App.tsx` uses only Tailwind utility classes (like `bg-gs-card-bg`) or CSS variable references (like `var(--gs-text-primary)`). No hex code appears anywhere in `App.tsx` — `#E84545` exists only in `tokens.css`.

**Evidence**

`src/tokens.css` — lines 44–46, 63–65
```css
--gs-now-accent:  var(--gs-now-500);
...
--gs-text-primary:   #FFFFFF;
--gs-text-secondary: rgba(255,255,255,0.5);
--gs-text-muted:     rgba(255,255,255,0.25);
```
**Why it matters:** The raw hex values and opacity calculations live only in `tokens.css`. A designer can say "make all muted text slightly more visible" and the change is one `rgba` value in `tokens.css`, not a search-and-replace across every `style={{ color: ... }}` in `App.tsx`.

`src/style.css` — lines 6–7, 11–14
```css
--color-gs-app-bg: var(--gs-app-bg);
--color-gs-header-bg: var(--gs-header-bg);
...
--color-gs-text-primary: var(--gs-text-primary);
--color-gs-text-secondary: var(--gs-text-secondary);
--color-gs-text-muted: var(--gs-text-muted);
```
**Why it matters:** This `@theme` block is a second layer of indirection: `tokens.css` → `style.css @theme` → Tailwind utility class → `App.tsx` className. Each layer can change independently. If we switch from Tailwind to vanilla CSS, we rewrite `style.css` — the tokens and the components stay untouched.

`src/App.tsx` — lines 349–356
```tsx
style={{
  ...provided.draggableProps.style,
  backgroundColor: snapshot.isDragging ? undefined : 'var(--gs-card-bg)',
  border: '1px solid var(--gs-card-border)',
  borderLeftWidth: 3,
  borderLeftColor: `var(--gs-${task.column}-accent)`,
  ...
}}
```
**Why it matters:** The inline styles reference CSS variables (`var(--gs-card-bg)`, `var(--gs-${task.column}-accent)`), not raw colours. When the OS switches from dark to light mode (via `prefers-color-scheme`), the CSS variables automatically resolve to different values — the `App.tsx` code doesn't run again, doesn't check a theme flag, doesn't toggle any class. The browser handles the switch natively.
