# GetSorted ⚡️

> "If it's not sorted, it's not done."

GetSorted is a frictionless, high-performance task triage board. It’s built for that moment where you have ten things in your head and need to decide what’s on fire **now**, what can wait until **soon**, and what’s realistically for **later**.

## 🧠 The Philosophy
Most task apps are too heavy. GetSorted is designed for **speed of thought**:
- **Atomic Capture**: Toss a task in, hit Enter, and keep moving.
- **Visual Triage**: Drag-and-drop isn't just a feature; it's the interface. High-priority tasks stay in your line of sight.
- **Persistence without Friction**: Uses `localStorage` to keep your board alive across refreshes, but remains entirely client-side.

## 🛠 The Tech Stack
Built with a modern, "no-nonsense" stack:
- **React 19**: Leveraging the latest hooks and performance patterns.
- **Tailwind CSS v4**: Using the new `@theme` engine for a unified, modern design system.
- **@hello-pangea/dnd**: For butter-smooth drag and drop.
- **Vite**: For near-instant development cycles.

## 🏗 Architectural High-Points

### 1. The "Double-Memory" Pattern
To avoid sluggish typing in React, we use a hybrid input strategy. `useState` handles the controlled input for logic, but `useRef` acts as our high-speed "secret notebook," ensuring that we can capture tasks without triggering unnecessary UI re-renders on every single keystroke.

### 2. Single Source of Truth
The entire board’s state is a single, flat array of `Task[]` objects. Column membership isn't a complex tree; it's a simple property on each task. This makes reordering across columns mathematically stable and extremely fast.

### 3. Design Tokens (The "Vibe" Engine)
There are almost zero hardcoded hex codes or pixel values in the JSX. Everything flows through `src/tokens.css` and `src/style.css`.
- **Dark Default**: Hardened for late-night focus sessions.
- **Premium Micro-interactions**: Smooth transitions on focus, 3D "lift" effects on buttons, and high-contrast accessibility.

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Launch the board**:
   ```bash
   npm run dev
   ```

## 📂 Project Structure
- `src/App.tsx`: The heart of the app. Handles drag logic, state, and the main UI loop.
- `src/tokens.css`: The "brain" of the visual design. Colors, spacing, and contrast.
- `src/style.css`: The "muscle" of the design. Layout classes and Tailwind v4 configurations.

---
*Built with focus and precision.*
