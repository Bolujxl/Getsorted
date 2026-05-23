# Cross-Check Audit — GetSorted

**First audit:** `03-audit.md` (original pass)
**Cross-check:** second-opinion review, looking for what the first pass missed

The first audit was solid on interaction-level accessibility and React hook patterns. This pass digs deeper — into what happens at 100+ tasks, what users with visual impairments actually experience, and where the architecture has time bombs waiting to go off.

---

## New Findings (missed or underplayed in the first audit)

---

### Cascading re-renders — no `React.memo` on TaskCard or Column

**Category:** Performance

**The problem**
Every time you add, delete, or drag a single task, `App` state updates — and React re-renders *every Column and every TaskCard* in the entire board. Drag one card in the NOW column, and React calls your TaskCard function for every card in SOON and LATER too, even though nothing about them changed. The first audit caught the `useCallback` on `addTask` (real, but tiny). It missed the elephant in the room: with 50 tasks, that is 50+ wasted component executions per drag. That number grows linearly with every task you add.

**The code**

`src/App.tsx` — line 339
```tsx
function TaskCard({ task, index, onDelete }: TaskCardProps) {
```

No `React.memo` wrapper anywhere on `TaskCard` or `Column`.

**The fix**

```tsx
const TaskCard = React.memo(function TaskCard({ task, index, onDelete }: TaskCardProps) {
  // body unchanged
}, (prev, next) =>
  prev.task.id === next.task.id &&
  prev.task.title === next.task.title &&
  prev.task.column === next.task.column &&
  prev.index === next.index
)

const Column = React.memo(function Column({ column, tasks, onDelete }: ColumnProps) {
  // body unchanged
})
```

**Why it works**
`React.memo` tells React: "only re-render this component if its props actually changed." The custom comparator on TaskCard means React only re-renders a card if its title, column, or position changed. Drag a card in NOW and every card in SOON and LATER stays frozen — zero wasted work. This is the performance win that actually matters at scale, and it costs almost nothing to add.

---

### Fixed `px` units — invisible to anyone who needs larger text

**Category:** Accessibility

**The problem**
Every font size in `tokens.css` is in `px`. Pixels are absolute — they ignore the user's browser font size preference entirely. Someone who has set their browser to 24px because they struggle to read small text will open GetSorted and see 14px no matter what. The first audit checked how tokens were used in components. It never asked whether the tokens themselves were accessible.

**The code**

`src/tokens.css` — lines 36–41
```css
--gs-text-xs:   11px;
--gs-text-sm:   13px;
--gs-text-base: 14px;
--gs-text-md:   16px;
--gs-text-lg:   20px;
--gs-text-xl:   28px;
```

**The fix**

```css
/* 1rem = 16px at default browser settings. Divide each px value by 16. */
--gs-text-xs:   0.6875rem;  /* 11px */
--gs-text-sm:   0.8125rem;  /* 13px */
--gs-text-base: 0.875rem;   /* 14px */
--gs-text-md:   1rem;       /* 16px */
--gs-text-lg:   1.25rem;    /* 20px */
--gs-text-xl:   1.75rem;    /* 28px */
```

**Why it works**
`rem` units scale relative to the root font size the browser sets. When a user increases their default font size, every value follows. For users with default settings, the app looks identical. For users who need it larger, it becomes readable. One change, zero visual impact for most people, life-changing for a few.

---

### Muted text contrast is 1.9:1 — fails WCAG by a wide margin

**Category:** Accessibility

**The problem**
In dark mode, the muted text colour is `rgba(255,255,255,0.25)` — white at 25% opacity. Against the `#0F0F0F` background, that calculates to roughly **1.9:1 contrast**. WCAG AA requires 4.5:1 for body text and 3:1 for large text. This colour fails both thresholds. Almost every card in the app has a timestamp ("2 mins ago") rendered in this colour. For anyone with moderate vision loss, those timestamps are invisible. For many people with normal vision, they are strain to read.

**The code**

`src/tokens.css` — line 65
```css
--gs-text-muted: rgba(255,255,255,0.25);
```

**The fix**

```css
--gs-text-muted: rgba(255,255,255,0.50);
```

At 50% opacity on `#0F0F0F`, the contrast hits roughly 3.9:1 — close to AA for body text, passing for large text. The text still reads as secondary, just readable. Confirm exact values with the WebAIM Contrast Checker (webaim.org).

**Why it works**
This is a one-token fix that touches every muted text element in the app — timestamps, empty states, drag handles — without a single component change. The visual feel barely shifts, but the text becomes actually readable.

---

### `COLUMNS` and `COLUMN_ORDER` are two sources of truth for the same thing

**Category:** Engineering Principle

**The problem**
`COLUMNS` (the rich config array) and `COLUMN_ORDER` (the flat ID array) both encode the order of the three columns. They are declared separately. If someone reorders `COLUMNS` but forgets `COLUMN_ORDER`, the visual layout shifts but the drag-and-drop insertion algorithm keeps using the old order. Cards would drop into the wrong position — a silent, data-corrupting bug that no linter would catch.

