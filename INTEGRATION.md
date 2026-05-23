# GetSorted — Brand Integration Guide

## Files in this package

| File | Use |
|---|---|
| `logo-light.svg` | App header, README, light backgrounds |
| `logo-dark.svg` | App header on dark bg, splash screen |
| `icon.svg` | Scalable favicon source, og:image fallback |
| `favicon-16x16.png` | Browser tab (small) |
| `favicon-32x32.png` | Browser tab (standard) |
| `favicon-48x48.png` | Windows taskbar shortcut |
| `favicon-64x64.png` | General purpose icon |
| `favicon-128x128.png` | Chrome Web Store / PWA |
| `favicon-192x192.png` | Android PWA home screen |
| `favicon-512x512.png` | PWA splash screen |
| `apple-touch-icon.png` | iOS Add to Home Screen |

---

## How to infuse into your Vite + React project

### 1. Copy assets into your project
```
your-project/
└── public/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── favicon-48x48.png
    ├── favicon-192x192.png
    ├── favicon-512x512.png
    ├── apple-touch-icon.png
    ├── icon.svg
    └── logo-light.svg
```

### 2. Update index.html (Vite root)
Replace the default Vite favicon block with:
```html
<head>
  <meta charset="UTF-8" />

  <!-- Favicons -->
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

  <!-- PWA / Android -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#111111" />

  <title>GetSorted — Sort your day. Win it.</title>
</head>
```

### 3. Add manifest.json for PWA support (optional but recommended)
Create `public/manifest.json`:
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

### 4. Use the logo in your React app header
```tsx
// src/components/Header.tsx
export function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px' }}>
      <img
        src="/logo-light.svg"
        alt="GetSorted"
        height={36}
        style={{ display: 'block' }}
      />
    </header>
  );
}
```
Swap to `logo-dark.svg` if your app background is dark.

### 5. Pass the prompt to DeepSeek
When you paste your build prompt into DeepSeek / open code, add this line at the top:
```
Brand assets are already in /public. Use /public/logo-light.svg
in the app header and /public/icon.svg as the favicon in index.html.
Do not generate placeholder icons.
```
This stops the AI from inventing a generic favicon and ignoring your brand files.

---

## Colours for reference (paste into your prompt or tailwind config)

| Token | Hex | Use |
|---|---|---|
| `--gs-black` | `#111111` | Icon bg, primary text |
| `--gs-white` | `#FFFFFF` | Icon dots, reversed text |
| `--gs-bg` | `#F5F5F0` | App background |
| `--gs-now` | `#E84545` | NOW column accent |
| `--gs-soon` | `#F5A623` | SOON column accent |
| `--gs-later` | `#4A90D9` | LATER column accent |
