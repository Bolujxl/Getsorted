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

**ELI7:** The `App` is the boss. It remembers everything (the task list, what you're typing). It tells the Header what to show, tells each Column which tasks belong to it, and tells each Card what to display. When something changes — you add a task, delete one, drag one — the boss hears about it and tells everyone to update.

**Dev:** State ownership is centralized in `App`. All mutations live there. Children are pure renderers:

```
App (state owner: tasks, input)
├── Header
│   ├── <img> (logo)
│   ├── <input> (controlled component, value={input} + onChange)
│   └── <button> (onClick → addTask)
│
└── Board
    └── DragDropContext (onDragEnd → onDragEnd)
        ├── Column[id="now"]  → receives filtered tasks + onDelete
        │   └── Droppable("now") → render-prop: provided + snapshot
        │       └── TaskCard[] → Draggable each, indexed 0..n
        ├── Column[id="soon"]
        └── Column[id="later"]
```

**State never flows up.** No child calls `setTasks`. They invoke callbacks that were passed down as props. This makes data flow predictable: find the `useState` in `App` and you've found the only place state changes.

---

## Mutation 1: Creating a Task

**ELI7:** You type "Buy milk" in the text box and press Enter. The app: grabs your text, trims off extra spaces, skips it if empty, gives it a secret name-tag (a random ID), stamps it with the current time, puts it in the NOW box, clears the text box so you can type the next thing.

**Dev:**

```ts
const addTask = useCallback(() => {
  const title = input.trim()
  if (!title) return                          // guard clause: empty → no-op

  const task: Task = {
    id: uuidv4(),                             // version-4 UUID, collision-proof
    title,
    column: 'now',                            // ALWAYS starts in NOW — triage happens later
    createdAt: Date.now(),                    // Unix ms timestamp for relative time display
  }

  setTasks(prev => [...prev, task])           // functional updater — prev is guaranteed fresh
  setInput('')                                // reset input to empty
}, [input])
```

**Line-by-line reasoning:**

| Line | ELI7 | Dev |
|---|---|---|
| `input.trim()` | "Snip off any blank spaces before and after your typed text" | `String.trim()` removes leading/trailing whitespace. Prevents creating a task that looks empty because it's just spaces. |
| `if (!title) return` | "If there's nothing typed, don't do anything" | Guard clause. Falsy check — empty string, null, undefined all bail early. Prevents ghost tasks. |
| `id: uuidv4()` | "Give the task a name-tag nobody else has" | `uuidv4()` generates a random UUID v4 like `"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`. Collision probability is astronomically low. This ID serves triple duty: React `key`, DnD `draggableId`, and the lookup key for `find`/`filter` operations. |
| `column: 'now'` | "New tasks always go in the red urgent box" | Philosophy: if you typed it, it's probably important. You can drag it elsewhere after. Prevents analysis paralysis at input time — you just dump and sort. |
| `createdAt: Date.now()` | "Write down the time right now" | Stores milliseconds since Jan 1, 1970 (Unix epoch). Stored as a `number`, not a `Date` object, because numbers are trivial to compare and serialize. Used by `getRelativeTime()` to display "2 mins ago." |
| `setTasks(prev => [...prev, task])` | "Add this task to the end of the list" | Functional updater form. `prev` is React's guaranteed-current state reference. The spread `[...prev, task]` creates a new array — immutable update (React's `Object.is` comparison detects the new reference and triggers a re-render). |
| `setInput('')` | "Clear the text box" | Resets the controlled input, ready for the next task. |
| `[input]` dependency | "If the typing changes, remake this function" | `useCallback` recreates `addTask` whenever `input` changes. Necessary because `addTask` closes over `input` — without the dependency, it would forever capture the initial empty string. |

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

**ELI7:** You can only pick up a card by grabbing its little dot pattern on the left — not by clicking the text or the X button. This is like a suitcase: you grab the handle, not the whole suitcase. Otherwise you'd accidentally drag things when you just wanted to read or delete them.

**Dev:** By splitting `provided.draggableProps` (on the entire card) from `provided.dragHandleProps` (only on the grip icon):

```tsx
<Draggable draggableId={task.id} index={index}>
  {(provided, snapshot) => (
    <div ref={provided.innerRef} {...provided.draggableProps}>   {/* whole card is the draggable area */}
      <div {...provided.dragHandleProps}>                        {/* BUT only this grip initiates drag */}
        ⋮⋮
      </div>
      {/* task text — won't trigger drag */}
      {/* delete button — won't trigger drag */}
    </div>
  )}
</Draggable>
```

`draggableProps` includes the necessary event bindings for the entire card to be positioned during drag. `dragHandleProps` restricts drag *initiation* to the grip element. `snapshot.isDragging` lets us apply a "lifted" style:

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

