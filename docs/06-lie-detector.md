# Lie Detector — GetSorted

## The Five Statements

**A.** The `addTask` function in `src/App.tsx` reads the task title from `inputRef.current.trim()` rather than the `input` state variable directly, and its `useCallback` dependency array is `[tasks.length]` — meaning the function is only recreated when the number of tasks changes, not on every keystroke.

**B.** The `onDragEnd` handler's insertion algorithm iterates `COLUMN_ORDER` — which is derived from `COLUMNS` via `COLUMNS.map(col => col.id)` — to count how many tasks sit in each column before the destination, producing the global index where the dragged task should be spliced back into the flat `tasks` array. 

**C.** The `ErrorBoundary` component in `src/ErrorBoundary.tsx` is a class component that uses `getDerivedStateFromError` to capture render crashes and `componentDidCatch` to log the error with its component stack, then renders a fallback UI containing a heading, a message, and a "Try again" button that resets the error state.

**D.** In dark mode, the `--gs-text-muted` CSS custom property in `src/tokens.css` resolves to `rgba(255,255,255,0.25)`, giving muted text elements like timestamps a contrast ratio of roughly 1.9:1 against the `#0F0F0F` app background.

**E.** The `TaskCard` component's `style` prop applies borders using individual longhand properties — `borderTop`, `borderRight`, and `borderBottom` for the three non-accent sides, plus `borderLeftWidth: 3`, `borderLeftStyle: 'solid'`, and `borderLeftColor` set to a dynamic CSS variable (`var(--gs-${task.column}-accent)`) for the coloured accent stripe.


I believe the lie is **D** — the actual `src/tokens.css` file sets `--gs-text-muted` to `rgba(255,255,255,0.50)`, not `0.25`. The opacity was increased so timestamps and other muted text can be read clearly.

---

## The Reveal

**D** is the lie.

The statement claims `--gs-text-muted` resolves to `rgba(255,255,255,0.25)` with a 1.9:1 contrast ratio. The actual value in the dark theme block was changed from `0.25` to `0.50` during the audit fixes commit. Here is the real line:

`src/tokens.css` — line 65
```css
--gs-text-muted: rgba(255,255,255,0.50);
```

At 50% opacity on the `#0F0F0F` background, the contrast ratio is roughly 3.9:1 — still not perfect, but a significant improvement over the stated 1.9:1. Every element using this token (timestamps, empty state text, drag handles, the delete icon) now renders with a readable level of contrast.

## Verdict

The investigator's guess was correct. The lie was detectable because statement D quoted a specific hex value and contrast ratio — both of which are verifiable by opening `src/tokens.css` and checking line 65. A close reader would notice the value is `0.50`, not `0.25`, and that the contrast math in the statement no longer matches the source.