# Cross-Check Audit — GetSorted
**First audit by:** 03-audit.md (OpenCode)
**Cross-check by:** Gemini 2.5 High

---

## New findings from the cross-check

These are issues the first audit did not catch, or only grazed without going deep enough.

---

### Cascading re-renders — TaskCard and Column have no React.memo

**Category:** Performance

**What the first audit missed**
The first audit caught the `useCallback` churn on `addTask` — a real issue, but a small one. It missed the much heavier problem sitting right next to it: `TaskCard` and `Column` are plain functions with no memoization. Every time any task is added, deleted, or dragged, the entire `App` state updates, and React re-renders every Column and every TaskCard from scratch regardless of whether that specific card changed at all. With 50 tasks, that is 50+ unnecessary component executions triggered by moving a single card. The first audit looked at the wrong level of the performance stack.

**The code with the problem**
`src/App.tsx — line 339`
```tsx
function TaskCard({ task, index, onDelete }: TaskCardProps) {
  // No React.memo wrap — re-renders on every parent state change
```

**Suggested fix**
```tsx
const TaskCard = React.memo(function TaskCard({ task, index, onDelete }: TaskCardProps) {
  // component body unchanged
}, (prev, next) => {
  return prev.task.id === next.task.id &&
         prev.task.title === next.task.title &&
         prev.task.column === next.task.column &&
         prev.index === next.index
})

// Do the same for Column
const Column = React.memo(function Column({ col, tasks, styles }: ColumnProps) {
  // component body unchanged
})
```

**Why this fix works**
`React.memo` tells React: only re-render this component if its props actually changed. The custom comparator means you control exactly what counts as "changed" — in this case, the task's identity and position. If you drag a card in the NOW column, the SOON and LATER columns and all their cards stay frozen. This is the performance win that actually matters at scale, and it costs almost nothing to add.

---

### Fixed `px` units instead of `rem` — invisible to users who need larger text

**Category:** Accessibility

**What the first audit missed**
The first audit caught seven accessibility issues and did good work on them. But it missed a foundational one baked into the design token file itself. Every font size in `tokens.css` is defined in `px`. Pixels are absolute — they ignore the user's browser font size setting entirely. A user who has set their browser default to 24px because they have difficulty reading small text will open GetSorted and see 14px text regardless. The app does not respect their preference. The first audit checked how the tokens were used in components but never looked at whether the tokens themselves were accessible.

**The code with the problem**
`src/tokens.css — lines 36–41`
```css
--gs-text-xs:   11px;
--gs-text-sm:   13px;
--gs-text-base: 14px;
--gs-text-md:   16px;
--gs-text-lg:   20px;
--gs-text-xl:   28px;
```

**Suggested fix**
```css
/* Base: 1rem = 16px (browser default).
   Divide original px value by 16. */
--gs-text-xs:   0.6875rem;  /* 11px */
--gs-text-sm:   0.8125rem;  /* 13px */
--gs-text-base: 0.875rem;   /* 14px */
--gs-text-md:   1rem;       /* 16px */
--gs-text-lg:   1.25rem;    /* 20px */
--gs-text-xl:   1.75rem;    /* 28px */
```

**Why this fix works**
`rem` units are relative to the root font size, which the browser sets based on the user's preference. When someone increases their default font size, every `rem` value scales with it. The visual result is identical for users with default settings, and it becomes usable for users who need it larger. This is one of those fixes that costs nothing and helps the people who need it most.

---

### Muted text contrast ratio is 1.9:1 in dark mode — far below WCAG AA

**Category:** Accessibility

**What the first audit missed**
The first audit mentioned colour-only communication as an accessibility concern but never checked the actual contrast ratios of the tokens. The dark mode value for `--gs-text-muted` is `rgba(255,255,255,0.25)`. Against the app background of `#0F0F0F`, that works out to roughly 1.9:1. WCAG AA requires 4.5:1 for regular text and 3:1 for large text. At 1.9:1, this text fails both thresholds. The timestamps on every task card — "just now", "5 mins ago" — are rendered in this colour. They are effectively invisible to anyone with moderate visual impairment, and borderline for many users in normal conditions.

**The code with the problem**
`src/tokens.css — line 65`
```css
--gs-text-muted: rgba(255,255,255,0.25);
```

**Suggested fix**
```css
/* rgba(255,255,255,0.45) on #0F0F0F gives ~3.2:1 — passes large text AA */
/* rgba(255,255,255,0.55) on #0F0F0F gives ~4.0:1 — close to full AA     */
--gs-text-muted: rgba(255,255,255,0.50);
```

To verify before committing, run the values through the WebAIM Contrast Checker at webaim.org/resources/contrastchecker.

**Why this fix works**
Increasing opacity brings the text colour closer to white without changing the visual feel significantly — the text still reads as "secondary", just readable. It is a one-token change that fixes every instance of muted text across the app simultaneously, because everything uses the variable.

