# Swipable Navigation Carousel (Instagram-Style) Specification

## 1. Overview & Objective
Enable continuous real-time horizontal swipe navigation between Kharcha's four primary tabs (Home, History, Insights, Settings) in the mobile PWA experience—matching the fluid touch interaction of Instagram and Threads. Users can physically drag between screens with real-time finger-following and inertia snapping, or tap any tab on the bottom bar to smoothly slide to that screen.

---

## 2. Core User Experience
1. **Fluid 1:1 Touch Dragging:**
   * Swiping horizontally moves the viewport smoothly between adjacent screens with native 120 FPS hardware acceleration.
   * Releasing snaps to the nearest tab with native momentum curves.
2. **Unified Bottom Navigation:**
   * Tapping any of the 4 tabs in `BottomNav` triggers a smooth programmatic scroll to that pane.
   * As the user drags between tabs, the active icon pill in `BottomNav` synchronizes in real time to indicate the active screen.
3. **Deep Linking & Browser History:**
   * Direct visits to `/`, `/history`, `/insights`, and `/settings` land directly on the correct pane without layout shift or transition glitch.
   * Swiping between screens updates the URL via `window.history.replaceState` so browser history and bookmarking remain intact.
   * Browser back/forward buttons smoothly transition the pager to the target tab.
4. **Docked Composer:**
   * The expense input bar (`Composer`) remains consistently docked across all 4 screens, allowing users to log expenses from anywhere.
5. **Standalone Routes:**
   * Sub-routes like `/privacy` and 404/error pages render standalone inside `Shell` without mounting the 4-pane pager.

---

## 3. Architecture & Component Hierarchy

### Page Order
```
Pane 0: Home (/)
Pane 1: History (/history)
Pane 2: Insights (/insights)
Pane 3: Settings (/settings)
```

### Component Structure
```
app/layout.tsx
└── StoreProvider
    └── Shell
        ├── OfflineBanner
        ├── Toasts
        ├── SwipePager (when path is one of the 4 main tabs)
        │   ├── Pane 0: HomePage
        │   ├── Pane 1: HistoryPage
        │   ├── Pane 2: InsightsPage
        │   └── Pane 3: SettingsPage
        ├── Main (when path is a standalone route like /privacy)
        │   └── children
        ├── Composer (docked across tabs)
        ├── BottomNav (synced with active pane index)
        └── EntrySheet
```

---

## 4. Technical Specifications & Interactions

### 4.1 CSS Scroll-Snap Viewport (`components/SwipePager.tsx`)
```tsx
<div
  ref={pagerRef}
  className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar select-none overscroll-x-contain"
  style={{
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  }}
>
  <div className="w-full min-w-full shrink-0 snap-start overflow-y-auto">...</div>
  <div className="w-full min-w-full shrink-0 snap-start overflow-y-auto">...</div>
  <div className="w-full min-w-full shrink-0 snap-start overflow-y-auto">...</div>
  <div className="w-full min-w-full shrink-0 snap-start overflow-y-auto">...</div>
</div>
```

### 4.2 Bi-Directional Synchronization
* **Scroll-to-Tab Synchronization:**
  * Uses a throttled `onScroll` handler or `IntersectionObserver` on the 4 panes.
  * Calculates `activeIdx = Math.round(scrollLeft / clientWidth)`.
  * If `activeIdx` changes and is not during a programmatic click animation:
    * Updates state in `activeTab`.
    * Calls `window.history.replaceState(null, '', TABS[activeIdx].href)`.
* **Tab-to-Scroll Navigation:**
  * Tapping `BottomNav` triggers `pagerRef.current.scrollTo({ left: targetIdx * clientWidth, behavior: 'smooth' })`.
  * Sets an `isProgrammatic` flag for 400ms to ignore interim scroll events during animation.
* **Direct Mount & Popstate:**
  * On initial mount, matches `window.location.pathname` against `TABS` and immediately sets `scrollLeft = initialIdx * clientWidth` with `behavior: 'instant'`.
  * Listens to `window.addEventListener('popstate', ...)` to smoothly scroll when user hits Android system back button or browser back.

### 4.3 Child Horizontal Scroll Isolation
* Elements with internal horizontal scroll (e.g., period filter pills in `DailyChart` and `WaveChart`) apply:
  ```css
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  ```
  This ensures internal horizontal scrolling does not trigger a page swipe until the element boundary is reached.

---

## 5. Non-Functional Constraints
* **Zero new dependencies:** Built entirely with native web standards, React hooks, and Tailwind CSS.
* **Full SSR & App Router Compatibility:** Direct routes (`/history`, `/insights`, `/settings`) continue to exist as Next.js pages for SEO and direct loads.
* **Performance:** Pure CSS scroll-snap runs on the browser's compositor thread (120 FPS on high-refresh mobile screens).

---

## 6. Verification Plan
1. **Unit & Build Tests:** `npm run typecheck` and `npm run build` passing with 0 errors across all 15 routes.
2. **Touch Dragging Verification:** Swipe left/right smoothly between Home, History, Insights, and Settings.
3. **Bottom Nav Click Verification:** Tapping each icon smoothly scrolls to the correct pane and highlights active state.
4. **URL Synchronization Verification:** Swiping updates URL bar (`/history`, `/insights`, etc.) without page reload.
5. **Deep Linking Verification:** Refreshing on `/insights` immediately shows Insights on Pane 2.
6. **Chart & Pill Interaction Verification:** Swiping pills in `DailyChart` or `WaveChart` scrolls the pills without swiping the page.
