# GetSorted — Full Codebase Walkthrough

> Every file, every line, every decision explained.
> Two perspectives: **"Explain Like I'm 7"** (simple analogies) and **"For the Developer"** (technical reasoning).

---

## Table of Contents

1. [package.json](#1-packagejson)
2. [tsconfig.json](#2-tsconfigjson)
3. [vite.config.ts](#3-viteconfigts)
4. [index.html](#4-indexhtml)
5. [public/manifest.json](#5-publicmanifestjson)
6. [src/tokens.css](#6-srctokenscss)
7. [src/style.css](#7-srcstylecss)
8. [src/main.tsx](#8-srcmaintsx)
9. [src/App.tsx](#9-srcapptsx) 

---

## 1. `package.json`

```json
{
  "name": "getsorted",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  ...
}
```

### Line 2 — `"name": "getsorted"`
> **ELI7:** This is the name tag on the project. When you name a pet, you write it on the collar. This is the collar for our app.

> **Dev:** The npm package name. Used in error messages, lock files, and when publishing. Since this is a private project (line 3), it won't be published to the npm registry — this is purely an identifier for local tooling.

### Line 3 — `"private": true`
> **ELI7:** A "Do Not Disturb" sign. It tells npm: "Don't let anyone accidentally upload this to the internet."

> **Dev:** Prevents `npm publish` from succeeding. A safety net so internal projects never accidentally hit the public registry. Also clears npm warnings about missing fields like `repository` or `license` that public packages require.

### Line 5 — `"type": "module"`
> **ELI7:** The app speaks "new English" instead of "old English." New English lets you use `import` instead of `require`.

> **Dev:** Switches Node.js from CommonJS (`require`) to ES Modules (`import`/`export`). Without this, `.js` files wouldn't understand `import` syntax. Vite and all modern tooling expect ES modules. This is why `vite.config.ts` uses `import` statements instead of `require`.

### Lines 7–9 — Scripts
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```
> **ELI7:** Three buttons you can press:
> - **dev** — starts the app so you can see it in your browser while you work
> - **build** — packs everything up into a neat bundle ready to send to the world
> - **preview** — shows you what the bundle looks like before you send it

> **Dev:**
> - `dev` — launches Vite's dev server with HMR (Hot Module Replacement). File changes reflect in the browser instantly without a full page reload.
> - `build` — `tsc` runs the TypeScript compiler for type-checking first (`&&` means the next command only runs if the previous one succeeds). Then `vite build` produces optimized static files in `dist/`.
> - `preview` — serves the production build locally so you can verify the built output before deploying.

### Lines 11–19 — `devDependencies` vs `dependencies`
> **ELI7:** Imagine building a Lego castle. **Dependencies** are the Lego bricks that stay in the castle forever. **DevDependencies** are the tools you used to build it (instruction book, brick separator) — you don't need them once the castle is done.

> **Dev:** `devDependencies` are only installed during development. They include:
> - **`@tailwindcss/vite`** — Tailwind's Vite plugin that scans your JSX/TSX for class names and generates only the CSS you actually use. Without it, Tailwind classes would never be converted to actual CSS.
> - **`tailwindcss`** — the core framework. In Tailwind v4, Vite handles the scanning; the npm package provides the CSS generation engine.
> - **`typescript`** — The TS compiler (`tsc`). Runs as part of `npm run build` to catch type errors before bundling.
> - **`@types/react` / `@types/react-dom`** — type definitions so TypeScript understands React's API (JSX elements, hooks, event types).
> - **`@types/uuid`** — type definitions for the `uuid` library.
> - **`vite`** — the build tool itself. Compiles TypeScript, bundles modules, optimizes assets for production.

> `dependencies` are bundled into the final app and shipped to the browser:
> - **`react` / `react-dom`** — The React library. `react` provides the component model/hooks; `react-dom` handles rendering to the actual DOM.
> - **`@hello-pangea/dnd`** — The drag-and-drop library. A maintained fork of `react-beautiful-dnd`. Provides `DragDropContext`, `Droppable`, and `Draggable` components.
> - **`uuid`** — generates unique IDs (v4 — random UUIDs like `"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`). Each task gets one so they can be identified even if they have the same title.

---

## 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    ...
  },
  "include": ["src"]
}
```

### Line 3 — `"target": "es2023"`
> **ELI7:** "Translate my code into language that 2023 browsers can read."

> **Dev:** Specifies the ECMAScript version for the compiled output. ES2023 includes features like `Array.prototype.findLast`, `toSorted`, and `with`. Since Vite handles the actual transpilation, this mainly affects TypeScript's type-checking assumptions about which JS APIs exist.

### Line 5 — `"jsx": "react-jsx"`
> **ELI7:** "Hey computer, when you see `<App />`, turn it into React code."

> **Dev:** Tells TypeScript how to handle JSX syntax. `"react-jsx"` (the modern option, introduced in React 17) uses the automatic JSX runtime — meaning you **don't need** `import React from 'react'` at the top of every file. Instead, Vite injects `import { jsx } from 'react/jsx-runtime'` automatically during compilation. Without this setting, every `.tsx` file would error with "Cannot use JSX unless the '--jsx' flag is provided."

### Line 7 — `"types": ["vite/client"]`
> **ELI7:** "These are the special dictionaries TypeScript should read so it knows about Vite features."

> **Dev:** Includes Vite's client type declarations. This adds types for:
> - `import.meta.env` (environment variables)
> - `import.meta.hot` (HMR API)
> - Static asset imports like `import logo from './logo.svg'` (resolves to a URL string)
> Without this, TypeScript would error on any Vite-specific syntax.

### Line 8 — `"skipLibCheck": true`
> **ELI7:** "Don't waste time proofreading other people's books — just check my own pages."

> **Dev:** Skips type-checking of `.d.ts` files in `node_modules`. Dramatically speeds up compilation since library type definitions can be enormous. The trade-off: if a library has a type bug, you won't catch it — but in practice, this is rarely an issue and the speedup is essential.

### Line 11 — `"moduleResolution": "bundler"`
> **ELI7:** "Find files the way Vite would, not the way old computers would."

> **Dev:** Modern resolution strategy designed for bundlers (Vite, webpack, esbuild). Unlike `"node"` resolution, this:
> - Supports imports without file extensions (e.g., `import App from './App'` resolves to `./App.tsx`)
> - Respects `package.json` `"exports"` field
> - Handles `"type": "module"` packages correctly
> This setting is required for `allowImportingTsExtensions` (line 12) to work.

### Line 12 — `"allowImportingTsExtensions": true`
> **ELI7:** "It's OK to write `./App.tsx` in your imports — I know what you mean."

> **Dev:** Permits file extensions in import paths (e.g., `import './App.tsx'` instead of `import './App'`). Must be paired with `"moduleResolution": "bundler"` and `"noEmit": true` because the emitted JS would contain invalid extension references (a bundler strips them during compilation).

### Line 13 — `"verbatimModuleSyntax": true`
> **ELI7:** "If you're only borrowing a type (not a real thing), you must say `import type`."

> **Dev:** Requires explicit `import type` for type-only imports. This has two benefits:
> 1. The compiler can safely erase type imports without checking if they have runtime side effects
> 2. Build tools can tree-shake more aggressively because they know type imports leave no trace in the output
> This is why our code uses `import type { DropResult, ... } from '@hello-pangea/dnd'` instead of mixing types and values in one import.

### Line 14 — `"moduleDetection": "force"`
> **ELI7:** "Treat EVERY file as an ES module, even if it doesn't have import/export."

> **Dev:** All files are treated as ES modules regardless of content. The default behavior auto-detects module vs script based on import/export statements, but this can cause inconsistencies. `"force"` ensures uniform behavior across the entire codebase.

### Line 15 — `"noEmit": true`
> **ELI7:** "Don't create `.js` files — Vite will handle that part. You just check for mistakes."

> **Dev:** TypeScript acts as a type-checker only, never producing JavaScript output. Vite uses esbuild for transpilation (faster than `tsc`), so TypeScript's role is purely to verify correctness. The actual compilation happens in Vite's build pipeline.

### Lines 18–20 — Strictness flags
> **ELI7:** "Show me my mistakes! If I create a variable and never use it, wave a red flag."

> **Dev:**
> - **`noUnusedLocals: true`** — errors on declared-but-unused local variables. Prevents dead code from accumulating. This is why we removed the unused `const s` in `TaskCard`.
> - **`noUnusedParameters: true`** — errors on declared-but-unused function parameters. Keeps function signatures honest.
> - **`noFallthroughCasesInSwitch: true`** — prevents accidental fallthrough in switch statements (forgetting a `break` between cases).
> - **`erasableSyntaxOnly: true`** — disallows TypeScript-specific syntax that produces runtime code, like `enum` and `namespace`. Ensures all TypeScript syntax can be cleanly removed ("erased") during compilation without affecting runtime behavior.

### Line 23 — `"include": ["src"]`
> **ELI7:** "Only look inside the `src/` folder for TypeScript files to check."

> **Dev:** Limits compilation to the source directory. Files outside `src/` (like `vite.config.ts` at root) are excluded from the type-checking scope, which prevents config files from being included in the output or triggering build errors.

---

## 3. `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

### Line 1 — `import { defineConfig } from 'vite'`
> **ELI7:** "Grab a special helper tool from the Vite toolbox that helps me write settings."

> **Dev:** `defineConfig` is a utility that provides TypeScript autocompletion and validation for Vite's configuration object. It's optional — you could just `export default { plugins: [...] }` — but using it gives you IDE intellisense and catches config errors at write time rather than runtime. It's a "no-op" at runtime (just returns the object you pass it) but invaluable during development.

### Line 2 — `import tailwindcss from '@tailwindcss/vite'`
> **ELI7:** "Get the Tailwind CSS engine for Vite — this is what turns your style classes into real CSS."

> **Dev:** The official Vite plugin for Tailwind CSS v4. It hooks into Vite's build pipeline to:
> 1. Scan all source files for class names at build time
> 2. Generate only the CSS rules that are actually used (zero unused CSS in production)
> 3. Handle the `@import "tailwindcss"` directive in CSS files
> 4. Process the `@theme` block (which we use in `style.css` to expose our design tokens as Tailwind utility classes)
> Without this plugin, the `@import "tailwindcss";` line in `style.css` would be meaningless — no CSS would be generated for any Tailwind class.

### Line 4 — `export default defineConfig({ plugins: [tailwindcss()] })`
> **ELI7:** "Here are the settings: use the Tailwind plugin. That's all we need."

> **Dev:** The configuration object. The `plugins` array registers Vite plugins. `tailwindcss()` calls the plugin factory with no custom options (all defaults). Vite reads this file and activates the plugin pipeline: on `dev`, it watches for class changes; on `build`, it generates the minimal production CSS bundle.

---

## 4. `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    ...
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Line 1 — `<!doctype html>`
> **ELI7:** A flag that tells the browser "This is a modern webpage, not one from 1998."

> **Dev:** Declares the document as HTML5. Without it, browsers may fall back to "quirks mode" (emulating old browser bugs), which breaks CSS layout and modern APIs.

### Line 2 — `<html lang="en">`
> **ELI7:** "The page is in English" — this helps screen readers pronounce words correctly.

> **Dev:** Sets the document language for accessibility tools, search engines, and translation APIs. Screen readers use this to pick the correct pronunciation engine.

### Line 4 — `<meta charset="UTF-8" />`
> **ELI7:** "Use the alphabet that can write emojis, Chinese characters, and letters from every language — not just English."

> **Dev:** Declares the character encoding as UTF-8, which supports all Unicode characters. Must appear within the first 1024 bytes of the document for browsers to detect it before parsing content.

### Lines 7–9 — Favicon links
```html
<link rel="icon" type="image/svg+xml" href="/icon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```
> **ELI7:** Three tiny pictures that appear in different places: the browser tab, your bookmarks bar, and your phone's home screen.

> **Dev:**
> - **SVG favicon** (`/icon.svg`) — modern browsers prefer this for tabs because it scales crisply at any size without pixelation
> - **32×32 PNG** — fallback for older browsers that don't support SVG favicons
> - **Apple touch icon** — used when saving the page to an iOS home screen. 180×180 is the size for iPhone X and newer (retina displays). The `rel="apple-touch-icon"` attribute is Apple-specific — regular `icon` links won't trigger the home screen icon behavior.

### Lines 12–13 — PWA metadata
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#111111" />
```
> **ELI7:** "If someone adds this app to their phone, here's how it should look and behave."

> **Dev:**
> - The manifest link tells browsers this is a PWA. It points to a JSON file that defines the app name, icons, display mode, and colors.
> - `theme-color` tints the browser's UI chrome (address bar on mobile Chrome, title bar on desktop PWA). `#111111` matches the dark header background. On Android, this color shows during the splash screen transition.

### Line 15 — Manrope font
```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
```
> **ELI7:** "Download a special handwriting style from Google so our app looks nice."

> **Dev:** Loads the Manrope font family from Google's CDN. The `wght@400;500;600;700` query parameter fetches four specific weight variants — only what the app needs, keeping the download small (~40KB total). `display=swap` means text renders immediately in a fallback font while Manrope loads, preventing a blank flash (FOUT — Flash of Unstyled Text). Once loaded, the browser swaps to Manrope smoothly.

### Line 16 — Viewport
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
> **ELI7:** "Make the page fit on a phone screen. Don't start zoomed way out."

> **Dev:** Critical for responsive design. Without it, mobile browsers render the page at a desktop width (~980px) and then zoom out, making everything tiny. `width=device-width` matches the viewport to the actual device screen width. `initial-scale=1.0` sets the default zoom level to 100%.

### Line 17 — Title
```html
<title>GetSorted - Sort your day. Win it.</title>
```
> **ELI7:** The name that shows on the browser tab.

> **Dev:** Sets the document title shown in browser tabs, bookmarks, and search results. Also serves as the fallback app name for PWA installations if the manifest doesn't provide one.

### Line 20 — `<div id="app"></div>`
> **ELI7:** "An empty box. React will fill it with all the buttons, text, and lists that make up the app."

> **Dev:** The mounting point for React. `createRoot(document.getElementById('app')!)` in `main.tsx` finds this div and renders the entire React component tree inside it. It starts empty — all visible content is created by React at runtime.

### Line 21 — `<script type="module" src="/src/main.tsx"></script>`
> **ELI7:** "Start the app by running the file called `main.tsx`."

> **Dev:** The entry point. `type="module"` tells the browser to treat this as an ES module (enabling `import`/`export`). Vite intercepts this during development and transforms it into a module graph. The `main.tsx` file imports React, renders the `<App />` component, and imports `style.css` (which triggers Tailwind's CSS processing).

---

## 5. `public/manifest.json`

```json
{
  "name": "GetSorted",
  "short_name": "GetSorted",
  "description": "Sort your daily chaos into Now, Soon, and Later.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111111",
  "theme_color": "#111111",
  "icons": [
    { "src": "/favicon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/favicon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Lines 2–3 — Name and short name
> **ELI7:** "The app's full name, and a shorter version for when there's not much space."

> **Dev:** `name` is used on the install prompt and splash screen. `short_name` appears under the icon on Android home screens (truncated if too long — but "GetSorted" fits). If they differ, `short_name` is typically ≤12 characters.

### Line 4 — Description
> **ELI7:** "A sentence that tells people what the app does."

> **Dev:** Shown on the install prompt (Android) and in browser features like "Add to Home Screen." Also used by some app store indexing if the PWA is submitted to stores via TWA.

### Line 5 — `"start_url": "/"`
> **ELI7:** "When you open the app, always go to the home page."

> **Dev:** Defines the URL that loads when the PWA launches from the home screen. `/` means the root. If your app supported deep linking (e.g., opening a specific task), you'd use `?utm_source=homescreen` or similar. Currently, `"/"` is correct since all state is in memory.

### Line 6 — `"display": "standalone"`
> **ELI7:** "Look like a real app — no browser address bar, no back button."

> **Dev:** Controls the PWA window mode:
> - `standalone` — opens in its own window, no browser chrome, with its own app switcher entry. Looks identical to a native app.
> - `browser` — opens in the normal browser tab
> - `minimal-ui` — compact browser controls
> - `fullscreen` — no chrome at all, typically for games

### Lines 7–8 — Background and theme colors
> **ELI7:** "The splash screen color and the title bar color — both deep dark."

> **Dev:**
> - `background_color` — the color shown during the PWA splash screen (before content renders). Should match the app's actual background to prevent a jarring transition
> - `theme_color` — tints the status bar and browser chrome. Matches the header bar `#111111`
> Both match the dark theme default since the app defaults to dark mode.

### Lines 9–12 — Icons
> **ELI7:** "Two pictures in different sizes — one small (192 pixels) for phones, one big (512 pixels) for computers."

> **Dev:** Chrome requires at least a 192×192 and 512×512 icon for the install prompt to fire. The larger icon is used on the splash screen; the smaller on the home screen. All paths are relative to the manifest's location (root `public/`), so `/favicon-512x512.png` resolves correctly.

---

## 6. `src/tokens.css`

This file is the **design system foundation** — it defines every color, font size, spacing value, and border radius as CSS custom properties (variables). The component code references these variables by name and never hardcodes hex values. This means switching from dark to light mode happens entirely in this file.

### Lines 1–5 — Header comment
```css
/* ============================================
   GETSORTED — Design Tokens v2
   Dark default, auto light via prefers-color-scheme.
   Manual override: html.light / html.dark
   ============================================ */
```
> **ELI7:** This is the "paint factory" — it stores all the colors and sizes. There's a dark version (nighttime) and a light version (daytime). It switches automatically based on whether your computer is in dark mode or light mode.

> **Dev:** The three-mode theming strategy:
> 1. **`@media (prefers-color-scheme: light)`** — OS-level preference, zero JS required
> 2. **`html.light` / `html.dark`** — manual CSS class override for testing or user preference
> 3. **`:root` default** — dark theme, no class or media query needed

### Lines 8–46 — Raw palette
```css
:root {
  --gs-now-500:    #E84545;
  --gs-now-50:     #FFF0F0;
  ...
  --gs-radius-sm:   6px;
  --gs-space-1: 4px;
  --gs-text-xs:   11px;
  ...
}
```
> **ELI7:** These are the "base ingredients." Like flour, sugar, and eggs in a recipe. You never eat them raw — you combine them to make cookies.

> **Dev:** The raw design tokens set on `:root` so they're available everywhere. Using the MD3 naming convention:
> - **Color scale notation**: `--gs-{name}-{weight}` where weight follows a 50–900 scale (50 = lightest, 900 = darkest)
> - **Semantic naming**: `--gs-{property}-{size}` for spacing/radius/typography
> - **`gs-` prefix**: scopes all tokens to GetSorted to avoid collisions with other CSS on the page
> 
> The comment says "never use in components." This is a design system discipline: components reference the **semantic role** variables (like `--gs-text-primary`) which are aliased from these raw values. If we ever need to change the primary text color, we change only the semantic-to-raw mapping, not every component. The raw values on `:root` are also the ones that DON'T change between themes (like the accent red #E84545 is the same red in both light and dark).

### Lines 43–46 — Accent shortcuts
```css
--gs-now-accent:  var(--gs-now-500);
--gs-soon-accent: var(--gs-soon-500);
--gs-later-accent: var(--gs-later-500);
```
> **ELI7:** "The accent color for each column is just the 500 version of its color — not too dark, not too light."

> **Dev:** These create semantic aliases specifically for the accent color use case (border-left on cards, dashed drop-zone outlines). By aliasing through `var()`, if we ever changed `--gs-now-500` from `#E84545` to something else, every accent reference updates automatically. This is the power of CSS variable chains — change one value, update everywhere.

### Lines 52–53 — Dark theme declaration
```css
:root,
html.dark {
  color-scheme: dark;
```
> **ELI7:** "If nothing special is happening, use dark mode. Or if someone puts a 'dark' sticker on the page, also use dark mode."

> **Dev:** The comma-separated selector means both `:root` (the default, no-class state) AND `html.dark` (explicit override) get dark theme tokens. This is intentional:
> - `:root` alone makes dark the default when nobody has set a preference
> - `html.dark` allows programmatic override via a class toggle
> - `color-scheme: dark` tells the browser to render native form controls (selects, scrollbars, input fields) in their dark variants

### Lines 57–60 — App shell tokens (dark)
```css
--gs-app-bg:         #0F0F0F;
--gs-nav-bg:         #0A0A0A;
--gs-header-bg:      #0F0F0F;
--gs-header-border:  rgba(255,255,255,0.07);
```
> **ELI7:** "The main background is almost-black. The top bar is also almost-black, with a very faint white line underneath it."

> **Dev:**
> - `#0F0F0F` — slightly lifted from true black (`#000000`) which looks harsh on OLED screens. This tiny lift reduces eye strain while keeping the dark aesthetic
> - `rgba(255,255,255,0.07)` — 7% opacity white border. Using RGBA instead of a hex color means the border works on any background — it's 7% white regardless of what's behind it. This is essential for theming since the same variable gets different values in light mode.

### Lines 63–66 — Text tokens (dark)
```css
--gs-text-primary:   #FFFFFF;
--gs-text-secondary: rgba(255,255,255,0.5);
--gs-text-muted:     rgba(255,255,255,0.25);
--gs-text-heading:   #FFFFFF;
```
> **ELI7:** Four levels of text brightness:
> - **Primary** — pure white, for the important stuff
> - **Secondary** — half-transparent white, for dates and less important info
> - **Muted** — quarter-transparent white, for things you barely need to see (drag handle, empty state text)
> - **Heading** — pure white, same as primary (but a separate token so headings can change independently later)

> **Dev:** Opacity-based text creates a natural visual hierarchy without needing a separate set of gray colors. `rgba(255,255,255,0.5)` creates a mid-gray that works against any dark background. This approach is great for theming because the same semantic tokens (`--gs-text-secondary`) resolve to different actual colors in dark vs light, but the component code never changes.

### Lines 69–72 — Card tokens (dark)
```css
--gs-card-bg:        #1E1E1E;
--gs-card-hover:     #242424;
--gs-card-border:    rgba(255,255,255,0.08);
--gs-card-border-hover: rgba(255,255,255,0.14);
```
> **ELI7:** Card surfaces are slightly lighter than the background so you can tell they're separate. When you hover, they get even lighter and the border gets a tiny bit more visible.

> **Dev:** The surface elevation model — surfaces that sit "on top" of the background should be lighter in dark mode (and darker in light mode). This creates a sense of depth:
> - Background: `#0F0F0F` (darkest)
> - Cards: `#1E1E1E` (lifted)
> - Card hover: `#242424` (further lifted)
> The border follows the same principle: 8% → 14% opacity on hover.

### Lines 74–76 — Column tokens (dark)
```css
--gs-col-bg:         #161616;
--gs-col-border:     rgba(255,255,255,0.06);
```
> **ELI7:** Each column is its own little box with a slightly different gray than the cards.

> **Dev:** The column background (`#161616`) sits between the app background (`#0F0F0F`) and cards (`#1E1E1E`), creating a three-layer depth hierarchy: background < column < card.

### Lines 79–83 — Input tokens (dark)
```css
--gs-input-bg:       #1A1A1A;
--gs-input-border:   rgba(255,255,255,0.1);
--gs-input-text:     #FFFFFF;
--gs-input-placeholder: rgba(255,255,255,0.3);
--gs-input-focus:    rgba(255,255,255,0.25);
```
> **ELI7:** "The text box where you type has its own slightly-lighter dark background, with a faint white border. When you click in it, the border gets a bit brighter so you know it's ready for typing."

> **Dev:** Input-specific tokens. The focus state (`0.25` opacity) provides a noticeable-but-not-garish visual cue. In light mode (line 147), the focus border is `#111111` (pure black) — a sharp contrast that makes it obvious where the focus is.

### Lines 86–87 — Button tokens (dark)
```css
--gs-btn-bg:         #FFFFFF;
--gs-btn-text:       #111111;
```
> **ELI7:** "In dark mode, buttons are white with dark text — the opposite of the background."

> **Dev:** The button inverts the color scheme. This creates maximum contrast and makes the "Add" button the most visually prominent element in the header.

### Line 94 — Drag shadow (dark)
```css
--gs-drag-shadow:    0 12px 32px rgba(0,0,0,0.5);
```
> **ELI7:** "When you pick up a card to drag it, it casts a big dark shadow underneath."

> **Dev:** `box-shadow` values: `offset-x: 0`, `offset-y: 12px` (shadow drops below), `blur-radius: 32px` (very soft edge), `spread: 0`, `color: rgba(0,0,0,0.5)` (50% black). This creates a pronounced "floating" effect — the card looks like it's been physically lifted off the board.

### Lines 100–116 — Per-column tokens (dark)
```css
--gs-now-header-bg:    var(--gs-now-500);
--gs-now-header-text:  #FFFFFF;
--gs-now-col-bg:       rgba(232,69,69,0.06);
--gs-now-badge-bg:     rgba(0,0,0,0.25);
```
> **ELI7:** "The NOW column: red header with white text, a very faint red wash on the inside, and a dark bubble for the count."

> **Dev:** Each column has its own color system:
> - **Header BG**: the solid 500-level accent color (red, amber, blue) — visually distinct and immediately recognizable
> - **Header text**: white or near-black depending on contrast against the accent
> - **Column body BG**: 6% opacity of the accent color on a dark background. This creates a subtle tint that reinforces the column identity without overwhelming the cards. The `rgba(232,69,69,0.06)` syntax is used instead of a hex because it blends properly regardless of what's underneath
> - **Badge BG**: semi-transparent black so the badge pops against the colored header
> Note: `--gs-soon-header-bg` uses `var(--gs-soon-500)` (#F5A623 — amber) and `--gs-soon-header-text` is `#1A0A00` (very dark brown) instead of white. This is because amber is bright enough that black text is more readable than white text on it — a deliberate contrast decision.

### Lines 122–174 — Light theme (media query)
```css
@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --gs-app-bg: #F5F5F0;
    ...
  }
}
```
> **ELI7:** "If your computer says 'I like light mode,' all these colors change to bright, warm versions. The background becomes off-white, text becomes dark, and cards become white."

> **Dev:** The `@media (prefers-color-scheme: light)` query activates when the OS is set to light mode. It redefines the same CSS variables with light-appropriate values. Key differences from dark:
> - Background: `#0F0F0F` → `#F5F5F0` (off-white with a warm tint)
> - Text: pure white → near-black `#111111`
> - Cards: `#1E1E1E` → pure white `#FFFFFF`
> - Column body: uses the 50-level palette color instead of 6% RGBA (e.g., `var(--gs-now-50)` → `#FFF0F0`, the lightest red from the palette). Solid colors look better in light mode than RGBA overlays.
> 
> The `:root` inside the media query overrides the `:root` defaults from the dark theme. CSS cascade rules: the media query has higher specificity because it's gated by a condition, so when the OS is light, these values win.

### Lines 177–227 — Manual override (`html.light`)
> **ELI7:** "Sometimes you want to force light mode even if your computer prefers dark. Adding `class="light"` to the `<html>` tag makes that happen."

> **Dev:** This duplicates the light theme variable definitions under the `html.light` class selector. This serves two purposes:
> 1. **Testing** — developers can force light mode in the browser DevTools by adding the class
> 2. **User preference override** — if we ever add a theme toggle, it sets this class on `<html>`
> The `html.light` selector has higher specificity than `:root` alone, so it overrides regardless of OS preference. Note that `html.dark` is already handled by the base `:root, html.dark` selector on line 52 — adding the dark class is redundant since it's the default.

---

## 7. `src/style.css`

This file bridges the design tokens (CSS custom properties) with Tailwind CSS's utility class system.

### Line 1 — `@import "tailwindcss";`
> **ELI7:** "Load the Tailwind CSS magic — this is what makes classes like `flex` and `text-center` actually work."

> **Dev:** A special Tailwind v4 directive processed by the `@tailwindcss/vite` plugin. It's NOT a standard CSS import — the Vite plugin intercepts it and replaces it with Tailwind's generated CSS (all utility classes, base styles, etc.). Without the Vite plugin, this would be an invalid CSS import.

### Line 2 — `@import "./tokens.css";`
> **ELI7:** "Now also load all our custom colors and sizes we defined earlier."

> **Dev:** Standard CSS import resolved by Vite at build time. The contents of `tokens.css` (all those `:root { --gs-*: ... }` declarations) are inlined into the final bundle. Since `tokens.css` is imported BEFORE the `@theme` block, all CSS variables are available when the theme block references them.

### Lines 4–79 — `@theme { ... }`
```css
@theme {
  --color-gs-app-bg: var(--gs-app-bg);
  --color-gs-now-accent: var(--gs-now-accent);
  --font-size-gs-xs: var(--gs-text-xs);
  --radius-gs-sm: var(--gs-radius-sm);
  ...
}
```
> **ELI7:** "Tell Tailwind about our special colors and sizes. Now we can write `bg-gs-app-bg` instead of remembering the hex code, and Tailwind understands it."

> **Dev:** Tailwind v4's `@theme` directive registers custom design tokens with the utility class generator. Each declaration creates a corresponding utility class:
> 
> | `@theme` declaration | Generated utilities |
> |---|---|
> | `--color-gs-now-accent: var(--gs-now-accent)` | `bg-gs-now-accent`, `text-gs-now-accent`, `border-gs-now-accent`, `border-gs-now-accent/50`, `ring-gs-now-accent`, etc. |
> | `--font-size-gs-xs: var(--gs-text-xs)` | `text-gs-xs` (which sets `font-size: 11px`) |
> | `--radius-gs-sm: var(--gs-radius-sm)` | `rounded-gs-sm` (which sets `border-radius: 6px`) |
> | `--box-shadow-gs-drag: var(--gs-drag-shadow)` | `shadow-gs-drag` (which sets `box-shadow: 0 12px 32px rgba(0,0,0,0.5)`) |
> 
> The naming convention `--color-gs-*` tells Tailwind this is a color (enabling opacity modifiers like `/50`). `--font-size-gs-*` creates fontSize utilities. `--radius-gs-*` creates borderRadius utilities. `--box-shadow-gs-*` creates boxShadow utilities.

### Lines 81–89 — Body base styles
```css
body {
  margin: 0;
  font-family: 'Manrope', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.55;
  background: var(--gs-app-bg);
  color: var(--gs-text-primary);
}
```
> **ELI7:** "Start with no gaps around the edges, use the Manrope font, make text 14 pixels tall, and use the app's background color."

> **Dev:** Sets the global defaults. `margin: 0` removes the browser's default 8px body margin. `font-family: 'Manrope', sans-serif` applies the web font with a fallback to the system sans-serif if it fails to load. The `font-weight: 500` (medium) and `line-height: 1.55` (unitless — multiplies font-size) match the design spec for body text. `var(--gs-app-bg)` references the token that changes between dark/light themes — the body automatically updates when the theme switches.

### Lines 91–94 — Global placeholder style
```css
::placeholder {
  color: var(--gs-input-placeholder);
  opacity: 1;
}
```
> **ELI7:** "Make the gray hint text inside text boxes use our special color, and make it fully visible (not faded)."

> **Dev:** Browser defaults for `::placeholder` vary — Firefox applies `opacity: 0.54`, which interferes with custom colors. Setting `opacity: 1` ensures the token color renders exactly as specified. Without this, our carefully chosen `rgba(255,255,255,0.3)` placeholder color would be further dimmed by the browser, making it nearly invisible.

---

## 8. `src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
> **ELI7:** "This is the starting line of our app. It finds the empty box in the HTML file, then fills it with the whole app. It's like plugging in a game console — once it's connected, the TV (your browser) shows everything."

### Line 1 — `import { StrictMode } from 'react'`
> **ELI7:** "Get a 'safety inspector' from React that double-checks everything is working correctly."

> **Dev:** `StrictMode` is a development-only wrapper that:
> - Runs effects and renders twice to detect impure code
> - Warns about deprecated APIs
> - Detects unexpected side effects
> It has zero effect in production builds. It's a debugging tool that helps catch subtle bugs early. The double-render is why you might see `console.log` fire twice in dev — that's intentional, not a bug.

### Line 2 — `import { createRoot } from 'react-dom/client'`
> **ELI7:** "Get the 'root planter' from React — this is the tool that plants the app into the web page."

> **Dev:** `createRoot` is React 18+'s new API for mounting a React tree. It replaces the pre-18 `ReactDOM.render()`. Benefits:
> - Enables concurrent features (automatic batching of state updates)
> - Cleaner API: returns a root object with `render()` and `unmount()` methods
> - Import from `'react-dom/client'` (not `'react-dom'`) — this is the modern entry point

### Line 3 — `import App from './App'`
> **ELI7:** "Bring in the main App component — the big blueprint for the whole page."

> **Dev:** Default import from `./App.tsx` (extension omitted per `moduleResolution: "bundler"`). Since `App.tsx` exports a function component as `export default App`, this import receives that function directly. The `.tsx` extension is not needed in the import because the bundler resolves it automatically.

### Line 4 — `import './style.css'`
> **ELI7:** "Also bring in the styling rules — colors, fonts, spacing — so the app doesn't look plain."

> **Dev:** A side-effect import. This doesn't import a value — it tells Vite to include `style.css` in the module graph. Vite processes the CSS file (resolving `@import "tailwindcss"` via the Tailwind plugin, inlining tokens, and generating utility classes), then injects it into the page. Without this line, no Tailwind classes would work and no design tokens would be available.

### Lines 6–9 — `createRoot(...).render(...)`
```tsx
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```
> **ELI7:** "Find the `<div id="app">` box we made in the HTML file. Plant the App inside it, wrapped in the safety inspector."

> **Dev:**
> - `document.getElementById('app')!` — the `!` is TypeScript's non-null assertion. It tells the compiler "I guarantee this element exists" (and it does — it's in `index.html`). Without `!`, TypeScript would complain that `getElementById` could return `null`.
> - `.render()` — starts the React reconciliation process, turning the virtual DOM tree (`<App />`) into real DOM nodes inside the `#app` div.
> - `<StrictMode>` wraps `<App />` — this means all descendants (the entire app) get the strict mode checks described above.

---

## 9. `src/App.tsx`

This is the main application file — 464 lines of TypeScript + JSX containing the entire UI and logic. We'll break it into sections.

### Lines 1–5 — Header comment
```tsx
// GetSorted — a drag-and-drop priority board for daily task triage.
// Component tree: App > Header + Board > Column[] > TaskCard[]
// State lives in App via useState<Task[]>. Drag-and-drop uses @hello-pangea/dnd.
// No persistence; all data is ephemeral in-memory state.
// All colours via CSS variables from tokens.css; no hardcoded hex values.
```
> **ELI7:** A quick summary of what this file does: it's a task-sorting board. You drag cards between three columns. Nothing gets saved — when you refresh, it resets. All colors come from the token file.

> **Dev:** Documents the architecture at a glance: the component hierarchy, state management approach, library choice, and the important constraint (no persistence, token-only colors). This is for the next developer who opens this file.

### Lines 7–16 — Imports
```tsx
import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type {
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot,
} from '@hello-pangea/dnd'
import { v4 as uuidv4 } from 'uuid'
```
> **ELI7:** "Load the tools we need: React's memory (`useState`) and performance helper (`useCallback`), the drag-and-drop library with three parts (Context, Droppable, Draggable), and a random ID maker (`uuid`)."

> **Dev:** Two import categories:
> 1. **Value imports** (lines 7, 8, 16) — actual JavaScript values used at runtime
> 2. **Type imports** (lines 9–15) — TypeScript types erased at compile time. Using `import type` instead of mixing types with values is required by `verbatimModuleSyntax` (tsconfig). The types from `@hello-pangea/dnd` are:
>    - `DropResult` — the shape of `onDragEnd`'s callback argument
>    - `DroppableProvided` — the object passed to Droppable's children render function (contains `innerRef` and `droppableProps`)
>    - `DroppableStateSnapshot` — the second argument to Droppable's children function (contains `isDraggingOver`)
>    - `DraggableProvided` — the object passed to Draggable's children function
>    - `DraggableStateSnapshot` — the state object for Draggable (contains `isDragging`)

### Lines 22–29 — `ColumnId` type and `Task` interface
```tsx
type ColumnId = 'now' | 'soon' | 'later'

interface Task {
  id: string
  title: string
  column: ColumnId
  createdAt: number
}
```
> **ELI7:**
> - `ColumnId` is a rule: you can only say "now," "soon," or "later" — nothing else. If you try to say "tomorrow," TypeScript says "nope!"
> - `Task` is the shape of each card: it has a unique ID (like a name tag), a title (what you need to do), which column it's in, and when you created it.

> **Dev:**
> - `type ColumnId` is a **string literal union type**. It accepts exactly three string values. This is more type-safe than `string` — if you write `task.column = 'yesterday'`, TypeScript catches it at compile time.
> - `interface Task` defines the data structure. `createdAt` is typed as `number` because `Date.now()` returns a Unix timestamp (milliseconds since Jan 1 1970). Storing timestamps (not Date objects) makes comparison and serialization trivial — you can `Math.floor(diff / 60_000)` to get minutes.

### Lines 35–40 — `COLUMNS` config
```tsx
const COLUMNS: { id: ColumnId; label: string; empty: string }[] = [
  { id: 'now',   label: 'NOW',   empty: 'Nothing on fire. Nice.' },
  { id: 'soon',  label: 'SOON',  empty: 'Queue is clear.' },
  { id: 'later', label: 'LATER', empty: 'No backlog. Rare.' },
]
```
> **ELI7:** "Here are the three columns: NOW (red, urgent), SOON (amber, important), and LATER (blue, relaxing). Each has a funny message for when there are no tasks in it."

> **Dev:** A static configuration array. Using a data structure instead of hardcoding three `<Column>` instances means we can `map()` over it to render columns dynamically. If we ever wanted to add a fourth column ("Someday"), we'd add one entry here and the entire UI updates.

### Line 41 — `COLUMN_ORDER`
```tsx
const COLUMN_ORDER: ColumnId[] = ['now', 'soon', 'later']
```
> **ELI7:** "The columns always appear in this order: NOW first, then SOON, then LATER."

> **Dev:** Defines the canonical left-to-right order for the grid. Used in two places:
> 1. The `Board.map()` renders columns in this order
> 2. The `onDragEnd` handler uses this to calculate the correct insertion index when moving tasks between columns

### Lines 43–51 — `ColumnStyle` interface
```tsx
interface ColumnStyle {
  headerBg: string
  headerText: string
  colBg: string
  badgeBg: string
  badgeText: string
  accent: string
  accentBorder: string   // dashed border class for drop-zone
}
```
> **ELI7:** "For each column, we need to remember: what color is the header? What color is the text on it? What about the inside of the column? And the little number bubble? And the accent stripe on cards? And the dashed line when you're dragging over it?"

> **Dev:** Describes the shape of the style map. Each property is a **Tailwind class string** (not a CSS value). This is the "class name adapter" pattern — instead of spreading inline styles everywhere, we store class names in a lookup table and apply them via template literals like `className={s.headerBg}`.

### Lines 53–81 — `columnStyles` map
```tsx
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
  soon: { ... },
  later: { ... },
}
```
> **ELI7:** "This is the color cheat sheet. For the NOW column: use red header, white text, light-red inside, dark bubble, red accent stripe on cards, and a 50%-see-through red dashed line. For SOON: same pattern but amber. For LATER: same but blue."

> **Dev:** A `Record<ColumnId, ColumnStyle>` maps each column ID to its Tailwind class strings. The `Record<K, V>` utility type creates `{ [key in K]: V }` — effectively `{ now: ColumnStyle; soon: ColumnStyle; later: ColumnStyle }`. The `accentBorder` uses Tailwind's opacity modifier syntax (`/50`) to generate `border-color: color-mix(in srgb, var(--gs-now-accent) 50%, transparent)`.

### Lines 87–101 — `getRelativeTime` function
```tsx
function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
```
> **ELI7:** "Figure out how long ago something was created. If it was 30 seconds ago, say 'Just now.' If it was 5 minutes ago, say '5 mins ago.' If it was 3 hours ago, say '3 hours ago.' If it was yesterday, show the actual time like '2:34 PM.'"

> **Dev:**
> - **Line 88** — `Date.now() - timestamp` gives the difference in milliseconds
> - **Line 89** — `60_000` is 60 seconds × 1000 ms = 1 minute in milliseconds. The underscore is a numeric separator — `60_000` is exactly `60000` but more readable
> - **Line 89** — `Math.floor()` rounds down, so 59.9 seconds → 59 → not "1 min ago"
> - **Lines 91–92** — template literal with ternary for plural: `1 min ago` vs `2 mins ago`
> - **Line 97** — `toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })` uses the browser's locale to format the time. The empty array `[]` means "use the default locale." `hour: 'numeric'` gives 12-hour (2 PM) or 24-hour (14:00) depending on locale. `minute: '2-digit'` zero-pads single-digit minutes (9:05, not 9:5)
> - **Edge case**: if `timestamp` is in the future, `diff` is negative and `mins < 1` is true → returns "Just now." This is acceptable since tasks are created with `Date.now()`.

### Lines 107–238 — `App` component (the main component)

#### Lines 107–109 — Component declaration
```tsx
function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
```
> **ELI7:** "The main room of the app. It remembers two things: the list of all tasks, and whatever you're typing in the text box."

> **Dev:** Two pieces of state:
> 1. `tasks: Task[]` — the entire application data. Every task lives in this array. The `column` field on each task determines which column it appears in. Initialized as an empty array `[]` — no persisted data.
> 2. `input: string` — the controlled input value for the task creation field. Empty string initially.

#### Lines 111–122 — `addTask`
```tsx
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
```
> **ELI7:** "When you press Enter or click Add: take what you typed, trim off extra spaces, skip it if it's empty, then make a new card with a random ID, your text, put it in the NOW column, and stamp it with the current time. Clear the text box so you can type the next thing."

> **Dev:**
> - `useCallback` memoizes the function — it only creates a new function reference when `input` changes. This prevents unnecessary re-renders of child components that receive `addTask` as a prop (though in our case, it's only used in the header, so the benefit is minimal here — included for correctness).
> - `input.trim()` removes leading/trailing whitespace. `if (!title) return` is the guard clause — an empty string is falsy.
> - `uuidv4()` generates a random UUID v4 (e.g., `"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"`). These are practically guaranteed unique (collision probability is astronomically low). This is our key for React's list rendering and DnD's `draggableId`.
> - `column: 'now'` — every new task starts in the NOW column.
> - `createdAt: Date.now()` — captures the Unix timestamp at creation time. Used by `getRelativeTime` for display.
> - `setTasks(prev => [...prev, task])` — uses the functional updater form. `prev` is the current state, spread into a new array, and `task` appended. The functional form is safer than `setTasks([...tasks, task])` because `tasks` could be stale if multiple updates happen in the same render cycle.
> - `setInput('')` — clears the input after adding.

#### Lines 124–129 — `handleKeyDown`
```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') addTask()
  },
  [addTask],
)
```
> **ELI7:** "When someone presses a key in the text box, check if it's the Enter key. If so, add the task."

> **Dev:** A keyboard event handler typed with `React.KeyboardEvent<HTMLInputElement>`. The generic `<HTMLInputElement>` constrains the event to keyboard events on input elements specifically. `e.key === 'Enter'` checks for the Enter/Return key. The dependency array `[addTask]` means `handleKeyDown` is recreated whenever `addTask` changes (which happens when `input` changes). This is necessary because `addTask` captures `input` in its closure.

#### Lines 131–133 — `deleteTask`
```tsx
const deleteTask = useCallback((id: string) => {
  setTasks(prev => prev.filter(t => t.id !== id))
}, [])
```
> **ELI7:** "When you click the X button on a card: remove that card from the list."

> **Dev:** Uses `Array.filter()` to create a new array excluding the task with the given ID. The empty dependency array `[]` means this callback is created once and never changes — it doesn't depend on any state values. This is safe because it uses the functional updater form of `setTasks`.

#### Lines 135–163 — `onDragEnd` (the drag-and-drop logic)
```tsx
const onDragEnd = useCallback((result: DropResult) => {
  const { source, destination, draggableId } = result
  if (!destination) return
  if (
    source.droppableId === destination.droppableId &&
    source.index === destination.index
  )
    return

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
> **ELI7:** "When you finish dragging a card:
> 1. If you dropped it outside any column, do nothing.
> 2. If you dropped it in the exact same spot, do nothing.
> 3. Otherwise: find the card you dragged, take it out of the list, figure out exactly where it should go now, put it back there, and update which column it belongs to."

> **Dev:** The core drag-and-drop algorithm.
> 
> **Line 136** — Destructures the `DropResult` object. `source` describes where the drag started (`droppableId` = column ID, `index` = position within column). `destination` is the same shape for where it was dropped (can be `null` if dropped outside any droppable). `draggableId` is the task's ID.
> 
> **Line 137** — Guard clause: if `destination` is `null`/`undefined` (dropped outside all columns), bail out. This happens when the user drags a card and releases it in empty space between columns.
> 
> **Lines 138–142** — Same-position guard: if the source and destination are identical (same column, same index), do nothing. This avoids an unnecessary state update and re-render.
> 
> **Lines 144–162** — The actual move logic using the functional updater:
> - **Line 145** — `prev.find(...)!` with the `!` non-null assertion — we know the task exists because we just dragged it
> - **Line 146** — Create `others` — the task array minus the dragged item. This is our working copy.
> - **Lines 148–155** — Calculate `insertAt` (the global index where the task should be inserted in the full array):
>   - Iterate through columns in order (now → soon → later)
>   - For each column BEFORE the destination: add the count of tasks in that column
>   - For the destination column: add `destination.index` (the position within the destination column's tasks after the dragged task was removed)
>   - `break` after the destination column
> - **Line 157** — `Array.splice(insertAt, 0, item)` inserts `item` at `insertAt` without removing anything (0 is the delete count). This mutates `others` in place.
> - **Line 158** — Spread the dragged task and override its `column` with the new destination
> - **Line 159** — `destination.droppableId as ColumnId` — type assertion since `droppableId` is typed as `string`, but we know it's one of our three column IDs

#### Lines 166–236 — App component JSX
```tsx
return (
  <div className="min-h-screen flex flex-col bg-gs-app-bg">
    {/* Header */}
    <header ...>
      <img ... />
      <div ...>
        <input ... />
        <button ...>Add</button>
      </div>
    </header>
    {/* Board */}
    <main ...>
      <DragDropContext onDragEnd={onDragEnd}>
        <div ...>
          {COLUMNS.map(col => (
            <Column ... />
          ))}
        </div>
      </DragDropContext>
    </main>
  </div>
)
```
> **ELI7:** "The whole app is a tall column (flex-col) that fills the screen (min-h-screen). At the top is the header bar with the logo, text box, and Add button. Below that is the board with three columns."

> **Dev:**
> - **Line 166** — `min-h-screen` = `min-height: 100vh` (full viewport height). `flex flex-col` = vertical flex container. `bg-gs-app-bg` uses the token-based background color class.
> - **Lines 168–174** — Header: `shrink-0` prevents it from collapsing when the board content is taller than the viewport. Inline styles are used for token-referenced properties that don't have Tailwind equivalents.
> - **Line 183** — `ml-auto` pushes the input/button group to the right edge (fills available space on the left).
> - **Lines 184–205** — Input: controlled component (`value={input}` + `onChange`). `onFocus`/`onBlur` imperatively change the border color using `e.target.style` — this is necessary because the focus/border color tokens aren't Tailwind utilities.
> - **Lines 206–217** — Button: `onClick={addTask}` triggers task creation. `hover:opacity-90` provides hover feedback.
> - **Line 223** — `DragDropContext` wraps the entire board. Its `onDragEnd` prop receives the callback whenever a drag operation completes. Without this, nothing is draggable.
> - **Lines 224–233** — The board grid: `grid-cols-1` on mobile (single column), `md:grid-cols-3` on medium screens and up (three equal columns). `COLUMNS.map()` renders one `<Column>` per column config entry. `tasks.filter(t => t.column === col.id)` passes only the tasks belonging to each specific column — this is the core of the "three columns from one array" pattern.

### Lines 244–248 — `ColumnProps` interface
```tsx
interface ColumnProps {
  column: (typeof COLUMNS)[number]
  tasks: Task[]
  onDelete: (id: string) => void
}
```
> **ELI7:** "A column needs to know: which column it is, what tasks are in it, and how to delete a task."

> **Dev:** `(typeof COLUMNS)[number]` is a TypeScript utility pattern that extracts the element type from an array. Since `COLUMNS` is `{ id, label, empty }[]`, `(typeof COLUMNS)[number]` evaluates to `{ id: ColumnId; label: string; empty: string }`. This means if we add a field to the COLUMNS config, the type automatically includes it.

### Lines 250–327 — `Column` component
```tsx
function Column({ column, tasks, onDelete }: ColumnProps) {
  const s = columnStyles[column.id]
  ...
}
```
> **ELI7:** "Each column is a box: colored header at the top with the name and count, then a list of cards inside. When you drag a card over the column, it shows a dashed line."

> **Dev:** `const s = columnStyles[column.id]` looks up the pre-computed Tailwind class strings for this column's color scheme. Using a shorthand `s` avoids repeating `columnStyles[column.id]` throughout the JSX.

#### Lines 254–261 — Column outer div
```tsx
<div
  className="flex flex-col overflow-hidden"
  style={{
    backgroundColor: 'var(--gs-col-bg)',
    borderRadius: 14,
    border: '1px solid var(--gs-col-border)',
  }}
>
```
> **ELI7:** "The column is a vertical stack with rounded corners and a very faint border, using the column background color."

> **Dev:** Inline styles are used here (rather than Tailwind classes) for token-referenced values. `overflow: hidden` clips the content to the rounded corners — without it, cards would poke out of the rounded column edges.

#### Lines 263–279 — Column header
```tsx
<div className={`flex items-center shrink-0 px-4 ${s.headerBg}`} style={{ height: 48 }}>
  <h2 className={`font-bold ${s.headerText}`}
      style={{ fontSize: 13, lineHeight: 1.25, letterSpacing: '0.08em' }}>
    {column.label}
  </h2>
  <span className={`ml-auto flex items-center justify-center rounded-full font-semibold ${s.badgeBg} ${s.badgeText}`}
        style={{ width: 22, height: 22, fontSize: 12, lineHeight: 1 }}>
    {tasks.length}
  </span>
</div>
```
> **ELI7:** "The colored stripe at the top of each column. It shows the column name (NOW/SOON/LATER) on the left and a little circular number on the right showing how many tasks are in it."

> **Dev:** `shrink-0` prevents the header from being squeezed when the column body is empty. The badge is a 22×22px circle using `rounded-full` (border-radius: 999px — makes a perfect circle). `line-height: 1` on the badge ensures the number is vertically centered in the 22px circle without extra space above/below.

#### Lines 282–324 — Droppable + Column body
```tsx
<Droppable droppableId={column.id}>
  {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.droppableProps}
      className={`flex-1 flex flex-col ${s.colBg} ${
        snapshot.isDraggingOver
          ? `border-2 border-dashed ${s.accentBorder}`
          : ''
      }`}
      style={{ padding: 12, gap: 8, minHeight: 300, transition: 'border-color 0.2s' }}
    >
      ...
      {provided.placeholder}
    </div>
  )}
</Droppable>
```
> **ELI7:** "This is where the cards live. When you're dragging a card over it, a dashed colored line appears — like saying 'drop it here!' It's always at least 300 pixels tall so it's easy to drop into even when empty."

> **Dev:**
> - **`Droppable`** — from @hello-pangea/dnd. The `droppableId` must match the value stored in `task.column` so the drag-and-drop library knows which column a task belongs to.
> - **Render prop pattern** — `Droppable` uses the render props pattern (children as a function). The function receives:
>   - `provided: DroppableProvided` — must be used: `innerRef` goes on the container div, `droppableProps` must be spread on it. Without these, drag-and-drop doesn't work.
>   - `snapshot: DroppableStateSnapshot` — reactive state object. `isDraggingOver` is `true` when a draggable is currently over this droppable.
> - **Conditional dashed border** — when `snapshot.isDraggingOver`, three Tailwind classes are added:
>   - `border-2` — 2px border width (overriding the default)
>   - `border-dashed` — dashed style
>   - `s.accentBorder` — e.g., `border-gs-now-accent/50` — accent color at 50% opacity
> - **`{provided.placeholder}`** — a special React element that maintains the droppable's scroll position and size during drag operations. Without it, the droppable would collapse when all items are dragged out.

#### Lines 299–310 — Empty state
```tsx
{tasks.length === 0 ? (
  <p className="text-center select-none" style={{ fontSize: 13, fontWeight: 400, color: 'var(--gs-text-muted)', paddingTop: 40 }}>
    {column.empty}
  </p>
) : (...)}
```
> **ELI7:** "If the column is empty, show a quiet message: 'Nothing on fire. Nice.' for NOW, 'Queue is clear.' for SOON, 'No backlog. Rare.' for LATER."

> **Dev:** Ternary operator: if no tasks, render the placeholder; otherwise render the task list. `select-none` prevents users from accidentally selecting the placeholder text while dragging. The message comes from `column.empty` which is defined in the `COLUMNS` config.

### Lines 339–462 — `TaskCard` component
```tsx
function TaskCard({ task, index, onDelete }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        ...
      )}
    </Draggable>
  )
}
```
> **ELI7:** "Each card has the task text, a little clock with when it was added, dots on the left you can grab to drag it, and an X that only appears when you hover over it."

> **Dev:** `Draggable` requires two props:
> - `draggableId` — must be unique across ALL draggables on the page. Using `task.id` (a UUID) guarantees this.
> - `index` — the position within its parent droppable. Must be sequential (0, 1, 2, ...). The library uses this for reordering animations.
> 
> The render prop receives:
> - `provided: DraggableProvided` — `innerRef` (attach to the draggable element), `draggableProps` (attach to the draggable element — handles positioning), `dragHandleProps` (attach to the grip element — limits drag initiation to that element)
> - `snapshot: DraggableStateSnapshot` — `isDragging` is `true` while the card is being dragged

#### Lines 343–359 — Card container styles
```tsx
<div
  ref={provided.innerRef}
  {...provided.draggableProps}
  className={`group flex items-center select-none transition-colors cursor-grab ${
    snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag' : ''
  }`}
  style={{
    backgroundColor: snapshot.isDragging ? undefined : 'var(--gs-card-bg)',
    border: '1px solid var(--gs-card-border)',
    borderLeftWidth: 3,
    borderLeftColor: `var(--gs-${task.column}-accent)`,
    borderRadius: 10,
    padding: '12px 14px',
    gap: 10,
  }}
```
> **ELI7:** "The card has a 3-pixel colored stripe on its left edge (red for NOW, amber for SOON, blue for LATER). When you hover, it gets slightly lighter. When you're dragging it, it goes a bit see-through and casts a shadow."

> **Dev:**
> - `ref={provided.innerRef}` — required by the DnD library to position the card during drag
> - `{...provided.draggableProps}` — spread the library's required props (data attributes, event handlers) onto the card element
> - `group` — Tailwind's parent marker. Child elements can use `group-hover:opacity-100` to react to the parent being hovered (used for the delete button)
> - `snapshot.isDragging ? 'opacity-[0.85] shadow-gs-drag'` — during drag: 85% opacity and the draggable shadow. `shadow-gs-drag` uses the `--box-shadow-gs-drag` theme token
> - `borderLeftWidth: 3` — the 3px accent stripe on the left. This is applied alongside the `border: '1px solid ...'` — since border-left is specified separately, it overrides the left portion of the shorthand border
> - `borderLeftColor: \`var(--gs-${task.column}-accent)\`` — dynamic CSS variable reference. Since `task.column` is `'now'`, `'soon'`, or `'later'`, this resolves to `var(--gs-now-accent)`, `var(--gs-soon-accent)`, or `var(--gs-later-accent)` — each pointing to the column's accent color
> - `gap: 10` — the flexbox gap between the drag handle, content, and delete button

#### Lines 360–372 — Hover effects (onMouseEnter / onMouseLeave)
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
  e.currentTarget.style.backgroundColor = 'var(--gs-card-bg)'
  e.currentTarget.style.borderColor = 'var(--gs-card-border)'
}}
```
> **ELI7:** "When the mouse moves over a card, the card gets a tiny bit lighter. When the mouse leaves, it goes back to normal."

> **Dev:** Imperative hover handling using DOM events. This approach (rather than CSS `:hover`) is used because:
> 1. We need to preserve the left accent border during hover — CSS `:hover` would interact unpredictably with the inline `borderLeftColor` style
> 2. We skip the hover effect entirely while dragging (`if (!snapshot.isDragging)`) to avoid visual flickering during drag
> `e.currentTarget` is the element the event listener is attached to (the card div), not the element that triggered the event (which could be a child like the text or icon).

#### Lines 375–388 — Drag handle (grip dots)
```tsx
<div {...provided.dragHandleProps}
     className="flex-shrink-0 cursor-grab active:cursor-grabbing"
     style={{ color: 'var(--gs-text-muted)' }}>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <circle cx="4" cy="2" r="1.5" />
    <circle cx="10" cy="2" r="1.5" />
    <circle cx="4" cy="7" r="1.5" />
    <circle cx="10" cy="7" r="1.5" />
    <circle cx="4" cy="12" r="1.5" />
    <circle cx="10" cy="12" r="1.5" />
  </svg>
</div>
```
> **ELI7:** "Six dots arranged in a 2×3 grid that you grab to drag the card. The cursor changes to a grabbing hand."

> **Dev:**
> - `{...provided.dragHandleProps}` — these props from the DnD library make this element the designated drag handle. Dragging only initiates when you click/touch this specific element, not the entire card. This allows text selection and button clicking elsewhere on the card.
> - `flex-shrink-0` — prevents the grip from being squeezed when the task title is very long
> - `cursor-grab` — shows the "open hand" cursor. `active:cursor-grabbing` — shows the "closed fist" cursor while actively dragging (the `:active` pseudo-class)
> - The SVG uses 6 `<circle>` elements positioned at (4,2), (10,2), (4,7), (10,7), (4,12), (10,12) — a clean 2×3 grid with 6px horizontal spacing and 5px vertical spacing
> - `fill="currentColor"` — inherits color from the parent's `color: var(--gs-text-muted)`. This is how SVGs can be themed without hardcoding fill colors

#### Lines 391–438 — Content area (title + timestamp)
```tsx
<div className="flex-1 min-w-0">
  <p className="truncate" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: 'var(--gs-text-primary)' }}>
    {task.title}
  </p>
  <div className="flex items-center" style={{ gap: 4, marginTop: 2 }}>
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1" .../>
      <path d="M5.5 3v3l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" .../>
    </svg>
    <span style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.4, color: 'var(--gs-text-secondary)' }}>
      {getRelativeTime(task.createdAt)}
    </span>
  </div>