---

### `COLUMN_ORDER` and `COLUMNS` are two sources of truth for the same thing

**Category:** Engineering Principle

**What the first audit missed**
The first audit correctly flagged the `columnStyles` map for repeating the same structure three times. But it missed a closely related problem one level up: `COLUMNS` and `COLUMN_ORDER` are two separate constants that both encode the order of the three columns. If someone updates `COLUMNS` but forgets `COLUMN_ORDER` — or changes the order in one but not the other — the drag-and-drop index calculation will silently break, placing tasks in the wrong column when dropped. The app would appear to work but behave incorrectly. The first audit focused on repetition within a single data structure and missed the duplication *between* data structures.

**The code with the problem**
`src/App.tsx — lines 35–41`
```tsx
const COLUMNS = [
  { id: 'now',   label: 'NOW'   },
  { id: 'soon',  label: 'SOON'  },
  { id: 'later', label: 'LATER' },
]
const COLUMN_ORDER: ColumnId[] = ['now', 'soon', 'later']
```

**Suggested fix**
```tsx
// COLUMNS is the single source of truth
const COLUMNS = [
  { id: 'now',   label: 'NOW'   },
  { id: 'soon',  label: 'SOON'  },
  { id: 'later', label: 'LATER' },
] as const

// COLUMN_ORDER is derived — never manually maintained
const COLUMN_ORDER = COLUMNS.map(col => col.id) as ColumnId[]
```

**Why this fix works**
Now there is one place to change column order: the `COLUMNS` array. `COLUMN_ORDER` is always in sync because it is computed, not declared. This eliminates an entire category of bug — the kind where two things are supposed to match but quietly drift apart over time. Small apps get away with this. Larger apps with multiple contributors do not.

---

## Where the two audits disagree

---

### Vulnerabilities: clean baseline vs real DoS risk

**Audit 1 said:** The vulnerability category is clean — no server, no API, React's JSX auto-escaping handles input safely. It noted in passing that a very long task title could slow the browser.

**Cross-check said:** There is a meaningful DoS risk — no limit on the number of tasks means a user could flood the state with thousands of entries, locking up the browser.

**Which is more convincing and why:** The cross-check is more convincing on this specific point. Audit 1 noticed title length but missed the more realistic risk: task count. A long paste or a script running in the console could create thousands of tasks in seconds. Since there is no virtualization, the DOM would need to render all of them. It is still a low-severity issue for a local-only app, but the cross-check is right that it deserves a soft cap — something like 500 tasks with a warning is a one-line addition that removes the risk entirely. Audit 1 was too comfortable declaring the category clean.

---

### Performance: useCallback churn vs React.memo

**Audit 1 said:** The main performance issue is `addTask` being recreated on every keystroke due to `useCallback([input])`, causing the input and its handlers to re-render unnecessarily.

**Cross-check said:** The more impactful issue is missing `React.memo` on `TaskCard` and `Column`, causing every card to re-render on every state change — far more expensive at scale than the `useCallback` problem.

**Which is more convincing and why:** The cross-check is right about the priority ordering. `useCallback` churn on an input field is a tiny, localised cost — one component, one event handler, re-created on keystrokes that the user is already causing. Missing `React.memo` on `TaskCard` means every drag operation, every add, every delete touches every card in the list. At 50+ tasks, that is a waterfall of wasted renders compared to the input handler issue. Audit 1 found a real problem. Cross-check found the bigger one. Both fixes are worth doing — but `React.memo` should go in first.

---

### Direct DOM mutation: same issue, different severity

**Audit 1 said:** Using `e.currentTarget.style` directly in mouse event handlers is an engineering principle violation — imperative style, mixing concerns — and should be replaced with a `useState` hover boolean.

**Cross-check said:** The same pattern is specifically "anti-React" and can cause UI flickering when component re-renders conflict with the manual style mutations.

**Which is more convincing and why:** These are the same finding framed differently. Audit 1 correctly identified the principle violation. The cross-check correctly identified *why* it actually causes problems in practice — the flickering risk is a real consequence, not just a style preference. Neither audit is wrong here. The cross-check adds useful depth to Audit 1's diagnosis. The fix is identical in both: use `useState` for `isHovered` and apply styles declaratively. Take the cross-check's framing as the reason why Audit 1's fix is worth doing urgently, not just eventually.

---

## Final Verdict

The first audit was excellent on surface-level accessibility and common React hooks traps. This cross-check reveals that the app still has fundamental **Scalability** (Memoization) and **Universal Access** (rem units, contrast) issues that must be addressed before move-to-production.

---

---

# Revised: Compact Humane Version

The same findings, rewritten for readability — warmer tone, less robotic structure, same substance.

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
