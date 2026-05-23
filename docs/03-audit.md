# Code Audit — GetSorted

---

## 1. Vulnerabilities

**Honest assessment: this category is clean.** You have no server, no API calls, no `dangerouslySetInnerHTML`, no secrets in the code, and no user data persisted anywhere. React's JSX auto-escapes `{task.title}` — even if someone typed `<script>alert('hi')</script>` as a task title, it would render as harmless text on the screen, not execute. That is React's default behaviour and you are relying on it correctly.

One minor observation: there is no limit on how long a task title can be. Someone could paste a 50,000-character string into the input and create a massive DOM node. It would not be a security exploit, but it could make the browser sluggish or, at an extreme, crash the tab. This is low-risk in a local-only app, but worth noting if the app ever gains network features.

**Verdict: no actionable vulnerabilities found. A very good baseline for a first real app.**

---

## 2. Performance

---

### Unnecessary function recreation on every keystroke

**Category:** Performance

**What is happening**
`addTask` is wrapped in `useCallback` with `[input]` as a dependency. This means every time the user types a single character, React throws away the old `addTask` function and creates a brand new one. Then `handleKeyDown`, which lists `[addTask]` as its dependency, also gets recreated. React then passes a fresh `onKeyDown` prop to the `<input>` element on every keystroke. For a text input, the performance cost is tiny — but it means the input component re-renders on every character, and as the app grows, re-renders can cascade in ways you did not intend.

**The code with the problem**

`src/App.tsx` — lines 111–128
```ts
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
```

**What to do instead**
Use a `ref` to hold the latest input value so `addTask` can have an empty dependency array, and combine the Enter key handler into the input's `onKeyDown` without needing a separate memoised callback:

```ts
const inputRef = useRef('')

// read from the ref instead of closing over `input` state
const addTask = useCallback(() => {
  const title = inputRef.current.trim()
  if (!title) return
  const task: Task = {
    id: uuidv4(),
    title,
    column: 'now',
    createdAt: Date.now(),
  }
  setTasks(prev => [...prev, task])
  setInput('')
}, [])

// keep the ref in sync with state
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value
  inputRef.current = value
  setInput(value)
}

// inline the Enter handler — no useCallback needed for a single element
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') addTask()
}
```

Then update the input:
```tsx
<input
  value={input}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  ...
/>
```

**Why this fix works**
The ref is a stable object — its `.current` property updates without triggering re-renders. `addTask` now has `[]` as its dependency, so it is created once and never recreated. `handleKeyDown` is now a plain function that calls the stable `addTask`. The input still gets `onKeyDown` on every render, but since it is a new inline function, React's reconciliation handles it efficiently — and the important optimisation is that `addTask` (the heavier function, passed to `handleKeyDown` and potentially to children) no longer changes identity.

To be fair, for an app this size, you could also just remove `useCallback` from `addTask` entirely and let it recreate each render. The overhead of `useCallback` + the stale-closure risk from the dependency array can sometimes be worse than just letting the function be recreated. The `useRef` approach is the "belt and suspenders" answer — it is the most correct and most performant.

---

### Three `filter()` calls on every render

**Category:** Performance

**What is happening**
Every time `App` re-renders — which is every time you add, delete, or move a task — this line runs:

```tsx
tasks={tasks.filter(t => t.column === col.id)}
```

This runs `filter()` three times (once per column). `filter()` walks the entire `tasks` array each time, so with 100 tasks you are scanning 300 items per render. At typical to-do list sizes (under 50 tasks), this is imperceptible. It only becomes noticeable at thousands of tasks, and even then, React's reconciliation would be the bigger bottleneck.

**The code with the problem**

`src/App.tsx` — line 229
```tsx
tasks={tasks.filter(t => t.column === col.id)}
```

**What to do instead**
For now: nothing. This is the correct, idiomatic React pattern for a single source of truth. Premature optimisation (splitting into three `useMemo` arrays, for example) would make the code harder to read for zero real-world gain. The right time to fix this is when you measure it being slow — add 500 tasks, open the Performance tab in DevTools, and if the filter takes more than a couple of milliseconds, *then* optimise.

One thing you could do now as good practice: wrap the filtered arrays in `useMemo` so they are only recalculated when `tasks` actually changes:

