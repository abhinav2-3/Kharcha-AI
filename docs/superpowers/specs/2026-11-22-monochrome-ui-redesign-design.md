# Monochrome UI Redesign Specification (Black & White Theme, Adaptive Charts & Payment Icons)

## 1. Overview
Kharcha is undergoing a comprehensive design update inspired by minimalist Japanese/Nordic budgeting aesthetics (reference: *Mibu*). 

The goal is to deliver an ultra-clean, high-contrast **monochrome (Black & White only)** design system across both Light and Dark modes with zero color distractions (no yellow, blue, orange, green, or rainbow accents). It redesigns the spending bar graphs with period filtering (`Week`, `Month`, `Quarter`), updates payment mode iconography while removing list timestamps, and introduces an intuitive **Smooth Wave Curve** for trend tracking.

---

## 2. Design System: Pure Black & White Theme (`globals.css`)

### Color Tokens
All colored variables (`--brand`, `--s1`..`--s4`, `--accent`, `--income`, `--danger`, `--warn`) are replaced with pure monochrome grayscale tokens.

#### Light Mode (`:root`)
- `--bg`: `#ffffff` (pure white canvas)
- `--surface`: `#ffffff` (card background)
- `--tint`: `#f4f4f6` (subtle ultra-light grey for button pills and input containers)
- `--ink`: `#000000` (deep high-contrast black for titles, primary amounts)
- `--ink-2`: `#555555` (graphite for subtitles and metadata)
- `--muted`: `#888888` (light graphite for hints and inactive controls)
- `--line`: `#e5e5ea` (hairline borders)
- `--axis`: `#d1d1d6` (chart axes)
- `--brand`: `#ffffff` (seamless hero header matching canvas)
- `--on-brand`: `#000000` (black text on hero)
- `--on-brand-2`: `#666666` (muted secondary text on hero)
- `--accent`: `#000000` (primary action background)
- `--accent-ink`: `#ffffff` (icon/label inside primary action)
- `--accent-soft`: `#f0f0f2` (soft rounded pill background)
- `--income`: `#000000` (income amounts rendered in bold black with '+' prefix)
- `--s1`: `#000000` (primary chart bars)
- `--s2`..`--s4`: `#333333`, `#666666`, `#999999` (monochrome scale)

#### Dark Mode (`:root[data-theme="dark"]` & `@media (prefers-color-scheme: dark)`)
- `--bg`: `#000000` (true pitch black, OLED optimized)
- `--surface`: `#0d0d0d` (dark card surface)
- `--tint`: `#161616` (button pill and container background)
- `--ink`: `#ffffff` (crisp white typography)
- `--ink-2`: `#a0a0a0` (silver for subtitles)
- `--muted`: `#666666` (muted hints)
- `--line`: `#222222` (dark hairline borders)
- `--axis`: `#333333`
- `--brand`: `#000000` (hero matching canvas)
- `--on-brand`: `#ffffff`
- `--on-brand-2`: `#a0a0a0`
- `--accent`: `#ffffff` (solid white action buttons)
- `--accent-ink`: `#000000` (black icon/label inside white action buttons)
- `--accent-soft`: `#1e1e1e`
- `--income`: `#ffffff`
- `--s1`: `#ffffff` (white chart bars)
- `--s2`..`--s4`: `#cccccc`, `#999999`, `#666666`

---

## 3. Daily & Period Spending Bar Chart with Time Selector (`components/charts/DailyChart.tsx`)

### Time Range Filter: `[ Week | Month | Quarter ]`
- Segmented monochrome pill control placed cleanly above the chart.
- **Week View:** Aggregates spend for the 7 days of the current week (Mon–Sun). Wide, accessible bars on mobile.
- **Month View:** Displays daily spending bars across the active month.
- **Quarter View:** Displays spending aggregated by month (3 months of the active quarter) or week clusters.

### Touch & Inspection Capabilities
- **Short Amount on Top of Bars:** Each bar displays its compact rupee amount on top (e.g., `₹500`, `₹1.5k`, `₹300`).
- **Interactive Tap / Hover Inspection:** Tapping any bar sets it as active, highlights it with high contrast, and renders an inspection card with the full rupee amount and date.
- **Mobile Responsive:** Spacing and minimum touch widths ensure seamless interaction on mobile screens.

---

## 4. History Cards & Payment Mode Icons (`components/EntryRow.tsx` & `components/EntrySheet.tsx`)

### Removal of Timestamps
- List cards in History and Home remove clock timestamps (`"4:15 PM"`, `"11:30 AM"`).
- Card metadata row shows exclusively: `{Date} • {Payment Method with Icon}`.

### Standardized Payment Mode Icons (`lib/meta.ts`)
Each payment mode is mapped to a distinct Lucide icon:
- **Cash:** `Banknote`
- **UPI:** `QrCode`
- **Card:** `CreditCard`
- **Bank:** `Building2`
- **Other:** `Wallet`

In `EntrySheet` (the edit/detail card), payment mode selection pills render these exact icons with monochrome active states (`border-ink bg-ink text-bg`).

---

## 5. The Smooth Wave Curve (`components/charts/WaveChart.tsx`)

### Replacement of "Spending Pace"
- Replaces the cumulative line comparison in `app/insights/page.tsx` with a smooth, continuous Catmull-Rom or cubic Bezier spline curve inspired by the *Mibu* reference image.
- Features an interactive focus dot that glides along the wave curve, indicating spend trajectory and peak periods.
- High-contrast monochrome SVG rendering with time labels (`Jul`, `Aug`, `Sep`, `Oct`, `Nov`, `Dec` or week markers) below.
