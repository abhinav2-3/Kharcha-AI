# Offline-First Architecture & IndexedDB Sync Queue Design Specification

## Overview
Kharcha is a voice-first and text expense tracker for Indian users. Users often log expenses in low-connectivity situations (basements, metro stations, crowded markets, rural areas). 

This design specification details how Kharcha provides a seamless **offline-first experience**:
1. Instant zero-latency local persistence in IndexedDB.
2. Fast local heuristic parsing (amount, category, payment mode) directly in the browser when offline.
3. Background synchronization queue that safely syncs pending records to MongoDB once internet connectivity is restored.
4. Guaranteed zero-duplication through client-generated UUIDs (`clientId`) and backend idempotency.
5. Privacy-preserving local cache management (pruning and clean wipe on sign out).

---

## 1. Local Storage Architecture (`lib/idb.ts`)

A lightweight, zero-dependency native browser IndexedDB client-side wrapper.

### Database Specification
- **Database Name:** `kharcha_offline_db`
- **Database Version:** `1`
- **Object Store:** `entries`
  - **Key Path:** `clientId` (string)
  - **Indexes:**
    - `sync`: values `'pending'` | `'synced'` | `'error'`
    - `spentOn`: string (`YYYY-MM-DD`)
    - `userId`: string (supports guest sessions and Google accounts)

### API Interface
```typescript
export interface OfflineDB {
  saveEntry(entry: Entry): Promise<void>;
  saveEntries(entries: Entry[]): Promise<void>;
  getPendingEntries(userId: string): Promise<Entry[]>;
  getEntriesForMonth(userId: string, month: string): Promise<Entry[]>;
  getAllEntries(userId: string): Promise<Entry[]>;
  markSynced(clientId: string, serverEntry: Entry): Promise<void>;
  deleteEntry(clientId: string): Promise<void>;
  clearUserEntries(userId: string): Promise<void>;
  clearAll(): Promise<void>;
}
```

---

## 2. Client-Side Local Fast Heuristic Parser (`lib/parser/local.ts`)

When offline or encountering network latency, the app cannot call the cloud LLM (Gemini/Groq). The local parser extracts structured transaction details immediately using fast regular expressions and keyword dictionaries in pure TypeScript.

### Capabilities
- **Amounts:**
  - Numbers: `500`, `250.50`, `20`, `1500`, `5k` -> `5000`
  - Indian colloquial words: `dedh sau` (150), `dhai sau` (250), `sawa sau` (125), `paanch sau` (500), `ek hazar` (1000), `dedh hazar` (1500), `dhai hazar` (2500)
- **Payment Modes:**
  - `upi`: "upi", "gpay", "google pay", "phonepe", "paytm", "scan"
  - `card`: "card", "debit card", "credit card"
  - `bank_transfer`: "netbanking", "bank transfer", "neft"
  - `cash`: default if unspecified or explicitly mentioned ("cash", "rokda")
- **Categories:**
  - `food`: chai, coffee, samosa, kachori, dosa, biryani, lunch, dinner, snacks, swiggy, zomato
  - `transport`: petrol, diesel, auto, rickshaw, cab, uber, ola, rapido, metro, bus
  - `groceries`: doodh, milk, bread, anda, sabzi, rashan, blinkit, zepto, instamart
  - `bills`: recharge, jio, airtel, bijli, electricity, wifi, gas, cylinder
  - `shopping`: clothes, kapde, shoes, amazon, flipkart, myntra
  - `health`: medicine, dawai, doctor, chemist
  - `salary`: salary, stipend, credit
  - `other`: fallback

### Output
Returns a complete optimistic `Entry` object with `sync: 'pending'` and `parseStatus: 'ok'`.

---

## 3. Background Sync Engine (`lib/sync.ts`)

### Synchronization Workflow
1. **Network Listener:**
   - Listens to `window.addEventListener('online', triggerSync)`.
   - Listens to `document.addEventListener('visibilitychange', () => if (visible) triggerSync())`.
   - Heartbeat check every 15 seconds if `hasPending` flag is true.
2. **Concurrency Guard:**
   - Mutex `isSyncing` flag prevents parallel execution.
3. **Batch Processing:**
   - Retrieves all entries where `sync === 'pending'` for current `userId`.
   - Sequentially submits to `api.createEntries({ clientId, rawText, source, alternatives })`.
4. **Idempotency Reconciliation:**
   - The server endpoint (`/api/entries`) inspects MongoDB for existing `(userId, clientId)`.
   - If already present, server returns the saved record without duplicating.
   - Client updates IndexedDB with `sync: 'synced'` and the server `_id`.
   - The cloud AI's normalized category, notes, and exact paise replace local heuristics.

---

## 4. Cache Eviction & Privacy
1. **On User Logout (`logout` in `lib/store.tsx`):**
   - Calls `clearUserEntries(userId)` in IndexedDB so no financial data remains on shared devices.
2. **On Account Claim / Google Sign-In (`loginGoogle` in `lib/store.tsx`):**
   - Migrates local guest entries to the new authenticated `userId`.
3. **Data Retention:**
   - Pruning worker keeps the latest 12 months in IndexedDB. Older synced records are purged from browser storage while persisting in MongoDB.

---

## 5. Error Handling & Edge Cases
- **Missing Amount (HTTP 422):** Entry marked `parseStatus: 'failed'` and opens in `EntrySheet` for user review.
- **Rate Limit (HTTP 429):** Respects `Retry-After` header and pauses the sync loop until backoff expires.
- **Server Outage (HTTP 500 / 503):** Backs off exponentially (5s, 15s, 30s) while leaving entries safely in IndexedDB.
- **Quota Exceeded:** Handled gracefully with localStorage fallback.
