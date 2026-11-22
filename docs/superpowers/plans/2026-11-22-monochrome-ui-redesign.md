# Monochrome UI Redesign (Black & White Theme, Adaptive Charts & Payment Icons) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Kharcha into a pure monochrome (Black & White only) budgeting app inspired by minimalist Japanese/Nordic design (Mibu), featuring interactive multi-period bar charts (`Week`, `Month`, `Quarter`), standardized payment mode icons with timestamps removed, and a fluid Smooth Wave Curve for spending trajectory.

**Architecture:** Grayscale design tokens in `globals.css` driving all UI states; data aggregation utilities in `stats.ts` computing Week, Month, and Quarter slices; pure SVG spline wave rendering in `WaveChart.tsx`; icon-augmented payment mode mapping in `meta.ts`.

**Tech Stack:** TypeScript, Next.js 15, Tailwind CSS v4, Lucide React, Recharts / Native SVG.

## Global Constraints
- Pure monochrome: strictly Black & White across Light and Dark modes. Zero colored accents (no amber, blue, orange, purple, green).
- Clean mobile-first UX with touch-friendly targets (>40px).
- Zero new npm dependencies.
- Fully backward-compatible with existing data stores and APIs.

---

### Task 1: Pure Monochrome Theme Tokens & Brand Refresh

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Modify: `components/Composer.tsx`

**Interfaces:**
- Consumes: Tailwind v4 inline CSS variables
- Produces: High-contrast black and white variables for `--bg`, `--surface`, `--ink`, `--brand`, `--accent`, `--s1`..`--s4`

- [ ] **Step 1: Update design tokens in `app/globals.css`**
Replace all colored values in `:root`, `@media (prefers-color-scheme: dark)`, and `:root[data-theme="dark"]` with pure monochrome grayscale values:
- Light: `--bg: #ffffff`, `--surface: #ffffff`, `--tint: #f4f4f6`, `--ink: #000000`, `--ink-2: #555555`, `--line: #e5e5ea`, `--brand: #ffffff`, `--accent: #000000`, `--accent-ink: #ffffff`, `--s1: #000000`.
- Dark: `--bg: #000000`, `--surface: #0d0d0d`, `--tint: #161616`, `--ink: #ffffff`, `--ink-2: #a0a0a0`, `--line: #222222`, `--brand: #000000`, `--accent: #ffffff`, `--accent-ink: #000000`, `--s1: #ffffff`.

- [ ] **Step 2: Refresh Hero Header in `app/page.tsx`**
Update hero section to seamlessly match the white/black canvas:
- Remove dark navy shadow and blue background.
- Render clean top brand bar with date switcher and search pill.
- Render bold black/white spent total with tight tracking.

- [ ] **Step 3: Update Composer buttons in `components/Composer.tsx`**
Ensure mic and submit buttons use solid black/white high-contrast styling (`bg-ink text-bg` and `bg-surface text-ink`).

- [ ] **Step 4: Commit**
`git add app/globals.css app/page.tsx components/Composer.tsx && git commit -m "feat(ui): pure monochrome black and white theme tokens"`

---

### Task 2: Payment Mode Icons & Card Timestamp Removal

**Files:**
- Modify: `lib/meta.ts`
- Modify: `components/EntryRow.tsx`
- Modify: `components/EntrySheet.tsx`

**Interfaces:**
- Consumes: `MODE_META` from `lib/meta.ts`
- Produces: Updated `MODE_META` with Lucide icons (`Banknote`, `QrCode`, `CreditCard`, `Building2`, `Wallet`)

- [ ] **Step 1: Add Lucide Icons to `MODE_META` in `lib/meta.ts`**
Import `Banknote`, `QrCode`, `CreditCard`, `Building2`, `Wallet` and assign to `cash`, `upi`, `card`, `bank_transfer`, `other`.

- [ ] **Step 2: Update `components/EntryRow.tsx`**
- Remove `{timeLabel(e.spentAt)}` from card subtitle.
- Display `{showDay ? `${dayLabel(e.spentOn)} • ` : ''}` paired with the payment mode icon and label.
- Keep monochrome category chip and amount.

- [ ] **Step 3: Update Payment Mode selector in `components/EntrySheet.tsx`**
In the edit sheet, render payment mode selector pills with the icon, label, and high-contrast active state.

- [ ] **Step 4: Commit**
`git add lib/meta.ts components/EntryRow.tsx components/EntrySheet.tsx && git commit -m "feat(ui): payment mode icons and clean card display without timestamps"`

---

### Task 3: Interactive Bar Chart with `[ Week | Month | Quarter ]` Time Selector

**Files:**
- Modify: `lib/stats.ts`
- Modify: `components/charts/DailyChart.tsx`
- Test: `scripts/test-stats-periods.ts`

**Interfaces:**
- Consumes: `entries: Entry[]`
- Produces: `byWeek(entries, refDate)`, `byMonth(entries, month)`, `byQuarter(entries, refDate)` in `lib/stats.ts`, and updated `DailyChart` with time selector.

- [ ] **Step 1: Implement period aggregation helpers in `lib/stats.ts`**
- `byWeek`: Returns 7 days of current week (Mon–Sun) with spend amounts.
- `byMonth`: Returns daily spend for active month.
- `byQuarter`: Returns 3 months of current quarter with totals.

- [ ] **Step 2: Write test script `scripts/test-stats-periods.ts`**
Verify `byWeek`, `byMonth`, and `byQuarter` compute accurate amounts.

- [ ] **Step 3: Update `components/charts/DailyChart.tsx`**
- Add segmented pill selector: `[ Week | Month | Quarter ]`.
- Render compact short amounts on top of each bar (e.g. `₹500`, `₹1.5k`).
- Implement tap/click active state that highlights the bar and displays exact amount and date.
- Ensure responsive spacing for mobile screens.

- [ ] **Step 4: Commit**
`git add lib/stats.ts components/charts/DailyChart.tsx scripts/test-stats-periods.ts && git commit -m "feat(ui): interactive spending bar chart with week month quarter selector"`

---

### Task 4: Smooth Wave Curve for Spending Trajectory

**Files:**
- Create: `components/charts/WaveChart.tsx`
- Modify: `app/insights/page.tsx`
- Test: `scripts/test-wave-curve.ts`

**Interfaces:**
- Consumes: `data: { label: string; amount: number }[]`
- Produces: `<WaveChart />` rendering a fluid SVG spline curve with an interactive focus dot.

- [ ] **Step 1: Create `components/charts/WaveChart.tsx`**
Implement smooth cubic Bezier / Catmull-Rom SVG spline wave:
- Clean monochrome stroke (`stroke-ink`, strokeWidth `2.5`).
- Active focal dot with pulsing ring.
- Interactive scrub/tap showing date and amount in a floating popover.
- Month labels (`Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec`) along the bottom.

- [ ] **Step 2: Replace Spending Pace chart in `app/insights/page.tsx`**
Replace the old `TrendChart` with `WaveChart` showing 6-month or multi-period spending momentum.

- [ ] **Step 3: Commit**
`git add components/charts/WaveChart.tsx app/insights/page.tsx && git commit -m "feat(ui): smooth wave curve chart inspired by mibu"`

---

### Task 5: End-to-End Build & Visual Verification

- [ ] **Step 1: Run Next.js production build**
Run `npm run build` to verify zero type errors, lint issues, or bundle issues across all 15 routes.

- [ ] **Step 2: Final Commit**
Commit any remaining cleanups.