```tsx
const nowTasks = useMemo(() => tasks.filter(t => t.column === 'now'), [tasks])
const soonTasks = useMemo(() => tasks.filter(t => t.column === 'soon'), [tasks])
const laterTasks = useMemo(() => tasks.filter(t => t.column === 'later'), [tasks])
```

This is slightly more code but guarantees the filters only run when the array changes, not on every unrelated re-render. Whether you do this depends on your tolerance for boilerplate vs. your concern about performance — both positions are defensible here.

---

### No memory leaks

**Category:** Performance

**What is happening**
You have no `setInterval`, no `addEventListener` outside React, no WebSocket subscriptions, and no `setTimeout` that outlives the component. Every state update goes through `useState`, which React cleans up when the component unmounts.

**The code:** Every file reviewed.

**Why it matters**
Memory leaks are one of the hardest bugs to debug because they do not crash — they just slowly degrade performance over hours. The fact that your app has zero cleanup responsibilities means zero leak opportunities. Keep this discipline as the app grows: when you add timers or event listeners, always pair them with a cleanup function in `useEffect`'s return value.

---

## 3. Accessibility

---

### Delete button invisible to keyboard-only users

**Category:** Accessibility

**What is happening**
The delete button on each card uses `opacity-0 group-hover:opacity-100`. The `group-hover` modifier only responds to the mouse cursor hovering over the parent — the `:hover` CSS pseudo-class does not trigger from keyboard focus. A user navigating with the Tab key can focus the delete button (it is a real `<button>`, so it is in the tab order), but they will never see it because it stays at zero opacity. They have to guess where the invisible button is and press Enter blindly.

**The code with the problem**

`src/App.tsx` — lines 446–448
```tsx
<button
  onClick={() => onDelete(task.id)}
  className="flex-shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
```

**What to do instead**
Add `focus-visible:opacity-100` and `group-focus-within:opacity-100` so the button also appears when the card is focused:

```tsx
<button
  onClick={() => onDelete(task.id)}
  className="flex-shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
```

Then make the card container focusable so the keyboard can reach it:

```tsx
<div
  tabIndex={0}
  className={`group flex items-center ...`}
  ...
>
```

**Why this fix works**
`group-focus-within:opacity-100` makes the button visible when *any child* of the card has focus — so tabbing to the delete button makes it appear. `focus-visible:opacity-100` handles the case where the button itself is focused (browsers apply `:focus-visible` only when the user is navigating by keyboard, not mouse click). Adding `tabIndex={0}` to the card wrapper puts the entire card in the tab order, giving keyboard users a clear target. Combined, a keyboard user can Tab to a card, see the delete button appear, Tab again to the button, and press Enter. Same visual experience a mouse user gets, just triggered by focus instead of hover.

---

### Input field has no accessible label

**Category:** Accessibility

**What is happening**
The task input relies entirely on `placeholder="What needs doing?"` as its label. Placeholder text disappears as soon as the user starts typing, so there is no persistent label. Screen readers may or may not announce the placeholder depending on the user's settings and the screen reader software. A visible, persistent label — even one hidden visually but present for screen readers — is the reliable approach.

**The code with the problem**

`src/App.tsx` — lines 184–189
```tsx
<input
  type="text"
  value={input}
  onChange={e => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="What needs doing?"
```

**What to do instead**
Add a `<label>` element connected to the input via `htmlFor` / `id`. You can visually hide it with a Tailwind `sr-only` class if the design forbids visible labels:

```tsx
<label htmlFor="task-input" className="sr-only">
  Add a new task
</label>
<input
  id="task-input"
  type="text"
  ...
/>
```

**Why this fix works**
`sr-only` keeps the label text in the DOM and accessible to screen readers while making it invisible to sighted users. Screen readers announce "Add a new task, edit text" when the input is focused. The placeholder can stay as a visual hint for sighted users — it is not wrong to have a placeholder, just wrong for it to be the *only* label.

---

### Drag handle has no accessible name

**Category:** Accessibility

**What is happening**
The grip dots on each card are purely visual — a 14×14 SVG with six `<circle>` elements. There is no `aria-label`, no `role`, and no text alternative. A screen reader encountering this element will either announce nothing or read something unhelpful like "group" (depending on the browser). The user has no way to know this is the drag handle or how to interact with it.

**The code with the problem**

