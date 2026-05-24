# UI Audit — GetSorted

This audit focuses exclusively on the visual design, aesthetics, and user interface (UI) of GetSorted. It ignores functional logic to highlight areas where the visual experience can be refined for a more "premium" feel.

---

## 1. Layout & Visual Hierarchy

### Lack of a Centralized Container Strategy
**Problem:** The app uses different `max-width` values for different sections:
- **Header:** Full width (`px-6`).
- **Input Area:** `max-w-2xl` (672px).
- **Board:** `max-w-6xl` (1152px).
**Impact:** On large monitors, the content feels "zig-zagged." The eye has to jump from a full-width header to a narrow input field, then back out to a wide board. 
**Fix:** Use a consistent `max-w-6xl` container for all three sections to create a clean vertical "line of sight."

### SVG Logo Balance
**Problem:** The new custom SVG logo uses `width="30" height="30"` with six circles. The bottom two circles have `opacity="0.25"`.
**Impact:** Because the bottom circles are so faint, the logo feels "top-heavy" and visually unbalanced. It looks more like a 2x2 grid with two ghosts at the bottom.
**Fix:** Increase the opacity of the bottom circles slightly (e.g., `0.4` or `0.5`) to maintain the "GetSorted" sorted-to-unsorted metaphor while keeping better visual weight.

---

## 2. Typography

### Hardcoded `px` instead of Tokens
**Problem:** Several components use inline `style={{ fontSize: 18 }}` or `text-[14px]` instead of the CSS variables defined in `style.css` (e.g., `var(--font-size-gs-base)`).
**Impact:** This makes it impossible to update the app's typography globally. If you want to make all text slightly larger for a "roomy" redesign, you have to find and replace numbers in multiple files.
**Fix:** Replace all hardcoded pixel values in JSX with the corresponding `--font-size-gs-*` tokens.

### Font Weight Clashes
**Problem:** The Header `h1` uses `fontWeight: 600` but the "Add" button uses `font-bold` (700). 
**Impact:** Small inconsistencies in weight across primary actions (Header vs. Main Action Button) can make the UI feel slightly "busy" or unpolished.
**Fix:** Standardize primary headings and primary buttons to use the same weight (e.g., Semi-Bold 600) for a more cohesive brand feel.

---

## 3. Interaction & States

### Input Focus Transition
**Problem:** The input field has a transition on `border-color` in CSS, but the background color (`var(--gs-input-bg)`) doesn't change when focused.
**Impact:** The focus state feels "thin." In premium UIs, a focus state often involves a subtle lift or a slight change in background luminance to make the active area feel "alive."
**Fix:** Add a subtle background color shift on `:focus` (e.g., making it slightly darker in Light Mode or slightly lighter in Dark Mode).

### Button Hover Paradox
**Problem:** The "Add" button has `hover:opacity-90`. 
**Impact:** Decreasing opacity on hover usually makes an element look like it's "fading out" or becoming disabled. For a primary action button, it's better to make it slightly **brighter** or change its scale (`scale-105`) to show it is ready to be clicked.
**Fix:** Use a hover color that is ~5% different from the base color, or a subtle `transform: translateY(-1px)` to simulate a lift.

---

## 4. Colors & Contrast

### The "Muted" Contrast Gap (Fixed but still tight)
**Problem:** The timestamps and drag handles use `var(--gs-text-muted)`. In the current Dark Mode, this is `rgba(255,255,255,0.5)`.
**Impact:** While better than the previous `0.25`, 50% white on a near-black background is still on the edge of readability for users with low vision (WCAG AA).
**Fix:** Consider bumping primary "secondary" text and Meta info (like timestamps) to `rgba(255,255,255,0.65)`.

### Column Accent Uniformity
**Problem:** The `border-left` accent on `TaskCard` exactly matches the column header color.
**Impact:** Excessive color-matching can lead to "visual fatigue" where everything looks the same.
**Fix:** Use a slightly more vibrant or different shade for the card accent compared to the header background to create depth.

---

## Summary Verdict
The UI is **80% of the way to premium.** The custom SVG logo and centered board are great improvements. To reach that "100% Wow" factor, the app needs to move away from hardcoded pixels, harmonize its container widths, and refine the micro-interactions (hovers and focus states).