</div>
```
> **ELI7:** "The task text (with ... if it's too long) and below it a tiny clock icon with something like '2 mins ago.'"

> **Dev:**
> - `flex-1 min-w-0` — the content area takes remaining space. `min-w-0` is critical: without it, flex children default to `min-width: auto` which prevents `truncate` from working. `min-w-0` overrides this so the text can actually be truncated.
> - `truncate` = `text-overflow: ellipsis; overflow: hidden; white-space: nowrap` — the standard Tailwind truncation pattern
> - **Clock SVG** — a 11×11 icon with two parts:
>   - Circle: 4.5 radius circle centered at (5.5, 5.5) with 1px stroke — the clock face
>   - Path: `M5.5 3v3l2 1` — draws a line from center up (hour hand), then from center right-and-down (minute hand). This creates the classic clock hands shape
> - `getRelativeTime(task.createdAt)` is called here — this means the timestamp updates only on re-render (when state changes). It doesn't live-update every second. This is acceptable since the resolution is in minutes.

#### Lines 442–457 — Delete button
```tsx
<button onClick={() => onDelete(task.id)}
        className="flex-shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ width: 22, height: 22, color: 'var(--gs-text-muted)' }}
        aria-label="Delete task">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
</button>
```
> **ELI7:** "An X button that's normally invisible, but appears when you hover over the card. Click it to delete the task immediately — no 'are you sure?' popup."

> **Dev:**
> - `opacity-0 group-hover:opacity-100` — invisible by default, fully visible when the parent (`.group`) is hovered. `transition-opacity` ensures the fade is smooth (150ms default duration)
> - `onClick={() => onDelete(task.id)}` — calls the delete handler with this task's ID. The arrow function wrapper is needed because `onDelete(task.id)` would be called immediately during render, not on click
> - `aria-label="Delete task"` — accessibility: screen readers announce this as "Delete task button" even though there's no visible text
> - **X icon SVG** — two diagonal lines: `M4.5 4.5l5 5` (top-left to bottom-right) and `M9.5 4.5l-5 5` (top-right to bottom-left). `strokeLinecap="round"` gives the X slightly rounded, softer endpoints

### Line 464 — `export default App`
> **ELI7:** "Make the App available for `main.tsx` to use."

> **Dev:** Default export so `import App from './App'` in `main.tsx` works cleanly. A named export could also work (`export { App }` → `import { App } from './App'`), but default exports are conventional for single-component files.

---

## Summary: Data Flow

Here's how a task travels through the system, start to finish:

```
1. User types in <input />
   → onChange fires → setInput(e.target.value)
   → input state updates → React re-renders input with new value

