# GetSorted — Logic & Architecture Walkthrough

> Every concept explained twice: **Explain Like I'm 7** (simple analogy) and **Developer POV** (technical reasoning).
> Covers `src/App.tsx` only. For CSS/tokens/config, see `explanation-allinall.md`.

---

## The Problem GetSorted Solves

**ELI7:** Imagine you have 15 toys scattered on the floor. Some need to be put away RIGHT NOW (mom's coming). Some can wait until after dinner. Some you don't care about. A normal to-do list is like throwing all the toys into one big pile — you can't tell what's urgent. GetSorted is three labeled boxes: NOW (red, urgent), SOON (amber, soon-ish), LATER (blue, whenever). You toss each task into the right box. Done.

**Dev:** Most task management tools suffer from feature bloat — due dates, tags, folders, subtasks, assignees. GetSorted strips prioritization down to a single spatial decision: which column does this belong in? The UI enforces the Eisenhower Matrix (urgent/important) implicitly — NOW = urgent+important, SOON = important but not urgent, LATER = backlog. The simplicity is the feature.

---

## One Flat Array — The Entire Data Model 

**ELI7:** Instead of three separate boxes for tasks, we have one big list. Each task wears a colored sticker that says which box it's in. When we need to show the NOW box, we look at the list and pick out all the tasks with a red "now" sticker. One list, three stickers. Easy to move things — just change the sticker.

**Dev:** A single `Task[]` array in state. Column membership is a field, not a separate array:

```ts
interface Task {
  id: string          // UUID — permanent, collision-proof identity
  title: string       // whatever the user typed
  column: ColumnId    // 'now' | 'soon' | 'later' — single source of truth
  createdAt: number   // Date.now() milliseconds since Unix epoch
}
```

Columns derive their tasks at render time via filter:

```tsx
tasks.filter(t => t.column === 'now')   // → what NOW renders
tasks.filter(t => t.column === 'soon')  // → what SOON renders
tasks.filter(t => t.column === 'later') // → what LATER renders
```

### Why one array, not three separate `useState` calls?

**ELI7:** If we had three boxes and wanted to move a toy from the red box to the blue box, we'd need to take it out of the red box first (one step), then put it in the blue box (another step). Between those steps, the toy is in mid-air — it's in neither box! With one list and stickers, it's one step: peel off the red sticker, stick on a blue one. Done. No mid-air toys.

**Dev:** Three separate arrays (`nowTasks`, `soonTasks`, `laterTasks`) would require two state updates for every cross-column move — remove from source array, add to destination array. Between those updates, React renders once with the task in neither column (or flickers it in both). A single array with a field update is atomic — one `setTasks` call, one re-render, zero intermediate states.

---

## The Component Tree — Who Owns What

**ELI7:** The `App` is the boss. It remembers everything (the task list, what you're typing). It tells the Header what to show, tells each Column which tasks belong to it, and tells each Card what to display. When something changes — you add a task, delete one, drag one — the boss hears about it and tells everyone to update. There's also a safety net (`ErrorBoundary`) wrapped around everything — if anything crashes, it catches the error and shows a "try again" screen instead of a blank white page.

**Dev:** State ownership is centralized in `App`. All mutations live there. Children are pure renderers:

```
ErrorBoundary (safety net — catches render crashes)
└── App (state owner: tasks, input)
    ├── <h1> (sr-only — screen reader heading)
    ├── Header
    │   ├── <img> (logo)
    │   ├── <label> (sr-only — "Add a new task")
    │   ├── <input> (controlled, id="task-input")
    │   └── <button> (onClick → addTask)
    │
    └── Board
        └── DragDropContext (onDragEnd → onDragEnd)
            ├── Column[id="now"]  → React.memo wrapped, receives filtered tasks + onDelete
            │   └── Droppable("now") → render-prop: provided + snapshot
            │       └── TaskCard[] → React.memo wrapped, Draggable each, indexed 0..n
            ├── Column[id="soon"]
            └── Column[id="later"]
```

**State never flows up.** No child calls `setTasks`. They invoke callbacks that were passed down as props. This makes data flow predictable: find the `useState` in `App` and you've found the only place state changes.

---

## Mutation 1: Creating a Task

**ELI7:** You type "Buy milk" in the text box and press Enter. The app: grabs your text from a sticky note (a `ref` that stays in sync with what you typed), trims off extra spaces, skips it if empty or if there are already 500 tasks, gives it a secret name-tag (a random ID), stamps it with the current time, puts it in the NOW box, clears the text box so you can type the next thing.

**Dev:**

```ts
const inputRef = useRef('')
const MAX_TASKS = 500

const addTask = useCallback(() => {
  const title = inputRef.current.trim()
  if (!title) return                          // guard: empty → no-op
  if (tasks.length >= MAX_TASKS) return        // guard: too many tasks → no-op

  const task: Task = {
    id: uuidv4(),                             // version-4 UUID, collision-proof
    title,
    column: 'now',                            // ALWAYS starts in NOW — triage happens later
    createdAt: Date.now(),                    // Unix ms timestamp for relative time display
  }

  setTasks(prev => [...prev, task])           // functional updater — prev is guaranteed fresh
  setInput('')
  inputRef.current = ''                       // clear the ref too
}, [tasks.length])                            // only depends on task count, not on every keystroke
```

**Why a `ref` instead of `useCallback([input])`?**

**ELI7:** Before, the app rebuilt the "add task" function every time you typed a single letter — like throwing away the recipe and rewriting it after each keystroke. Now it keeps one recipe pinned to the wall (the `ref`) and just updates the sticky note on it. The recipe stays the same, only the note changes.

**Dev:** The previous code had `useCallback([input])`, which recreated `addTask` on every keystroke. Since `handleKeyDown` depended on `addTask`, it was also recreated on every keystroke — causing the `<input>` to receive a fresh `onKeyDown` prop on each character. The `useRef` pattern decouples reading the input value from the function's identity:

1. `inputRef.current` is updated in `handleChange` (which runs on every keystroke)
2. `addTask` reads `inputRef.current` instead of the `input` state
3. `addTask`'s dependency is now `[tasks.length]` — only changes when tasks are added/deleted, not on keystrokes

**Line-by-line reasoning:**

| Line | ELI7 | Dev |
|---|---|---|
| `inputRef.current.trim()` | "Read the latest text from the sticky note, snip off blank spaces" | `useRef` holds a mutable `.current` value. It's always up to date because `handleChange` writes to it on every keystroke. Unlike state, reading a ref doesn't cause re-renders and doesn't need to be in a dependency array. |
| `if (!title) return` | "If there's nothing typed, don't do anything" | Guard clause. Falsy check — empty string bails early. |
| `if (tasks.length >= MAX_TASKS) return` | "If there are already 500 tasks, stop — the box is full" | Soft cap prevents the browser from locking up if thousands of tasks are created (via console script or accidental paste loop). 500 is far more than anyone would realistically triage in a session. |
| `id: uuidv4()` | "Give the task a name-tag nobody else has" | Random UUID v4. Serves as React `key`, DnD `draggableId`, and lookup key for all operations. |
| `column: 'now'` | "New tasks always go in the red urgent box" | Philosophy: if you typed it, it's probably important. Drag to triage later. Prevents analysis paralysis at input time. |
| `createdAt: Date.now()` | "Write down the time right now" | Unix ms timestamp stored as a `number`. Used by `getRelativeTime()`. |
| `setTasks(prev => [...prev, task])` | "Add this task to the end of the list" | Functional updater — `prev` is guaranteed fresh. Spread creates a new array (immutable). |
| `[tasks.length]` dependency | "Only rebuild when the number of tasks changes" | `addTask` no longer closes over `input` — it reads from the ref. The dependency is `tasks.length` (needed for the `MAX_TASKS` guard). This means fewer rebuilds: once per add/delete, not once per keystroke.

---

## Mutation 2: Deleting a Task

**ELI7:** You hover over a card, an X appears. You click it. Poof — the task is gone. No "are you sure?" popup. No undo button. Just gone. If you deleted the wrong thing, just retype it — it was probably only a few words anyway.

**Dev:**

```ts
const deleteTask = useCallback((id: string) => {
  setTasks(prev => prev.filter(t => t.id !== id))
}, [])
```

| Line | ELI7 | Dev |
|---|---|---|
| `(id: string)` | "Which task to delete? Pass its name-tag." | Receives the task's UUID from the child component. This is the only piece of data needed — `filter` matches by ID. |
| `prev.filter(t => t.id !== id)` | "Keep every task EXCEPT the one with this name-tag" | `Array.filter()` returns a new array excluding the matching ID. Pure, immutable — the original array is never mutated. |
| `[]` dependency | "Make this function once, never remake it" | The callback doesn't close over any state value — it only uses the functional updater. A stable reference prevents unnecessary re-renders of child components that receive `onDelete`. |

### Design decision: no confirmation dialog

**ELI7:** Imagine a delete button that asks "Are you REALLY sure?" every time. You'd stop deleting things. Your list would fill up with done tasks. GetSorted assumes you're an adult — if you clicked X, you meant it. And if you didn't, retyping "Buy milk" takes 2 seconds.

**Dev:** The cost of an accidental deletion (retype a few words) is much lower than the cost of a confirmation dialog (interrupts flow, adds a click, creates decision fatigue). This is the same UX philosophy behind Clear and Things — frictionless deletion encourages actual task completion instead of accumulation.

---

## Mutation 3: Moving a Task (onDragEnd) — The Core Algorithm

**ELI7:** You grab a card by its dots, drag it to another box, and let go. The app: checks where you picked it up, checks where you dropped it, removes the card from the old spot, counts where it should land in the new spot, and puts it there. If you just jiggled the card and put it back in the same place — nothing happens.

**Dev:** This is the most important function in the app. Here's the full handler:

```ts
const onDragEnd = useCallback((result: DropResult) => {
  const { source, destination, draggableId } = result

  // Guard 1: dropped outside all columns → bail
  if (!destination) return

  // Guard 2: dropped in the exact same position → bail
  if (
    source.droppableId === destination.droppableId &&
    source.index === destination.index
  ) return

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
```

### What `@hello-pangea/dnd` tells us

**ELI7:** When you finish dragging, the drag library hands the app a little report card. It says: "You picked up the card from the NOW column, position #3. You dropped it in the SOON column, position #1."

**Dev:** The `DropResult` object destructured on line 2:

| Field | ELI7 | Dev |
|---|---|---|
| `source.droppableId` | "Which box you took it from" | `"now"`, `"soon"`, or `"later"` — the column's droppable ID |
| `source.index` | "Its spot in the old box (0 = first, 1 = second)" | Zero-based position within the source column BEFORE the drag |
| `destination.droppableId` | "Which box you dropped it in" | Same as source IDs; `null` if dropped outside all columns |
| `destination.index` | "Its new spot in the new box" | Zero-based position within the destination column AFTER removal from source. The library already adjusts this — you don't need to account for the shift. |
| `draggableId` | "The card's name-tag (UUID)" | The task's `id` field — used to `find()` it in the array |

### Guard clauses

**ELI7:** Two "never mind" checks: (1) Did you drop it somewhere it doesn't belong — like the space between columns? Never mind. (2) Did you pick it up and put it back in the exact same spot without moving? Never mind.

**Dev:**

```ts
if (!destination) return    // dropped in empty space → null destination
```

`destination` is `null` when the user drags a card and releases it outside any `Droppable` region. Without this guard, accessing `destination.droppableId` would throw a TypeError.

```ts
if (source.droppableId === destination.droppableId && source.index === destination.index) return
```

Same column, same index — the card didn't actually move. Bailing early avoids a pointless state update and re-render.

### The insertion algorithm — step by step

**ELI7:** Think of your task list as a train. Each task is a train car. The columns (NOW, SOON, LATER) are different-colored sections of the train. When you drag a car from one section to another, you need to: (1) unhook the car, (2) walk past the earlier sections counting how many cars are in each, (3) slide it into the right spot in the new section.

**Dev:** The algorithm computes a **global insertion index** — the position in the flat `tasks[]` array where the dragged task should land. Let's trace a real example.

**Starting state:**

```
Global tasks array:  [A:now, B:now, C:soon, D:soon, E:later]
Visual layout:
  NOW:    [A] [B]
  SOON:   [C] [D]
  LATER:  [E]
```

**Scenario:** User drags `D` from SOON (index 1) to NOW, slotting it after `A` (index 1 in NOW).

**Step 1 — Find and remove the dragged task:**

```ts
const dragged = prev.find(t => t.id === draggableId)!   // { id: 'D', column: 'soon', ... }
const others = prev.filter(t => t.id !== draggableId)   // [A:now, B:now, C:soon, E:later]
```

| ELI7 | Dev |
|---|---|
| "Unhook car D from the train" | `find()` locates the task by its UUID. The `!` is TypeScript's non-null assertion — we know it exists because we just dragged it. If it didn't, crashing is correct behavior (fail fast on a bug, don't silently corrupt state). `filter` creates a new array without D. |

**Step 2 — Calculate the global insertion index:**

```ts
let insertAt = 0
for (const col of COLUMN_ORDER) {           // iterates: 'now' → 'soon' → 'later'
  if (col === destination.droppableId) {    // "is this the column we're inserting into?"
    insertAt += destination.index           // yes: add the destination position, then stop
    break
  }
  insertAt += others.filter(t => t.column === col).length  // no: count tasks in this column
}
```

**ELI7:** "Walk through the train sections in order: NOW, SOON, LATER. For each section BEFORE the one you're aiming at, count how many cars are in it. When you reach the right section, add the specific spot number."

**Dev trace — D from SOON to NOW:**

| Iteration | `col` | Match? | Action | `insertAt` |
|---|---|---|---|---|
| 1 | `'now'` | **Yes** (destination IS now) | Add `destination.index` (1), then `break` | 0 + 1 = **1** |

`insertAt = 1` → insert at global index 1, placing it after `A:now` and before `B:now`.

**Dev trace — a more complex cross-column move:** Drag `A` from NOW (index 0) to LATER (index 2):

| Iteration | `col` | Match? | Action | `insertAt` |
|---|---|---|---|---|
| 1 | `'now'` | No | Count NOW tasks after removing A: B = 1 | 0 + 1 = 1 |
| 2 | `'soon'` | No | Count SOON tasks: C, D = 2 | 1 + 2 = 3 |
| 3 | `'later'` | **Yes** | Add `destination.index` (2), break | 3 + 2 = **5** |

`others` state after removing A: `[B:now, C:soon, D:soon, E:later]`. Insert at global index 5.

**Step 3 — Splice the task back in:**

```ts
others.splice(insertAt, 0, {
  ...dragged,                                    // copy all existing fields (id, title, createdAt)
  column: destination.droppableId as ColumnId,   // override column with the new destination
})
return others
```

| ELI7 | Dev |
|---|---|
| "Slide the car into the train at the calculated spot. Change its color sticker to match the new section." | `Array.splice(index, 0, item)` inserts at `index` with a delete count of `0` (remove nothing, just insert). The spread `...dragged` copies all fields; `column: destination.droppableId` overrides just the column. The `as ColumnId` assertion is safe because `droppableId` can only be one of our three column IDs — those are the only values we pass to `<Droppable>`. |

### Why `[]` in `useCallback` is correct here

**ELI7:** "The moving function is like a recipe written on a card — it never changes because it doesn't need to know what's currently in the boxes. It figures that out fresh each time."

**Dev:** The empty dependency array means `onDragEnd` is created once and never recreated. This is safe because:

1. It uses `setTasks(prev => ...)` — the functional updater form, which receives the current state as an argument
2. `DropResult` is passed as a parameter, not captured from closure
3. `COLUMN_ORDER` is a module-level constant, not state
4. A stable reference prevents `DragDropContext` from resetting drag state mid-drag

---

## The Render Props Pattern (How DnD Works)

**ELI7:** The drag-and-drop library is like a magic moving company. For each column, you rent a "drop zone" — a space where cards can be dropped. For each card, you rent a "draggable wrapper" — something that makes it pick-up-able. The company gives you special invisible gear (`provided`) that you MUST attach to your furniture, and a real-time status update (`snapshot`) that tells you "someone's hovering over this column right now."

**Dev:** `@hello-pangea/dnd` uses the **render props pattern** — components that take a function as `children`:

```tsx
<Droppable droppableId="now">                          // "this is a drop zone called 'now'"
  {(provided, snapshot) => (                            // injection function
    <div ref={provided.innerRef} {...provided.droppableProps}>  // MUST attach these
      {/* cards go here */}
      {provided.placeholder}                            // prevents collapse when empty
    </div>
  )}
</Droppable>
```

### `provided` — Mandatory Infrastructure

**ELI7:** The moving company gives you three things that you HAVE to use, or nothing works: (1) a tracking sticker for the box, (2) invisible sensors that detect when a card is hovering over it, (3) an inflatable cushion that keeps the box from collapsing when it's empty.

**Dev:**

| Property | Where it goes | ELI7 | Dev |
|---|---|---|---|
| `provided.innerRef` | On the container `div`'s `ref` | "The tracking sticker" | The library uses this React ref to measure the droppable's DOM dimensions. Needed for auto-scrolling, drop target hit-testing, and position calculation. Forgetting it = silent failure. |
| `provided.droppableProps` | Spread on the container `div` | "The invisible sensors" | Injects `data-rbd-droppable-id` attribute and pointer/touch event handlers. Without this spread, the div doesn't register as a valid drop target. |
| `provided.placeholder` | Rendered as a child inside the droppable | "The inflatable cushion" | A zero-height element that preserves the droppable's scroll area height even when all items are dragged out. Without it, the column collapses to 0px and becomes an impossible drop target. |

### `snapshot` — Reactive Drag State

**ELI7:** "The status update that tells you what's happening right now — is someone dragging a card over this column? If yes, show a dashed line that says 'drop it here!'"

**Dev:**

| Field | ELI7 | Dev |
|---|---|---|
| `snapshot.isDraggingOver` | "Is a card hovering over this column?" | `boolean`, derived from pointer position relative to the droppable's bounding rect. Updates on every `pointermove` during drag. We use it to toggle the dashed border class. |
| `snapshot.draggingOverWith` | "Which card is hovering?" | The `draggableId` of the item currently over this droppable, or `null`. Could be used for per-item drop styling. |
| `snapshot.draggingFromThisWith` | "Which card was taken FROM this column?" | The `draggableId` of the item that was picked up from this droppable. Useful for highlighting the source column during drag. |

### The Drag Handle Pattern

**ELI7:** You can only pick up a card by grabbing its little dot pattern on the left — not by clicking the text or the X button. This is like a suitcase: you grab the handle, not the whole suitcase. The grip also announces itself to screen readers: "Drag 'Buy milk' to reorder."

**Dev:** By splitting `provided.draggableProps` (on the entire card) from `provided.dragHandleProps` (only on the grip icon):

```tsx
<Draggable draggableId={task.id} index={index}>
  {(provided, snapshot) => (
    <div ref={provided.innerRef} {...provided.draggableProps}>
      <div {...provided.dragHandleProps}
           role="button"
           aria-label={`Drag "${task.title}" to reorder`}
           tabIndex={0}>
        <svg aria-hidden="true">⋮⋮</svg>
      </div>
      {/* task text — won't trigger drag */}
      {/* delete button — won't trigger drag */}
    </div>
  )}
</Draggable>
```

`draggableProps` includes the necessary event bindings for the entire card to be positioned during drag. `dragHandleProps` restricts drag *initiation* to the grip element. `role="button"` and `aria-label` make it discoverable for screen reader users. `snapshot.isDragging` lets us apply a "lifted" style:

```tsx
snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag' : ''
```

| ELI7 | Dev |
|---|---|
| "When you're holding the card in the air, it becomes a little see-through and casts a shadow" | 85% opacity + a `box-shadow` defined by `--gs-drag-shadow` (0px X-offset, 12px Y-offset, 32px blur, 50% black in dark mode). Creates the illusion of the card floating above the board. |

### Why `provided.draggableProps.style` MUST be merged — not replaced

**ELI7:** The drag library puts an invisible tracking sticker on the card that says "hey browser, move this card 50 pixels to the right while I'm being dragged." If we slap our own sticker on top of theirs, the browser loses the instruction and the card just sits there — you can't drag it anymore.

**Dev:** `provided.draggableProps` is an object spread onto the card's outer `<div>`. One of its properties is `style`, which contains:

```ts
{
  transform: 'translate(120px, 45px)',   // where the card should visually be
  transition: 'transform 0.2s ease',      // smooth animation when dropped
  // possibly other positioning props
}
```

Without this `transform`, the browser doesn't know where to paint the card during a drag — it stays at its original DOM position. The drag *logic* still fires (`onDragEnd` still gets called), but the card never follows the cursor. It looks broken to the user, but it's actually just invisible movement.

**The bug:** Our explicit `style={{ backgroundColor: ..., border: ... }}` on the same `<div>` replaces the spread's `style` entirely — JSX processes props left-to-right, and the last `style` wins:

```tsx
// BROKEN — our style replaces the library's style
<div
  ref={provided.innerRef}
  {...provided.draggableProps}    // sets style = { transform: '...' }
  style={{                        // THIS OVERWRITES the transform!
    backgroundColor: 'var(--gs-card-bg)',
    border: '1px solid var(--gs-card-border)',
    ...
  }}
>
```

**The fix — spread `provided.draggableProps.style` into our own style object:**

```tsx
// FIXED — merge, don't replace
<div
  ref={provided.innerRef}
  {...provided.draggableProps}    // sets style (overridden below)
  style={{
    ...provided.draggableProps.style,   // ← PRESERVE the library's transform/transition
    backgroundColor: 'var(--gs-card-bg)',
    border: '1px solid var(--gs-card-border)',
    ...
  }}
>
```

Now the browser receives BOTH the DnD positioning (`transform`) AND our visual styles (`backgroundColor`, `border`, etc.) in the same `style` object. The card follows the cursor correctly.

### Declarative hover state — not imperative DOM mutation

**ELI7:** Before, when the mouse touched a card, we ran around with a paintbrush directly changing the card's color. Now, we flip a little switch called `isHovered` from "no" to "yes," and React handles the repainting for us. If the card is being dragged, we don't flip the switch at all — the flying card doesn't need a paint job mid-flight.

**Dev:** The hover effect was originally implemented with imperative `e.currentTarget.style` mutations in `onMouseEnter`/`onMouseLeave`. After the audit, this was replaced with a `useState` boolean:

```tsx
const [isHovered, setIsHovered] = useState(false)

// in the JSX:
<div
  onMouseEnter={() => { if (!snapshot.isDragging) setIsHovered(true) }}
  onMouseLeave={() => setIsHovered(false)}
  onFocus={() => setIsHovered(true)}
  onBlur={() => setIsHovered(false)}
  style={{
    backgroundColor: snapshot.isDragging
      ? undefined
      : isHovered
        ? 'var(--gs-card-hover)'
        : 'var(--gs-card-bg)',
    borderColor: isHovered && !snapshot.isDragging
      ? 'var(--gs-card-border-hover)'
      : 'var(--gs-card-border)',
    ...
  }}
>
```

| Approach | ELI7 | Dev |
|---|---|---|
| Old (imperative) | "Run over and repaint the card by hand" | `e.currentTarget.style.backgroundColor = ...` — mutates the DOM directly, bypassing React's render cycle. If React re-renders mid-hover, the manual style gets wiped. |
| New (declarative) | "Flip a switch, let React do the painting" | `useState` drives the style in the normal render cycle. All visual state is computed from `isHovered` in one place — the `style` prop. Easier to reason about, can't drift out of sync. |

The `onFocus`/`onBlur` handlers are new — they make the hover effect also trigger on keyboard focus (`tabIndex={0}` on the card wrapper), so keyboard users get the same visual feedback as mouse users.

---

## The `getRelativeTime` Utility

**ELI7:** This is the "how long ago did I write this?" calculator. It looks at the time stamp on the card, subtracts it from right now, and says: "Just now" (if less than a minute), "5 mins ago" (if less than an hour), "3 hours ago" (if less than a day), or "2:34 PM" (if it's from yesterday or earlier).

**Dev:**

```ts
function getRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp                    // milliseconds elapsed
  const mins = Math.floor(diff / 60_000)          // convert ms → minutes

  if (mins < 1)   return 'Just now'               // < 60 seconds
  if (mins < 60)  return `${mins} min${mins !== 1 ? 's' : ''} ago`  // 1–59 minutes
  if (mins < 1440) {                              // < 24 hours
    const hours = Math.floor(mins / 60)
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',                              // "2 PM" or "14:00" depending on locale
    minute: '2-digit',                            // zero-padded: "2:05" not "2:5"
  })
}
```

| Line | ELI7 | Dev |
|---|---|---|
| `now: number = Date.now()` | "What time is it right now? (You can also tell me a specific time for testing)" | The optional second parameter makes the function testable. Call `getRelativeTime(oneHourAgo, oneHourAgo + 3_600_000)` in a test and it always returns `"1 hour ago"` — no mocking required. In production, omit the second argument and it defaults to `Date.now()`. |
| `Date.now() - timestamp` → `now - timestamp` | "Right now minus when you wrote it" | Subtracting the stored timestamp gives elapsed ms. The difference from the old version: `now` is a parameter, not a global call — this is what makes the function pure when called with two arguments. |
| `Math.floor(diff / 60_000)` | "Turn milliseconds into whole minutes, rounding down" | `60_000` = 60 × 1000 = 1 minute in ms. The underscore is JS numeric separator (`60_000` = `60000`). `Math.floor` means 59 seconds = 0 minutes = "Just now," not "1 min ago." |
| `${mins !== 1 ? 's' : ''}` | "Add an 's' if it's not exactly 1 (1 min, 2 mins)" | Simple pluralization with a ternary. A library like `pluralize` would be overkill for a single word. |
| `toLocaleTimeString([], {...})` | "Show the time the way your computer normally does" | Empty array = default locale. `hour: 'numeric'` = 12h (2 PM) or 24h (14:00) depending on locale settings. `minute: '2-digit'` = zero-padded. |

**No live-update timer.** The timestamp only recalculates on re-render (triggered by add/move/delete), not on a `setInterval`. Resolution is in minutes, not seconds — live updating "2 mins ago" to "3 mins ago" every 60 seconds isn't worth the performance cost.

---

## The Column Configuration Pattern

**ELI7:** Instead of writing the same code three times for three columns with different colors, we write it once and give it a "recipe card" for each column. The recipe says: "Your name is NOW, your color is red, and when you're empty, say 'Nothing on fire. Nice.'" If we ever want a fourth column, we just add one more recipe card — zero code changes.

**Dev:** Data-driven rendering via configuration arrays. `COLUMNS` is the single source of truth — `COLUMN_ORDER` and `columnStyles` are both derived from it:

```ts
const COLUMNS = [
  { id: 'now' as const,   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon' as const,  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later' as const, label: 'LATER', empty: 'No backlog. Rare.' },
]

// Derived — never manually maintained. If COLUMNS order changes, this follows.
const COLUMN_ORDER = COLUMNS.map(col => col.id) as ColumnId[]

// Factory — avoids copy-pasting the same six-line object three times.
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
```

Rendered with a single `map()`:

```tsx
{COLUMNS.map(col => <Column key={col.id} column={col} tasks={...} onDelete={...} />)}
```

**ELI7:** "The app reads the recipe cards one by one and builds a column for each. It doesn't care if there are 3 cards or 30 — it just follows the instructions. And the column order is automatic — it's read straight from how the recipes are arranged. No chance of the layout and the drag math getting out of sync."

**Dev:** This pattern means:
- Adding a column = one object in the array + one line in `columnStyles`
- Removing a column = one splice + one delete
- Reordering columns = reorder the `COLUMNS` array — `COLUMN_ORDER` follows automatically
- Changing a label or empty message = one string edit
- The `Column` component is fully generic — it delegates per-column differences to the `columnStyles` lookup map
- **The factory function eliminates copy-paste bugs.** Previously, `columnStyles` had three nearly identical blocks. If one property was wrong in one block, it would be silently broken. Now the template is defined once and instantiated three times.

---

## Data Flow — End to End

**ELI7:** Here's the full journey of "Buy milk" from your brain to the screen:

1. You type "Buy milk" and press Enter
2. The app gives it a name-tag, stamps the time, puts it in the NOW box
3. React updates the screen — NOW column shows "Buy milk" with a red stripe
4. You grab it by the dots and drag it to SOON
5. The app unhooks it, counts where it goes, puts it in SOON
6. React updates the screen — SOON column shows "Buy milk" with an amber stripe

**Dev:**

```
User types "Buy milk" → presses Enter
  │
  ▼
handleKeyDown(e) → e.key === 'Enter' → addTask()
  │
  ▼
addTask()
  uuidv4()           → id: "9b1deb4d-..."
  Date.now()         → createdAt: 1716472800000
  setTasks(prev => [...prev, { id, title: "Buy milk", column: 'now', createdAt }])
  setInput('')
  │
  ▼
React re-renders App
  │
  ▼
Column now:   tasks.filter(t => t.column === 'now')   → [{ id: "...", title: "Buy milk", column: "now" }]
Column soon:  tasks.filter(t => t.column === 'soon')  → []
Column later: tasks.filter(t => t.column === 'later') → []
  │
  ▼
TaskCard renders as <Draggable draggableId="9b1deb4d-..." index={0}>
  border-left: 3px solid var(--gs-now-accent)  ← red stripe
  │
  ▼
User drags card from NOW (index 0) to SOON (index 0)
  │
  ▼
onDragEnd({
  source:      { droppableId: 'now',  index: 0 },
  destination: { droppableId: 'soon', index: 0 },
  draggableId: "9b1deb4d-..."
})
  │
  ▼
Algorithm:
  dragged = find by id        → { id: "...", column: 'now', ... }
  others = filter out id      → []
  insertAt: loop COLUMN_ORDER
    col 'now'  → dest? no  → count NOW tasks in others (0)  → insertAt = 0
    col 'soon' → dest? yes → add dest.index (0), break      → insertAt = 0
  splice others at 0 with { ...dragged, column: 'soon' }
  return others                → [{ id: "...", column: 'soon', ... }]
  │
  ▼
React re-renders App
  │
  ▼
Column now:   []                                               ← empty, shows "Nothing on fire. Nice."
Column soon:  [{ id: "...", title: "Buy milk", column: "soon" }]
Column later: []
  │
  ▼
TaskCard re-renders in SOON
  border-left: 3px solid var(--gs-soon-accent)  ← amber stripe now
```

---

## Design Tradeoffs

### No Persistence

**ELI7:** If you close the browser, everything disappears. This is on purpose — it's like a whiteboard for right now, not a filing cabinet for forever.

**Dev:** State is purely in-memory. No `localStorage`, no `IndexedDB`, no API calls. Rationale: adding persistence is ~5 lines (`useEffect(() => localStorage.setItem('tasks', JSON.stringify(tasks)), [tasks])`), but it introduces a contract — the data must survive sessions, which means you need schema versioning, migration logic, and corruption recovery. GetSorted is a triage tool for the present moment. Scope discipline keeps it maintainable.

### No Delete Confirmation

**ELI7:** No "Are you sure?" popup. Deleting is as easy as adding. If you mess up, retyping takes 2 seconds.

**Dev:** The cost asymmetry: accidental deletion costs ~10 keystrokes to retype. Confirmation dialogs cost focus, a click, and cognitive interruption on EVERY deletion. In a tool designed for rapid triage, the interruption tax dominates. This pattern is used by Clear, Things, and most mobile-first task apps.

### Single Input, Always → NOW

**ELI7:** You can't type directly into SOON or LATER. Everything starts in NOW, then you drag to sort. This forces you to dump first, organize second — which is faster than deciding priority mid-typing.

**Dev:** A single input eliminates the "which column does this go into?" decision at creation time. The user dumps everything into NOW during a capture phase, then triages spatially via drag-and-drop. This separates capture from organization — two distinct mental modes that are faster when not interleaved.

### UUIDs over Incremental IDs

**ELI7:** Instead of numbering tasks 1, 2, 3 (which breaks if you delete #2), each task gets a random name-tag that's guaranteed to be unique forever.

**Dev:** `uuidv4()` vs alternatives:
- `tasks.length + 1` — breaks if you delete an earlier task and IDs collide
- `crypto.randomUUID()` — built into browsers, fewer bytes, but not available in all JS runtimes
- `uuid` library — adds ~3KB to bundle, works everywhere, proven, universal

### `React.memo` on Column and TaskCard

**ELI7:** Without memo, React redraws every single card and every single column every time anything changes — even if only one card moved. With memo, React knows to skip the cards that didn't change. It's like only replacing the one train car that moved instead of rebuilding the entire train.

**Dev:** `Column` and `TaskCard` are wrapped in `React.memo` (imported as `memo` from React). `TaskCard` has a custom comparator that tells React: "only re-render if the task's ID, title, column, or index actually changed":

```tsx
const TaskCard = memo(function TaskCard({ task, index, onDelete }: TaskCardProps) {
  // ...
}, (prev, next) =>
  prev.task.id === next.task.id &&
  prev.task.title === next.task.title &&
  prev.task.column === next.task.column &&
  prev.index === next.index
)
```

**Why it matters:** Without `React.memo`, every `addTask`, `deleteTask`, or `onDragEnd` triggers a re-render of every card in every column. With 50 tasks, dragging one card causes 49 wasted renders. The custom comparator freezes cards in unaffected columns, keeping the app responsive as the task list grows.

### CSS `:focus` over imperative event handlers

**ELI7:** Before, the text box had JavaScript that ran every time you clicked in or out — "when they click in, change the border. When they click out, change it back." Now CSS handles it: the browser just knows "when this input is focused, use the focus border color." Simpler, faster, works the same for mouse, keyboard, and touch.

**Dev:** The `onFocus`/`onBlur` handlers that mutated `e.target.style.borderColor` were removed. Instead, `style.css` has:

```css
input:focus {
  border-color: var(--gs-input-focus);
}
```

The `:focus` pseudo-class handles every way an input can receive focus — Tab key, click, screen reader navigation. No JavaScript needed. The input's base border stays on the inline `style` prop; the focus variant is purely CSS.

### Error Boundary — crash safety net

**ELI7:** If something breaks inside the app — maybe a task has a weird value that React doesn't understand — the whole screen goes white and the user has no idea what happened. The error boundary is a safety net: it catches the crash, shows a friendly "Something went wrong" message with a "Try again" button, and the rest of the browser tab stays functional.

**Dev:** `ErrorBoundary.tsx` is a React class component (error boundaries require `componentDidCatch`, which has no hook equivalent in React 19). It wraps `<App />` in `main.tsx`:

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

If any child component throws during render, `getDerivedStateFromError` captures the error, sets `hasError: true`, and the boundary renders a fallback UI instead of crashing the entire tree. `componentDidCatch` logs the error and component stack to the console for debugging.