**The code**

`src/App.tsx` — lines 35–41
```tsx
const COLUMNS = [
  { id: 'now',   label: 'NOW'   },
  { id: 'soon',  label: 'SOON'  },
  { id: 'later', label: 'LATER' },
]
const COLUMN_ORDER: ColumnId[] = ['now', 'soon', 'later']
```

**The fix**

```tsx
const COLUMNS = [
  { id: 'now',   label: 'NOW'   },
  { id: 'soon',  label: 'SOON'  },
  { id: 'later', label: 'LATER' },
] as const

const COLUMN_ORDER = COLUMNS.map(col => col.id) as ColumnId[]
```

**Why it works**
Now there is one place that defines column order: the `COLUMNS` array. `COLUMN_ORDER` is derived, not maintained. If someone swaps the order in `COLUMNS`, `COLUMN_ORDER` follows automatically. One less category of bug to worry about as the app grows.

---

### Potential UI lockup — no cap on task count

**Category:** Vulnerability / Performance

**The problem**
There is no limit on how many tasks a user can create. A paste loop or a script in the browser console could create thousands of tasks in seconds. Without virtualization (the app renders every task into the DOM), the browser would lock up. The first audit noted title length but missed the more realistic risk: task count.

**The code**

`src/App.tsx` — lines 111–122
```tsx
const addTask = useCallback(() => {
  const title = input.trim()
  if (!title) return
  // ... no count check
  setTasks(prev => [...prev, task])
}, [input])
```

**The fix**

```tsx
const MAX_TASKS = 500

const addTask = useCallback(() => {
  const title = input.trim()
  if (!title) return
  if (tasks.length >= MAX_TASKS) {
    alert(`You have reached the limit of ${MAX_TASKS} tasks.`)
    return
  }
  // ... create task as before
}, [input, tasks.length])
```

**Why it works**
A soft cap prevents the app from becoming unusable. Five hundred tasks is far more than anyone would realistically triage in a session, but small enough that the DOM handles it fine. This is a low-severity issue for a local-only app, but it is worth the one-line guard — especially if the app ever gains features like import or sync that could bring in large datasets.

---

## Disagreements With the First Audit

Three places where the initial audit and this cross-check saw the same code but reached different conclusions — and who is more convincing.

---

### Vulnerability assessment: "clean" vs. "real DoS risk"

**Audit 1:** Vulnerability category is clean — no server, no API, React auto-escapes. Mentioned long titles only in passing.

**Cross-check:** There is a real risk that task count (not title length) could lock up the browser.

**Resolution:** The cross-check is more convincing. A soft cap is a one-line guard that closes a genuine vector. The first audit was too quick to declare the category spotless. Both the title-length observation and the task-count risk belong in the same finding — the audit should have caught both.

---

### Performance priority: `useCallback` churn vs. missing `React.memo`

**Audit 1:** The main performance issue is `addTask` being recreated on every keystroke.

**Cross-check:** The bigger issue is `React.memo` on `TaskCard`/`Column` — every drag re-renders every card.

**Resolution:** The cross-check is right about the priority ordering. `useCallback` churn affects one handler on one input. Missing `React.memo` means every state change touches every card — a cost that scales with list size. Both fixes are worth doing, but `React.memo` should ship first. The first audit found a real issue, the cross-check found a bigger one sitting right next to it. Different levels of the performance stack.

---

### Direct DOM mutation: same finding, different framing

**Audit 1:** `e.currentTarget.style` in mouse handlers is an engineering principle violation — should use `useState`.

**Cross-check:** Same observation, but adds that the pattern can cause visual flickering when React re-renders conflict with manual style mutations.

**Resolution:** Neither audit is wrong. Audit 1 identified *what* is broken (imperative code in a declarative framework). The cross-check identified *why it hurts in practice* (the flickering is real, not theoretical). The fix is the same in both: `useState` for `isHovered`, apply styles declaratively. The cross-check frames the urgency better — this is not just a style preference, it causes visible bugs.

---

## Final Verdict

The first audit was strong on interaction-level concerns: keyboard access, labels, heading hierarchy, colour-only communication. It correctly identified real accessibility barriers and suggested practical fixes for each.

This cross-check found the deeper systemic issues the first pass walked past:

- **Scalability** — missing `React.memo` means every task added makes the app slower for everyone
- **Universal access** — `px` units and 1.9:1 contrast ratios lock out users who need larger text or have vision impairments
- **Data integrity** — dual sources of truth for column order is a silent bug waiting to happen
- **Resilience** — no task cap means the browser can be DOS'd by its own user

Priority order for fixes:
1. `rem` units (one file, every user with accessibility needs benefits)
2. Muted text contrast (one token, fixes readability for everyone)
3. `React.memo` on TaskCard/Column (keeps the app fast as the task list grows)
4. Derive `COLUMN_ORDER` from `COLUMNS` (prevents a data-corrupting bug)
5. Task count cap (defensive, low urgency for a local app)
