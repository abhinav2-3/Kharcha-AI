# Offline-First Architecture & IndexedDB Sync Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first storage and sync architecture for Kharcha using native browser IndexedDB, a local zero-latency heuristic parser, and an automatic background synchronization queue so users can track expenses seamlessly even with weak or zero internet.

**Architecture:** Entries are persisted immediately to native browser IndexedDB before any network calls, parsed locally via a fast heuristic parser if offline, and displayed in the UI instantly. When online connectivity is detected, a background sync engine drains pending records to MongoDB with full deduplication via `clientId`.

**Tech Stack:** TypeScript, Next.js 15 App Router, Native HTML5 IndexedDB API, MongoDB.

## Global Constraints
- Zero new external npm dependencies (native browser IndexedDB API with typed Promise wrapper).
- Full backward compatibility with existing MongoDB schema and `/api/entries` contract.
- Strict deduplication using client-generated `clientId` idempotency.
- Instant UI response (<10ms) without waiting for network.

---

### Task 1: Native Browser IndexedDB Engine (`lib/idb.ts`)

**Files:**
- Create: `lib/idb.ts`
- Test: `scripts/test-idb.ts`

**Interfaces:**
- Consumes: `Entry` from `lib/types.ts`
- Produces: `initDB()`, `saveLocalEntry(entry: Entry)`, `saveLocalEntries(entries: Entry[])`, `getPendingEntries(userId: string)`, `getAllLocalEntries(userId: string)`, `markEntrySynced(clientId: string, serverEntry: Entry)`, `deleteLocalEntry(clientId: string)`, `clearUserLocalEntries(userId: string)`

- [x] **Step 1: Write the test script for IndexedDB operations**
Create `scripts/test-idb.ts` with mock IndexedDB or node-compatible testing to verify schema creation, insertion, retrieval, and status updates.

- [x] **Step 2: Implement `lib/idb.ts`**
Implement typed Promise wrapper around `window.indexedDB`:
- Database `kharcha_offline_db`, Version `1`.
- Object Store `entries` with keyPath `clientId`.
- Indexes: `sync` (pending/synced), `spentOn` (date), `userId`.
- Safe SSR guards (`typeof window === 'undefined'`).

- [x] **Step 3: Run test script and verify**
Execute test to confirm all store operations, indexes, and error states work as expected.

- [x] **Step 4: Commit**
`git add lib/idb.ts scripts/test-idb.ts && git commit -m "feat(offline): native IndexedDB wrapper for local-first storage"`

---

### Task 2: Client-Side Fast Heuristic Parser (`lib/parser/local.ts`)

**Files:**
- Create: `lib/parser/local.ts`
- Test: `scripts/test-local-parser.ts`

**Interfaces:**
- Consumes: `rawText: string`, `source: Source`, `referenceDate?: Date`
- Produces: `parseLocalExpense(rawText: string, options?: { referenceDate?: Date }): Partial<Entry>`

- [x] **Step 1: Write test cases for local parser**
Create `scripts/test-local-parser.ts` testing extraction of:
- Standard digits: `500 for coffee`, `1200 electricity bill via card`
- Indian number words: `dedh sau auto`, `dhai sau kachori`, `paanch sau recharge`
- Multi-word categories & modes: `chai 20 upi`, `petrol 300 cash`

- [x] **Step 2: Implement `lib/parser/local.ts`**
Pure TypeScript heuristic engine:
- Regex for amounts (`\d+`, `\d+k`, Hindi words like `dedh sau`, `dhai sau`).
- Payment mode detection (`upi`, `cash`, `card`, `bank_transfer`).
- Category keyword mapping (`food`, `transport`, `groceries`, `bills`, `health`, etc.).
- Returns optimistic structured fields in paise.

- [x] **Step 3: Run test script and verify**
Run `npx tsx scripts/test-local-parser.ts` and confirm all scenarios extract correct amount in paise, category, and mode.