2. User presses Enter or clicks Add
   → handleKeyDown/onClick fires → addTask()
   → uuidv4() generates ID, Date.now() stamps time
   → setTasks(prev => [...prev, newTask])
   → tasks state updates → React re-renders entire app

3. Column receives filtered tasks
   → tasks.filter(t => t.column === 'now') → only NOW tasks
   → tasks.map((task, index) => <TaskCard key={task.id} index={index} />)
   → each card gets a Draggable wrapper with its index

4. User drags card from NOW to LATER
   → @hello-pangea/dnd tracks drag via onDragEnd callback
   → onDragEnd receives DropResult { source, destination, draggableId }
   → Calculate new position: iterate COLUMN_ORDER, count tasks
   → splice task into others array at calculated position
   → setTasks(others) triggers re-render
   → Card appears in new column with updated accent color

5. User hovers card and clicks X
   → onMouseEnter applies hover styles via e.currentTarget.style
   → Click fires onDelete(task.id)
   → setTasks(prev => prev.filter(t => t.id !== id))
   → Task removed → React removes the card from the DOM
```

---

## Summary: Theming Flow

How a color travels from design spec to pixel:

```
tokens.css:     --gs-now-500: #E84545
tokens.css:     --gs-now-accent: var(--gs-now-500)
tokens.css:     --gs-now-header-bg: var(--gs-now-500)
                ↓ (imported into style.css)
style.css:      @import "./tokens.css";
style.css:      @theme {
                  --color-gs-now-accent: var(--gs-now-accent);
                }
                ↓ (Tailwind processes @theme)
generated CSS:  .border-gs-now-accent { border-color: var(--gs-now-accent); }
                .bg-gs-now-header-bg { background-color: var(--gs-now-header-bg); }
                ↓ (Tailwind utility used in JSX)
App.tsx:        className="bg-gs-now-header-bg"
                ↓ (browser renders)
                Browser computes: var(--gs-now-header-bg)
                → var(--gs-now-500)
                → #E84545
                → Rendered as red pixel
```

The same component renders as red (#E84545) in both themes, or as white (#FFFFFF) card text in dark mode but near-black (#111111) card text in light mode — without a single change to `App.tsx`.