### Hover handlers: guarding against drag interference

**ELI7:** When you're dragging a card, it's flying through the air. You don't want the "hover color change" to happen mid-flight — it'd look glitchy. So we check: "are we currently dragging? If yes, skip the hover stuff."

**Dev:** Both `onMouseEnter` and `onMouseLeave` now guard with `!snapshot.isDragging`:

```tsx
onMouseEnter={e => {
  if (!snapshot.isDragging) {                     // ← guard
    e.currentTarget.style.backgroundColor = 'var(--gs-card-hover)'
    e.currentTarget.style.borderColor = 'var(--gs-card-border-hover)'
    // ...
  }
}}
onMouseLeave={e => {
  if (!snapshot.isDragging) {                     // ← guard
    e.currentTarget.style.backgroundColor = 'var(--gs-card-bg)'
    e.currentTarget.style.borderColor = 'var(--gs-card-border)'
  }
}}
```

Why this matters: mouse events CAN fire during or immediately after a drag (a `mouseleave` on the old position when the card is picked up, a `mouseenter` on the new position when dropped). Without the guard, `onMouseLeave` would reset `backgroundColor` and `borderColor` on the card div — potentially fighting with the post-drop animation the library is trying to play. The guard ensures our hover logic and the library's drag logic never step on each other's toes.

---

## The `getRelativeTime` Utility

**ELI7:** This is the "how long ago did I write this?" calculator. It looks at the time stamp on the card, subtracts it from right now, and says: "Just now" (if less than a minute), "5 mins ago" (if less than an hour), "3 hours ago" (if less than a day), or "2:34 PM" (if it's from yesterday or earlier).

**Dev:**

```ts
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp          // milliseconds elapsed
  const mins = Math.floor(diff / 60_000)       // convert ms → minutes

  if (mins < 1)   return 'Just now'            // < 60 seconds
  if (mins < 60)  return `${mins} min${mins !== 1 ? 's' : ''} ago`  // 1–59 minutes
  if (mins < 1440) {                           // < 24 hours
    const hours = Math.floor(mins / 60)
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',                            // "2 PM" or "14:00" depending on locale
    minute: '2-digit',                          // zero-padded: "2:05" not "2:5"
  })
}
```

| Line | ELI7 | Dev |
|---|---|---|
| `Date.now() - timestamp` | "Right now minus when you wrote it" | `Date.now()` returns current ms since epoch. Subtracting the stored timestamp gives the elapsed time in ms. Negative if `timestamp` is somehow in the future — gracefully returns "Just now." |
| `Math.floor(diff / 60_000)` | "Turn milliseconds into whole minutes, rounding down" | `60_000` = 60 × 1000 = 1 minute in ms. The underscore is JS numeric separator (`60_000` = `60000`). `Math.floor` means 59 seconds = 0 minutes = "Just now," not "1 min ago." |
| `${mins !== 1 ? 's' : ''}` | "Add an 's' if it's not exactly 1 (1 min, 2 mins)" | Simple pluralization with a ternary. A library like `pluralize` would be overkill for a single word. |
| `toLocaleTimeString([], {...})` | "Show the time the way your computer normally does" | Empty array = default locale. `hour: 'numeric'` = 12h (2 PM) or 24h (14:00) depending on locale settings. `minute: '2-digit'` = zero-padded. |

**No live-update timer.** The timestamp only recalculates on re-render (triggered by add/move/delete), not on a `setInterval`. Resolution is in minutes, not seconds — live updating "2 mins ago" to "3 mins ago" every 60 seconds isn't worth the performance cost.

---

## The Column Configuration Pattern

**ELI7:** Instead of writing the same code three times for three columns with different colors, we write it once and give it a "recipe card" for each column. The recipe says: "Your name is NOW, your color is red, and when you're empty, say 'Nothing on fire. Nice.'" If we ever want a fourth column, we just add one more recipe card — zero code changes.

**Dev:** Data-driven rendering via configuration arrays:

```ts
const COLUMNS = [
  { id: 'now',   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon',  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later', label: 'LATER', empty: 'No backlog. Rare.' },
]
```

Rendered with a single `map()`:

```tsx
{COLUMNS.map(col => <Column key={col.id} column={col} tasks={...} onDelete={...} />)}
```

**ELI7:** "The app reads the recipe cards one by one and builds a column for each. It doesn't care if there are 3 cards or 30 — it just follows the instructions."

**Dev:** This pattern means:
- Adding a column = one object in the array
- Removing a column = one splice
- Changing a label or empty message = one string edit
- The `Column` component is fully generic — it delegates per-column differences to the `columnStyles` lookup map

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
