# Tinker Log — `useRef` & the Input Pipeline

Picking up from where we left off. We are removing one line from `App.tsx` — or rather, testing what happens when we do.

---

## The original code

This function handles every keystroke in the input field. It syncs the `inputRef` (a sticky note that `addTask` reads from) with the `input` state (what React uses to re-render the input):

```ts
const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    inputRef.current = value   // ← update the sticky note
    setInput(value)            // ← trigger a re-render with the new text
}, [])
```

---

## The experiment

Remove the `inputRef.current = value` line:

```ts
const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
}, [])
```

---

## Prediction

Adding a task will break — the `inputRef.current` won't be updated, so `addTask` will read a stale (empty) value when it fires. In other words, the sticky note handed to the kitchen will be blank.

---

## What does `inputRef.current` actually do?

We got `inputRef` from this declaration:

```ts
const inputRef = useRef('')
```

### The waiter analogy

A waiter comes to your table with a sticky note. You order multiple items. The waiter writes each item down on the note as you speak, then hands the note to the kitchen. The kitchen processes the entire order from that note.

In the code:

- **`inputRef.current`** is the sticky note. Every keystroke updates it (`inputRef.current = value`).
- **`setInput(value)`** is the waiter confirming back to you what they heard — React re-renders the input field so you see your own text.
- **`addTask`** reads from the sticky note (`inputRef.current.trim()`), not from the state. That's why `addTask` doesn't need `input` in its dependency array — it's reading from a ref, which never changes identity.

If `inputRef.current = value` is removed, the sticky note stays blank. The waiter hears your order, confirms it back to you (the input still shows text because `setInput` still runs), but when they go to the kitchen the note they hand over is empty. The kitchen sees nothing, assumes you didn't order, and nothing gets cooked. Your task never appears on the board.

---

## Result

My prediction was correct. The task was not added to the board. We are standing at the tip of a broken bridge — the communication between the user's keystrokes and the `addTask` function has been severed.

---

## What this taught me

`inputRef.current` is the bridge between "what the user is typing right now" and "what `addTask` reads when Enter is pressed." Without it:

- The input field still *looks* like it works (React re-renders it via `setInput`).
- But `addTask` reads an empty string because the ref was never updated.
- The task silently fails to create — no error, no warning, just nothing happens.

And this is important in general because it demonstrates a reliable pattern for handling state in React: **use refs for values that need to be read at a specific moment without triggering re-renders.** Instead of recreating `addTask` on every keystroke (which is what `useCallback([input])` would do), we keep one stable function and update a ref — avoiding unnecessary re-renders while keeping the function's view of the latest value always fresh.