- [x] **Step 4: Commit**
`git add lib/parser/local.ts scripts/test-local-parser.ts && git commit -m "feat(offline): client-side fast heuristic parser"`

---

### Task 3: Background Sync Queue Engine (`lib/sync.ts`)

**Files:**
- Create: `lib/sync.ts`
- Test: `scripts/test-sync.ts`

**Interfaces:**
- Consumes: `lib/idb.ts`, `api.createEntries` from `lib/api.ts`
- Produces: `startSyncManager()`, `flushSyncQueue(userId: string)`, `onSyncStatusChange(cb)`

- [x] **Step 1: Write unit tests for sync queue logic**
Create `scripts/test-sync.ts` simulating:
- Multiple pending entries in queue.
- Reconnection triggers (`online` event).
- Mutex lock preventing parallel sync runs.
- Successful resolution updating IndexedDB records to `synced`.

- [x] **Step 2: Implement `lib/sync.ts`**
Implement the sync engine:
- Mutex guard `isSyncing = false`.
- Drains `getPendingEntries(userId)` sequentially.
- Posts to `api.createEntries(...)`.
- Calls `markEntrySynced(...)` in IndexedDB upon receipt of server response.
- Attaches event listeners for `online` and `visibilitychange`.

- [x] **Step 3: Run test script and verify**
Verify sync queue processes all pending items in correct chronological order without duplicate submissions.

- [x] **Step 4: Commit**
`git add lib/sync.ts scripts/test-sync.ts && git commit -m "feat(offline): resilient background sync engine"`

---

### Task 4: Store Integration & Seamless UI Hydration (`lib/store.tsx`)

**Files:**
- Modify: `lib/store.tsx`
- Modify: `components/EntryRow.tsx`

**Interfaces:**
- Consumes: `lib/idb.ts`, `lib/parser/local.ts`, `lib/sync.ts`
- Produces: Updated `useStore()` with instant offline add, offline hydration, and sync status updates.

- [x] **Step 1: Hydrate React state from IndexedDB on startup**
In `lib/store.tsx`:
- Before waiting for `api.listEntries()`, load all local entries from `getAllLocalEntries(user.userId)` immediately so the app shows data in <10ms.
- When `api.listEntries()` completes, reconcile with server entries and update local storage.

- [x] **Step 2: Update `add()` to write to IndexedDB first**
In `lib/store.tsx`:
- If offline or network slow, parse with `parseLocalExpense(rawText)`.
- Save entry to IndexedDB with `sync: 'pending'`.
- Immediately update React state so the item appears on the user's dashboard.
- Trigger `flushSyncQueue(user.userId)`.

- [x] **Step 3: Update `EntryRow.tsx` with offline/syncing badge**
In `components/EntryRow.tsx`:
- When `entry.sync === 'pending'`, show a subtle, elegant indicator (e.g. cloud icon or "Syncing...").
- When `synced`, indicator smoothly resolves to normal state.

- [x] **Step 4: Handle Logout & Account Claim Cleanup**
In `lib/store.tsx`:
- In `logout()`: call `clearUserLocalEntries(user.userId)`.
- In `loginGoogle()`: migrate local guest entries to the new user ID.

- [x] **Step 5: Commit**
`git add lib/store.tsx components/EntryRow.tsx && git commit -m "feat(offline): integrate IndexedDB and sync engine into app store"`

---

### Task 5: End-to-End Verification & Production Build Validation

**Files:**
- Test: Full simulation script `scripts/test-e2e-offline.ts`

- [x] **Step 1: Run comprehensive offline end-to-end verification**
Simulate:
1. Creating entries offline.
2. Checking IndexedDB contents.
3. Reloading page and confirming entries persist.
4. Simulating online event and verifying automatic sync to server.

- [x] **Step 2: Run Next.js production build**
Run `npm run build` to verify zero type errors, lint warnings, or hydration mismatches.

- [x] **Step 3: Commit & Final Wrap-up**
Commit all verified files.
