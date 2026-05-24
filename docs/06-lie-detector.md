# Lie Detector — GetSorted

## The Five Statements

**A.** The `addTask` function in `src/App.tsx` reads the task title from `inputRef.current.trim()` rather than the `input` state variable directly, and its `useCallback` dependency array is `[tasks.length]` — meaning the function is only recreated when the number of tasks changes, not on every keystroke.

**B.** The `onDragEnd` handler's insertion algorithm iterates `COLUMN_ORDER` — which is derived from `COLUMNS` via `COLUMNS.map(col => col.id)` — to count how many tasks sit in each column before the destination, producing the global index where the dragged task should be spliced back into the flat `tasks` array. 

**C.** The `ErrorBoundary` component in `src/ErrorBoundary.tsx` is a class component that uses `getDerivedStateFromError` to capture render crashes and `componentDidCatch` to log the error with its component stack, then renders a fallback UI containing a heading, a message, and a "Try again" button that resets the error state.

**D.** In dark mode, the `--gs-text-muted` CSS custom property in `src/tokens.css` resolves to `rgba(255,255,255,0.25)`, giving muted text elements like timestamps a contrast ratio of roughly 1.9:1 against the `#0F0F0F` app background.

**E.** The `TaskCard` component's `style` prop applies borders using individual longhand properties — `borderTop`, `borderRight`, and `borderBottom` for the three non-accent sides, plus `borderLeftWidth: 3`, `borderLeftStyle: 'solid'`, and `borderLeftColor` set to a dynamic CSS variable (`var(--gs-${task.column}-accent)`) for the coloured accent stripe.


I believe the lie is **D** — the actual `src/tokens.css` file sets `--gs-text-muted` to `rgba(255,255,255,0.50)`, not `0.25`. The opacity was increased so timestamps and other muted text can be read clearly.