`src/App.tsx` — lines 378–391
```tsx
<div
  {...provided.dragHandleProps}
  className="flex-shrink-0 cursor-grab active:cursor-grabbing"
  style={{ color: 'var(--gs-text-muted)' }}
>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <circle cx="4" cy="2" r="1.5" />
    ...
  </svg>
</div>
```

**What to do instead**
Add `aria-label` and `role` to the drag handle div.

```tsx
<div
  {...provided.dragHandleProps}
  role="button"
  aria-label={`Drag "${task.title}" to reorder`}
  tabIndex={0}
  className="flex-shrink-0 cursor-grab active:cursor-grabbing"
  style={{ color: 'var(--gs-text-muted)' }}
>
  <svg aria-hidden="true" width="14" height="14" ...>
    ...
  </svg>
</div>
```

**Why this fix works**
`role="button"` tells the screen reader this is interactive, not just decorative. `aria-label` gives it a meaningful name that includes the task title — so a user hears "Drag 'Buy milk' to reorder, button." `tabIndex={0}` puts it in the keyboard tab order. The `aria-hidden="true"` on the SVG tells screen readers to skip the decorative dots — they add no meaning. (Full keyboard drag-and-drop requires additional work — see the next issue — but this at least announces the handle's purpose.)

---

### No heading hierarchy — `<h2>` without `<h1>`

**Category:** Accessibility

**What is happening**
The column headers use `<h2>` elements (NOW, SOON, LATER), but there is no `<h1>` anywhere on the page. The logo is an `<img>` with `alt="GetSorted"`, which is not a heading. Screen reader users navigating by heading (a very common pattern — pressing the `H` key to jump between headings) will find three `<h2>` elements but no `<h1>` to give them context about the page. This breaks the document outline.

**The code with the problem**

`src/App.tsx` — lines 267–272
```tsx
<h2
  className={`font-bold ${s.headerText}`}
  style={{ fontSize: 13, lineHeight: 1.25, letterSpacing: '0.08em' }}
>
  {column.label}
</h2>
```

**What to do instead**
Add a visually hidden `<h1>` near the top of the page, before the board:

```tsx
<h1 className="sr-only">GetSorted — Task Board</h1>
```

Then keep the `<h2>` elements for the column headings — they are correctly nested under the `<h1>`.

**Why this fix works**
A proper heading hierarchy helps screen reader users build a mental map of the page. They hear "GetSorted — Task Board, heading level 1," then navigate into the columns and hear "NOW, heading level 2," "SOON, heading level 2," etc. This is how the Web Content Accessibility Guidelines (WCAG) define a navigable document structure — WCAG 2.4.10 Section Headings and 1.3.1 Info and Relationships.

---

### Drag-and-drop has no keyboard alternative

**Category:** Accessibility

**What is happening**
`@hello-pangea/dnd` is a mouse/touch-only library. A user who cannot use a mouse — whether due to motor impairment, visual impairment (they use a screen reader, not a pointer), or personal preference — cannot reorder or move tasks between columns. This is a known limitation of the library, not a bug in your code, but it means the core interaction of the app is inaccessible to a significant group of users.

**The code with the problem**

`src/App.tsx` — lines 223–234 (the entire drag context)
```tsx
<DragDropContext onDragEnd={onDragEnd}>
  <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
    {COLUMNS.map(col => (
      <Column ... />
    ))}
  </div>
</DragDropContext>
```

**What to do instead**
This is not a quick fix — it is a feature. The standard approach for accessible drag-and-drop involves:

1. Adding "Move to NOW / Move to SOON / Move to LATER" buttons or a dropdown on each card that is only visible to keyboard users (using `sr-only` + `focus-within` to show it)
2. Adding "Move up / Move down" buttons for reordering within a column
3. Wrapping the whole board in a component that manages `onKeyDown` events for arrow-key-based movement

A pragmatic first step: add a "Move to" select dropdown on each card, revealed on focus, that calls the same `onDragEnd` logic but with programmatically constructed source/destination objects. This gives keyboard users parity with the mouse interaction at a fraction of the implementation cost.

**Why this fix matters**
WCAG Success Criterion 2.1.1 (Keyboard) requires that all functionality be operable through a keyboard interface. Drag-and-drop is specifically called out in the understanding document as needing a keyboard alternative. For a task board used daily, this is the difference between "usable by everyone" and "usable only by mouse users."

---

### Colour-only column identification

**Category:** Accessibility

**What is happening**
The three columns are distinguished by colour: red for NOW, amber for SOON, blue for LATER. A user with red-green colour blindness (the most common type, affecting ~8% of males) may not perceive the difference between the red and amber columns. They would see two columns that look nearly identical and rely entirely on the small text label to tell them apart.

**The code with the problem**

`src/tokens.css` — lines 100, 106, 112
```css
--gs-now-header-bg:    var(--gs-now-500);    /* #E84545 — red */
--gs-soon-header-bg:   var(--gs-soon-500);   /* #F5A623 — amber */
--gs-later-header-bg:  var(--gs-later-500);  /* #4A90D9 — blue */
```

**What to do instead**
The column labels (NOW, SOON, LATER) are already text, which is good — text is not affected by colour blindness. But you can reinforce the distinction by adding an icon or shape indicator to each column header. For example, a small icon: a flame for NOW (urgent), a clock for SOON (waiting), an archive box for LATER (stored). Or a simple geometric shape: a circle for NOW, a diamond for SOON, a square for LATER.

This does not need to replace the colour — colour is great for users who can see it. It is about providing a second, non-colour channel of information (this is called "redundant coding" in accessibility terminology).

**Why this fix matters**
WCAG Success Criterion 1.4.1 (Use of Colour) states that colour must not be the only visual means of conveying information. The text labels technically satisfy this requirement, but at a glance — which is how most users scan a task board — colour is the primary identifier. Adding a secondary indicator makes the board scannable for everyone, regardless of colour perception.

---

### Decorative SVGs not hidden from screen readers

**Category:** Accessibility

**What is happening**
The clock icon SVG (lines 408–431) and the delete X icon SVG (lines 449–458) have no `aria-hidden="true"`. Screen readers may attempt to announce these elements, which for a purely decorative icon is noise — the user does not need to hear "image" for a clock next to text that already says the time.

You got this right for the delete button — it has `aria-label="Delete task"` (line 450), which is correct. The icon inside it should be hidden so the screen reader reads the button's label, not the icon.

**The code with the problem**

`src/App.tsx` — lines 411–431 (clock icon)
```tsx
<svg
  width="11"
  height="11"
  viewBox="0 0 11 11"
  fill="none"
  style={{ flexShrink: 0 }}
>
```

`src/App.tsx` — lines 449–458 (delete X icon)
```tsx
<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
```

**What to do instead**
Add `aria-hidden="true"` to both SVGs. The clock is decorative (the timestamp text already conveys the information) and the X is decorative (the button's `aria-label` already conveys "Delete task").

```tsx
<svg aria-hidden="true" width="11" height="11" ...>
```

**Why this fix works**
Screen readers skip elements marked with `aria-hidden="true"`. This reduces audio clutter — the user hears "2 mins ago" instead of "2 mins ago, image." For the delete button, they hear "Delete task, button" instead of "Delete task, image, button."

---

## 4. Engineering Principles

---

### Imperative style manipulation for hover effects

**Category:** Engineering Principle

**What is happening**
The card hover effect uses JavaScript event handlers (`onMouseEnter`, `onMouseLeave`) that set inline styles directly on the DOM element via `e.currentTarget.style.xxx = '...'`. This is imperative code — "when the mouse enters, do this, then do that" — inside what is otherwise a declarative React component. It works, but it means the card's visual state lives in two places: part in React's render output (the initial `style` prop) and part in DOM mutation callbacks. This makes it harder to reason about what a card looks like at any given moment.

**The code with the problem**

`src/App.tsx` — lines 361–375
```tsx
onMouseEnter={e => {
  if (!snapshot.isDragging) {
    e.currentTarget.style.backgroundColor = 'var(--gs-card-hover)'
    e.currentTarget.style.borderColor = 'var(--gs-card-border-hover)'
    e.currentTarget.style.borderLeftWidth = '3px'
    e.currentTarget.style.borderLeftStyle = 'solid'
    e.currentTarget.style.borderLeftColor = `var(--gs-${task.column}-accent)`
  }
}}
onMouseLeave={e => {
  if (!snapshot.isDragging) {
    e.currentTarget.style.backgroundColor = 'var(--gs-card-bg)'
    e.currentTarget.style.borderColor = 'var(--gs-card-border)'
  }
}}
```

**What to do instead**
Use a piece of React state to track hover. This keeps the rendering logic in one place — the JSX — and the hover effect becomes declarative:

```tsx
const [isHovered, setIsHovered] = useState(false)

// in the JSX:
<div
  onMouseEnter={() => { if (!snapshot.isDragging) setIsHovered(true) }}
  onMouseLeave={() => { setIsHovered(false) }}
  style={{
    ...provided.draggableProps.style,
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

**Why this fix works**
All visual state is now computed in the `style` prop during render. To understand what colour the card background is, you read the `style` prop — you do not need to also check whether an `onMouseEnter` handler ran and mutated the DOM. This is the React way: state drives render, render produces the UI. It also eliminates the bug risk where `onMouseLeave` fires after a drag and clobbers the drag state (which you already guard against with `!snapshot.isDragging` — good instinct there).

A reasonable counter-argument: the imperative approach avoids a re-render on every hover, which could matter in a list of 500 cards. For this app size, the clarity gain from declarative hover state outweighs the microscopic performance cost.

---

### Imperative focus/blur handling on the input

**Category:** Engineering Principle

**What is happening**
The input's focus and blur border colours are set imperatively via `onFocus` and `onBlur` handlers. This is the same pattern as the card hover issue — JavaScript manipulating DOM styles directly instead of letting CSS handle it.

**The code with the problem**

`src/App.tsx` — lines 199–204
```tsx
onFocus={e => {
  e.target.style.borderColor = 'var(--gs-input-focus)'
}}
onBlur={e => {
  e.target.style.borderColor = 'var(--gs-input-border)'
}}
```

**What to do instead**
Remove the `onFocus` and `onBlur` handlers entirely. Instead, add a CSS rule that uses the `:focus` pseudo-class. Since you are using Tailwind, you can do this in `style.css`:

```css
input:focus {
  border-color: var(--gs-input-focus);
  outline: none;
}
```

Then the input's inline style only needs the base border:
```tsx
style={{
  border: '1px solid var(--gs-input-border)',
  ...
}}
```

**Why this fix works**
CSS already has a built-in mechanism for focus styling — the `:focus` pseudo-class. It has worked reliably for 20+ years. Using it means: (a) less JavaScript, (b) the focus style works regardless of how focus arrived (Tab key, click, screen reader navigation), and (c) the styling logic lives with the rest of your styles, not buried in an event handler. The `outline: none` you already have on the input's className is correct — you just need to provide a visible alternative, which the `:focus` border does.

---

### `getRelativeTime` is impure — hard to test and reason about

**Category:** Engineering Principle

**What is happening**
`getRelativeTime` calls `Date.now()` internally. This means calling it twice with the *same* timestamp can return different results — "Just now" then "1 min ago" if 60 seconds passed between calls. A pure function would return the same output for the same input every time. Impure functions are harder to test (you cannot write a simple unit test with fixed inputs and expected outputs — you have to mock `Date.now()` or accept fuzzy assertions) and harder to debug (the output depends on when you called it, not just what you passed in).

**The code with the problem**

`src/App.tsx` — lines 87–88
```ts
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
```

**What to do instead**
Accept the current time as a second parameter with a default value. This makes the function pure when called with explicit arguments, and the default gives you the convenient single-argument form for production use:

```ts
function getRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  const mins = Math.floor(diff / 60_000)
  // ... rest stays the same
}
```

Then in production:
```tsx
getRelativeTime(task.createdAt)          // uses Date.now() as default
```

And in tests:
```ts
getRelativeTime(oneHourAgo, oneHourAgo + 3_600_000)  // → "1 hour ago" — every time
```

**Why this fix works**
The function signature now says: "give me a timestamp and optionally a 'now' value." When you pass both, the function is pure — same inputs, same output, always. When you pass only one, it behaves exactly as before. Tests become deterministic: no mocking, no timeouts, no fuzzy "is this approximately right?" assertions. This is a tiny change (one parameter, one word in the function signature) with a big maintainability payoff.

---

### No error boundary — a crash anywhere whitescreens the entire app

**Category:** Engineering Principle

**What is happening**
If any component in the tree throws an error during render — a bug in `TaskCard`, a malformed task object, a null reference in `Column` — React unmounts the entire component tree. The user sees a blank white screen. There is no fallback UI, no error message, no "something went wrong but you can still use the rest of the app." This is React's default behaviour: an uncaught render error crashes the whole tree.

**The code with the problem**

`src/main.tsx` — lines 6–9
```tsx
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

No error boundary wraps `<App />`.

**What to do instead**
Create an error boundary component and wrap `<App />` in it. React error boundaries must be class components (there is no hook equivalent yet in React 19):

```tsx
// src/ErrorBoundary.tsx
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GetSorted crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>Try refreshing the page. If this keeps happening, the tasks might be corrupted.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

Then in `main.tsx`:
```tsx
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

**Why this fix works**
When a child component crashes, the error boundary catches the error, preserves the rest of the tree, and renders a fallback UI. The user sees a message instead of a white screen. In development, React still shows the error overlay so you can debug. In production, the user gets a graceful degradation. Error boundaries are the React equivalent of a `try/catch` around your render tree — and every production React app should have at least one at the top level.

---

### `columnStyles` map has repeated structure — could be data-driven

**Category:** Engineering Principle

**What is happening**
The `columnStyles` map defines the same six properties for each of the three columns. The only difference between the `now`, `soon`, and `later` entries is the column name in the class string (`gs-now-*` vs `gs-soon-*` vs `gs-later-*`). If you ever want to add a fourth column, you would copy-paste an entire block and change every occurrence of `later` to `done` — that is 6 lines of manual search-and-replace per new column, and it is error-prone.

**The code with the problem**

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
  soon: { ... },   // identical structure, different name
  later: { ... },  // identical structure, different name
}
```

**What to do instead**
Derive the styles from the column ID with a factory function. The column ID *is* the only variable:

```ts
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

