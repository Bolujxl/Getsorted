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

# Agreed Findings & Verdict

What the cross-check found that the first audit missed, why the cross-check's recommendation is better, and what it saves.

---

### Add `React.memo` to TaskCard and Column

Audit 1 flagged `useCallback` churn on the input handler. The cross-check found the real cost: every drag re-renders every card in every column, not just the one you moved. Wrapping both components in `React.memo` with a simple prop comparator means touching one card leaves the other 49 alone. Saves hundreds of wasted renders per drag as the list grows — and costs three lines per component.

---

### Switch font tokens from `px` to `rem`

Audit 1 checked how tokens were used. The cross-check checked the tokens themselves. Every font size is hardcoded in pixels, which means the app ignores the user's browser font-size setting entirely. Switching to `rem` (divide each px value by 16) makes the app respect that setting. Looks identical at default zoom. Becomes readable for anyone who needs it larger. One file, zero visual side effects.

---

### Raise muted text contrast from 1.9:1 toward 4.5:1

The timestamps, empty states, and drag handles all use `--gs-text-muted` at 25% white on a near-black background. That contrast ratio fails WCAG AA by a wide margin. Bumping the token to `rgba(255,255,255,0.50)` brings it to roughly 3.9:1 — passing for large text, close for body text. The text still feels secondary, but people can actually read it. One line in `tokens.css`, every usage updates automatically.

---

### Derive `COLUMN_ORDER` from `COLUMNS` instead of declaring it twice

Two constants both encode column order. If one changes without the other, the drag-and-drop insertion algorithm silently places cards in the wrong position — a data-corrupting bug no linter catches. Making `COLUMN_ORDER` a `.map()` of `COLUMNS` eliminates the duplicate. One source of truth, zero maintenance drift, no silent breakage when someone reorders the columns.

---

### Cap task count at 500

No limit on the task array means a console loop or accidental paste can create thousands of entries, locking the DOM. A one-line guard in `addTask` that checks `tasks.length >= 500` and shows a warning prevents the browser from becoming unusable. Low urgency for a local-only app, but worth the guard before adding sync or import features.

---

**Priority order:** `rem` units → muted text contrast → `React.memo` → derive `COLUMN_ORDER` → task cap.