**Why this fix works**
The template of the style object is defined once. Adding a column means adding one key-value pair to the `columnStyles` record. The class strings are computed, not copy-pasted, so there is zero chance of forgetting to update one of the six properties. This is "DRY applied to configuration" — the same principle that made you use `COLUMNS.map()` instead of three hardcoded `<Column>` elements. The `columnStyles` map deserves the same treatment.

---

### Single file is growing large — 467 lines

**Category:** Engineering Principle (debatable — not strictly wrong)

**What is happening**
`App.tsx` contains types (lines 22–29), column configuration (lines 35–81), a helper function (lines 87–101), the App component with all state and event handlers (lines 107–238), the Column component (lines 250–327), and the TaskCard component (lines 339–465). That is 467 lines of code handling three distinct concerns: data and configuration, the top-level orchestrator, and two UI components.

**The code with the problem**

`src/App.tsx` — the entire file, lines 1–467.

**What to do instead**
This is a judgement call, not a bug. For an app this size, one file is actually quite convenient — you can see everything without switching tabs. The co-location makes the data flow obvious. Many experienced React developers prefer this pattern for small-to-medium components.

However, if the app grows (more columns, more card types, user settings, persistence), consider splitting along these lines:

```
src/
  App.tsx           ← App + state + handlers only (~150 lines)
  components/
    Column.tsx      ← Column component
    TaskCard.tsx    ← TaskCard component
  config/
    columns.ts      ← COLUMNS, COLUMN_ORDER, columnStyles, buildColumnStyle
  utils/
    time.ts         ← getRelativeTime
```

The threshold for splitting is: when you have to scroll to find something, or when two people are editing different parts of the same file and causing merge conflicts. You are not there yet. This is a "keep an eye on it" observation, not a "fix it now" demand.

---

## Summary

| Category | Issues found | Severity |
|---|---|---|
| Vulnerabilities | 0 | — |
| Performance | 2 (useCallback churn, filter per render) | Minor — negligible at current scale |
| Accessibility | 7 (delete button, input label, drag handle, heading hierarchy, keyboard DnD, colour-only, decorative SVGs) | Moderate to high — real barriers for assistive tech users |
| Engineering Principles | 5 (imperative hover, imperative focus, impure function, no error boundary, repeated style map) | Minor to moderate — works correctly, harder to maintain |

The code is solid for a first real React app. The drag-and-drop logic is well-structured, the state management is clean, immutability is consistently applied, and the design token system shows real architectural thinking. The accessibility gaps are the most important area to address — they affect real users, not just code quality. Start with the delete button visibility fix and the input label; those are one-line changes with outsized impact.
