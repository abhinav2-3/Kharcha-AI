# Kharcha — Voice & Text Expense Tracker (working title)

> Say it or type it: **"500 chai pe cash se"** → amount, category and payment mode are extracted, saved, and the dashboard updates instantly.

A mobile-first PWA for people who want to log daily expenses in seconds, in Hindi / English / Hinglish, with **zero signup friction**.

**Status:** Design done (HLD + LLD). Schema and parser prompt designed. Next: `parse(text)` function, parser test set, then API routes.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Principles](#2-core-principles)
3. [Features](#3-features)
4. [User Flow](#4-user-flow)
5. [High-Level Design (HLD)](#5-high-level-design-hld)
6. [Tech Stack](#6-tech-stack)
7. [Low-Level Design (LLD)](#7-low-level-design-lld)
8. [Parser Design](#8-parser-design)
9. [Authentication](#9-authentication)
10. [Rate Limiting](#10-rate-limiting)
11. [Reliability & Failure Handling](#11-reliability--failure-handling)
12. [Tradeoffs & Decisions](#12-tradeoffs--decisions)
13. [Problems & Challenges](#13-problems--challenges)
14. [Roadmap](#14-roadmap)
15. [Security & Privacy](#15-security--privacy)
16. [Testing Strategy](#16-testing-strategy)
17. [Project Structure & Setup](#17-project-structure--setup)
18. [Open Questions](#18-open-questions)

---

## 1. Product Overview

### Problem
Tracking daily spending is painful. Excel/Sheets on mobile is slow and squeezed, expense apps need signup and have too many forms, and most people quit within a week.

### Solution
One input box and one mic button. The user says or types what they spent; the app does the rest:

1. Voice → text (browser Web Speech API, client-side, free)
2. Text → structured JSON (LLM: Gemini Flash)
3. JSON → validated → saved in MongoDB
4. Dashboard (charts + list) updates immediately

### Target user
Shopkeepers, small business owners, students and everyday people in India who spend in small, frequent, mostly cash/UPI amounts and think in Hinglish.

### USP
**Natural-language / voice logging with no signup.** The dashboard and PWA are just the delivery mechanism.

### Why not a WhatsApp/Telegram bot or only Google Sheets?
- No dependency on bot approval, third-party platforms or their policies
- Users don't need to trust or log in to third-party servers
- Full control over data, queries and UX
- Native-app feel via PWA, without an app store
- Sheets stay available later as an optional backup/export only

---

## 2. Core Principles

1. **Zero friction first.** User should log their first expense within seconds of opening the page.
2. **Never lose user data.** If parsing fails, the raw text is still saved.
3. **Never trust the LLM.** Every output is schema-validated and normalized on the server.
4. **Core before extras.** Voice/text → entry → dashboard must be rock solid before backup, offline, sheets.
5. **Cheap now, extensible later.** Small decisions today (clientId, soft delete, updatedAt) keep future features cheap.
6. **Free-tier friendly.** The product must run on free tiers in early stage.

---

## 3. Features

### 3.1 MVP (v1)

| Feature | Details |
|---|---|
| Text input | Single input box, submit to log |
| Voice input | Mic button, Web Speech API converts speech to text on client |
| AI parsing | Gemini Flash extracts amount, type, category, mode, note, date |
| Multi-item messages | "chai 20 aur samosa 30" → 2 entries (max 5 per message) |
| Date understanding | aaj, kal, parso, "20 october", "last monday"; default = now |
| Income + expense | `type` = `expense` (default) or `income` |
| Fixed categories | Fixed enum with `other` fallback + `categoryHint` |
| Payment mode | cash / upi / card / bank_transfer / other / unknown |
| Failure-safe saving | Parse failure → raw text saved with `parseStatus: failed` |
| Edit / delete | User can fix wrong parsing; delete is soft delete |
| Dashboard | Summary cards, category chart, daily chart, entry list |
| Guest auth | Silent anonymous account via httpOnly cookie, no login |
| PWA | Installable, "Add to Home Screen" |
| Responsive | Mobile-first design |
| Rate limiting | Per-user and global LLM quota protection |

### 3.2 Later (see [Roadmap](#14-roadmap))
Account recovery code, email OTP/magic link, offline queue, slow-network handling, Google Sheet backup, Export to Excel/CSV, budgets, recurring entries, multi-currency, multi-timezone, insights.

### 3.3 Non-goals for v1
- No bank/UPI/SMS auto-reading
- No receipt/OCR scanning
- No multi-user / shared / family accounts
- No phone SMS OTP (paid + DLT hassle in India)
- No multi-currency (INR only) and no timezone other than IST
- No native mobile app
- No real-time sockets

---

## 4. User Flow

1. User opens the web page (mobile or desktop).
2. Backend silently creates a guest user and sets a long-lived httpOnly cookie. No form, no password.
3. User types or taps the mic and speaks: *"kal petrol 300 upi"*.
4. Client generates a `clientId` (UUID) and shows the entry **optimistically**.
5. `POST /api/entries` → auth → rate limit → LLM parse → validate → normalize → save.
6. Response returns saved entries; UI reconciles and refetches stats.
7. If something is wrong, user taps the entry and edits it (`parseStatus` becomes `manual`).

---

## 5. High-Level Design (HLD)

```
[Browser PWA - Next.js]
  InputBar (text / mic → Web Speech API)
        │  POST /api/entries { clientId, rawText, source }
        ▼
[Next.js API route handlers]
  1. Auth (guest cookie → userId)
  2. Rate limit
  3. Parser (Gemini Flash → JSON → zod validate → normalize)
  4. Save to MongoDB
        │
        ▼
[MongoDB Atlas]   users, entries
        │
        ▼
Response → optimistic UI reconcile + stats refetch
```

### Key architecture decisions
- **Single repo, Next.js full-stack** (no separate Express server): less deployment and maintenance for an early startup.
- **No Socket.io.** Each user's data is their own, so real-time push is unnecessary. Serverless platforms also handle sockets poorly. Optimistic updates + refetch are enough.
- **Synchronous LLM call with 8s timeout.** Simple. On failure we still save raw text.
- **Parser behind an interface** (`parse(text)`), so the LLM provider can be swapped in one place.
- **Money stored as integer paise.** Avoids floating point bugs.
- **Client-generated `clientId` per entry.** Gives idempotency now and makes offline queueing possible later.
- **Soft delete + `updatedAt`.** Enables "changes since X" for backup/sync later.

---

## 6. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router), React, TypeScript | Team's primary stack |
| Styling | Tailwind CSS (mobile-first) | Fast responsive UI |
| Charts | Recharts (or Chart.js) | Clean on mobile |
| Client state | TanStack Query | Optimistic mutations, caching, retry |
| Speech-to-text | Web Speech API (browser) | Free, client-side, no AI call needed for transcription |
| Backend | Next.js route handlers | One codebase |
| Database | MongoDB Atlas + Mongoose | Team's primary DB, flexible schema |
| LLM | Gemini Flash (free tier) | Free, fast, good Hinglish |
| Validation | zod | Validates LLM output and API input |
| Rate-limit store | MongoDB or Upstash Redis (free tier) | Counters |
| Auth | Signed JWT in httpOnly cookie | No third party |
| Hosting | Vercel + Atlas | Free tiers |
| Email (later) | Resend or Brevo | Free tiers |

---

## 7. Low-Level Design (LLD)

### 7.1 Enums (`lib/constants.ts`)

| Enum | Values |
|---|---|
| `ENTRY_TYPES` | `expense`, `income` |
| `EXPENSE_CATEGORIES` | `food`, `groceries`, `transport`, `fuel`, `travel`, `bills`, `rent`, `shopping`, `health`, `education`, `entertainment`, `personal_care`, `gifts`, `emi_loans`, `investment`, `other` |
| `INCOME_CATEGORIES` | `salary`, `business`, `freelance`, `refund`, `gift_received`, `other_income` |
| `PAYMENT_MODES` | `cash`, `upi`, `card`, `bank_transfer`, `other`, `unknown` |
| `SOURCES` | `text`, `voice` |
| `PARSE_STATUS` | `ok`, `failed`, `manual` |

Unknown/unrecognized category → `other` (income: `other_income`) and the LLM's suggestion is saved in `categoryHint`. Reviewing `categoryHint` values later tells us which categories to add.

### 7.2 Data model

**users**

| Field | Type | Notes |
|---|---|---|
| `userId` | String (UUID) | Unique, immutable. Used everywhere instead of `_id` |
| `lastSeenAt` | Date | |
| `createdAt`, `updatedAt` | Date | |
| `recoveryCodeHash` | String | Later |
| `email` | String | Later (OTP / magic link) |

**entries**

| Field | Type | Notes |
|---|---|---|
| `userId` | String | Ref to `User.userId` |
| `clientId` | String | Client-generated UUID. Unique together with `userId`. Multi-item messages use `${clientId}:${index}` |
| `rawText` | String | Max 500 chars, always saved |
| `source` | `text` / `voice` | |
| `amount` | Integer (paise) | Required unless `parseStatus = failed` |
| `type` | enum | Default `expense` |
| `category` | enum | Default `other`; auto-corrected to match `type` |
| `categoryHint` | String | Only when category is `other` / `other_income` |
| `mode` | enum | Default `unknown` |
| `note` | String | Max 100 chars |
| `spentAt` | Date | Exact timestamp |
| `spentOn` | `YYYY-MM-DD` (IST) | For day grouping in charts |
| `parseStatus` | enum | `ok` / `failed` / `manual` |
| `deletedAt` | Date \| null | Soft delete |
| `createdAt`, `updatedAt` | Date | |

**Indexes:** unique `{userId, clientId}`, and `{userId, spentAt: -1}`.

**Populate:** `Entry` has a virtual `user` (`localField: userId`, `foreignField: userId`, `justOne: true`), so `Entry.find().populate('user')` works without ObjectIds.

### 7.3 API

| API | Purpose |
|---|---|
| `POST /api/auth/guest` | Idempotent: valid cookie → same user, else create user + set cookie |
| `GET /api/me` | Current user |
| `POST /api/entries` | `{ clientId, rawText, source }` → parse → save → return entries |
| `GET /api/entries?from&to&cursor` | List with cursor pagination, excludes soft-deleted |
| `PATCH /api/entries/:id` | Fix parsing mistakes, sets `parseStatus: manual` |
| `DELETE /api/entries/:id` | Soft delete |
| `GET /api/stats?range=` | Totals, by-category, by-day via Mongo aggregation |

Rules:
- Same `{userId, clientId}` sent twice returns the existing entry (no duplicate, no error).
- Stats exclude soft-deleted and `failed` entries.
- All inputs validated with zod.

### 7.4 Frontend structure

```
app/
  page.tsx                 → dashboard
components/
  InputBar                 (text + mic)
  SummaryCards
  CategoryChart
  DailyChart
  EntryList                (edit / delete)
lib/
  api client
  useSpeechRecognition hook
state: TanStack Query (optimistic mutations)
```

---

## 8. Parser Design

Isolated module: `parse(text): ParsedItem[]`. Provider (Gemini) is hidden behind it.

### 8.1 Pipeline
```
rawText
  → system prompt (with today's date + weekday, IST)
  → Gemini (temperature 0, responseMimeType application/json, 8s timeout)
  → zod safeParse (ParserOutputSchema)
  → normalize (amount → paise, category vs type check, date resolve)
  → save
```

### 8.2 Required vs optional fields

| Field | Required? | Default / behavior |
|---|---|---|
| `amount` | **Yes** (only required field) | Missing → `parseStatus: failed`, rawText saved, UI asks user to enter amount |
| `type` | No | `expense`; `income` for received-money words (mila, aaya, salary, credited) |
| `category` | No | `other` / `other_income` + `categoryHint` |
| `mode` | No | `unknown` |
| `note` | No | null |
| `date` | No | now |

### 8.3 Date handling

The LLM gets today's date and weekday in the prompt and returns `YYYY-MM-DD` or null. The **server validates** the result; we don't blindly trust LLM date math.

| User says | Result |
|---|---|
| No date / "aaj" / "today" | Now |
| "kal" / "yesterday" | Yesterday (expenses are in the past, so "kal" = yesterday) |
| "parso" | 2 days ago |
| "last monday" / "pichle somvaar" | Most recent past such weekday (never today) |
| "20 october" / "20th oct" | That date in current year; if it would be in the future → previous year |
| Vague ("pichle hafte", "last month") | null → now |
| Future or invalid date | Clamped to today |
| Date only, no time | 12:00 IST that day (if the date is today → current time) |

Timezone is fixed to IST (`Asia/Kolkata`) in v1.

### 8.4 Other edge cases

| Case | Behavior |
|---|---|
| Amount formats: "5k", "1.5 lakh", "paanch sau", "dedh sau", "adhai sau", ₹/Rs | Handled in prompt rules |
| Multiple items in one message | `entries[]`, max 5; whole-sentence date/mode applies to all |
| Not a transaction ("aaj kuch kharch nahi hua") | `entries: []`, nothing saved |
| Amount missing ("kal chai pi") | Entry saved as `failed` with raw text |
| Wrong category for type (e.g. income with `food`) | Auto-corrected to `other` / `other_income` |
| LLM returns invalid JSON / unknown enum | Enums fall back via `.catch()`; invalid JSON → `failed` entry |
| LLM timeout / quota exceeded | `failed` entry with raw text, user can retry/edit |
| Voice transcription noise | LLM is told input may be noisy Hinglish; user can edit result |

---

## 9. Authentication

### 9.1 Now: anonymous guest account
- First visit → `POST /api/auth/guest` creates a user with random UUID `userId`.
- Signed JWT (payload: `userId` only) in an **httpOnly, Secure, SameSite** cookie, ~1 year.
- No form, no password, no third-party login.
- IP-based rate limit on `/auth/guest` to stop fake-user spam.

### 9.2 Known weakness
Clearing browser data, switching phones, or (on iOS) installing the PWA may result in a **new guest account** and the old data becomes unreachable.

### 9.3 Later: optional recovery (in this order)
1. **Recovery code** (e.g. `CHAI-7K2M-X9QP`): generated at guest creation, shown on a "Backup" screen, stored **hashed**. Free, zero dependencies, no trust issues.
2. **Email magic link / OTP** via Resend or Brevo (free tiers). The guest `userId` stays permanent; claiming only adds `email` to the same user.
3. Phone SMS OTP is **intentionally skipped**: paid and India DLT registration overhead.

---

## 10. Rate Limiting

| Scope | Limit | Why |
|---|---|---|
| `POST /api/entries` per user | ~30 / min | Abuse and accidental loops |
| Global Gemini counter | Below free-tier quota | Protect shared quota; the real bottleneck |
| `POST /api/auth/guest` per IP | Low | Stop fake account creation |

Store: MongoDB counters or Upstash Redis (free tier). When the global quota is hit, entries are saved as `failed` with raw text instead of rejecting the user.

---

## 11. Reliability & Failure Handling

| Failure | What happens |
|---|---|
| Gemini down / slow / quota | Raw text saved, `parseStatus: failed`, user can edit/retry |
| LLM returns garbage | zod validation fails → `failed` entry |
| Duplicate submit (double tap, retry) | Unique `{userId, clientId}` → same entry returned |
| User deletes by mistake | Soft delete (`deletedAt`), recoverable |
| Wrong parsing | Editable; becomes `manual` |
| DB write fails | Client keeps optimistic entry in error state with retry |

**Principle:** the user's words are saved before anything else can go wrong.

---

## 12. Tradeoffs & Decisions

| Decision | Chosen | Alternative | Why / cost |
|---|---|---|---|
| Backend | Next.js route handlers | Separate Express server | Simpler infra. Cost: tied to serverless limits |
| Realtime | Optimistic update + refetch | Socket.io | Data is single-user; sockets don't fit serverless |
| LLM call | Synchronous, 8s timeout | Queue + background worker | Simpler. Cost: slow request when Gemini is slow |
| Speech-to-text | Browser Web Speech API | Whisper / cloud STT | Free, no server cost. Cost: browser support varies, needs internet, quality varies |
| Categories | Fixed enum + `other` + hint | Free-form / user-defined | Clean charts and reliable aggregation. Cost: less flexible |
| Money | Integer paise | Float rupees | No floating point bugs |
| Auth | Anonymous guest first | Email/password / Google login | Zero friction. Cost: account-loss risk |
| Recovery | Recovery code first, email later | Email OTP first | Free, no deps. Cost: users may lose/ignore code |
| Timezone | Fixed IST | Per-user timezone | Simpler. Cost: not usable abroad (v1) |
| Delete | Soft delete | Hard delete | Backup/sync-friendly. Cost: queries must filter |
| LLM | Gemini free tier | Paid LLM / local model | Free. Cost: quota limits, data-use terms (see privacy) |
| Date resolution | LLM extracts, server validates | Pure server-side NLP | Handles Hinglish well. Cost: LLM can be wrong, so server clamps |
| Multi-item | Up to 5 entries per message | One message = one entry | Natural speech. Cost: more parsing complexity |
| Data layer | `userId` (UUID) instead of ObjectId refs | ObjectId refs | Stable public ID. Cost: virtual populate needed |

---

## 13. Problems & Challenges

### Product
- **First-session activation.** Empty dashboard feels dead; needs a good empty state and sample prompts ("try: 500 chai pe cash se").
- **Retention.** Daily logging habit is hard; reminders/insights are future work.
- **Parsing trust.** One wrong amount destroys trust. The UI must make verification and edit one tap.

### Technical
- **Gemini free-tier quota** is the real scaling bottleneck. Need rate limits, graceful degradation and an eventual paid or alternate provider path.
- **Free-tier data usage.** Free-tier API data may be used by the provider to improve products (check current terms). Financial text is sensitive; consider this before scaling or moving to paid tier.
- **Web Speech API limitations.** Support differs across browsers (Chrome/Android is best; iOS Safari and Firefox are limited or inconsistent). In Chrome, audio is processed by a remote service, so voice **needs internet**. Text input must always work as fallback.
- **Hinglish ambiguity.** Mixed scripts, transcription noise, number words ("dedh", "adhai"), and slang. Needs a growing test set.
- **Date ambiguity.** "kal" can mean yesterday or tomorrow in Hindi; we choose yesterday for expenses. Wrong guesses are possible, so entries show the resolved date.
- **Serverless time limits.** The LLM call plus DB write must fit the platform's function timeout. Verify the limit for the chosen plan.
- **Guest account loss.** Browser data clear, device change, or iOS PWA storage separation (installed PWA may not share cookies with Safari). Mitigation: recovery code, prompt install early, nudge backup after some entries.
- **Offline + voice conflict.** Voice transcription needs the network, so offline mode will mainly be text-based. Offline queue needs service worker + IndexedDB; Background Sync is not supported everywhere (notably iOS).
- **Sync conflicts.** Future offline edits and Sheet sync need a conflict strategy (last-write-wins using `updatedAt` for v1).
- **Abuse.** Fake guest creation, LLM quota burning. Needs IP/user limits (and possibly CAPTCHA later).
- **Free-tier infra limits.** Atlas free cluster storage, Vercel limits; plan the upgrade path.
- **Category drift.** Fixed categories won't fit everyone; `categoryHint` data guides evolution.

---

## 14. Roadmap

**Phase 0 — Design (done):** HLD, LLD, schema, parser prompt.

**Phase 1 — Core MVP (current focus)**
1. Mongo connect, `User` model, guest auth
2. Parser module + 15–20 test sentences
3. `POST /entries`, list, edit, delete
4. `/stats` aggregation
5. UI: InputBar → list → charts
6. PWA manifest + responsive polish

*Milestone 1:* send "500 chai pe cash se" via Postman and see the correct entry in DB.
*Milestone 2:* full flow works on a phone browser, by voice.

**Phase 2 — Hardening**
- Rate limits (per user, per IP, global LLM)
- Better error states, retry UX
- Parser test suite growth from real failures

**Phase 3 — Slow network & offline**
- Optimistic UI + request retry with backoff
- Service worker, app-shell caching
- IndexedDB queue using `clientId` for idempotent replay
- Text-first offline entry; parse when back online (`parseStatus` pending state)

**Phase 4 — Account recovery**
- Recovery code
- Email magic link / OTP (Resend/Brevo)

**Phase 5 — Backup & export**
- Export CSV / Excel button
- Optional Google Sheet backup (`updatedAt` + soft delete makes incremental sync possible)
- Backup reminders

**Phase 6 — Growth features (ideas)**
- Budgets and alerts, recurring entries, monthly summary
- Custom categories, tags
- Multi-timezone, multi-currency
- Insights ("food spend up 30% vs last month")
- Shared / family / business accounts
- Alternative or paid LLM provider, own fine-tuned/cheap parser fallback (regex rules for simple sentences before calling LLM)

---

## 15. Security & Privacy

- JWT secret in env, cookie is `httpOnly`, `Secure`, `SameSite=Lax`.
- Every query is scoped by `userId` from the cookie. Never trust a `userId` from the request body.
- zod validation on all inputs; `rawText` length-capped (500) to limit prompt abuse and cost.
- Prompt-injection awareness: LLM output is only data; it is validated and never executed or trusted for authorization.
- Recovery codes stored hashed.
- Do not log raw expense text in plain production logs.
- Be transparent: voice recognition may be processed by the browser vendor, parsing text is sent to Gemini.
- Plan data export and delete-my-data for the user.

---

## 16. Testing Strategy

- **Parser test set** (most important): 15–20 sentences initially, grown from real failures. Each has input, expected output, and "today" fixed for date tests.

| Input (today = 2026-11-02, Monday) | Expected |
|---|---|
| 500 chai pe cash se | 500, food, cash, no date |
| kal petrol 300 upi | 300, fuel, upi, 2026-11-01 |
| 20 october ko 1200 ka bijli bill bhara | 1200, bills, 2026-10-20 |
| salary aayi 45000 | 45000, income, salary |
| chai 20 aur samosa 30 | 2 entries, food |
| kal chai pi | amount null → failed entry |
| aaj kuch kharch nahi hua | empty entries |
| paanch sau ka recharge | 500, bills |
| 5k rent diya | 5000, rent |
| last monday dawa 250 | 250, health, 2026-10-26 |

- Unit tests: `resolveDate` (future clamp, invalid date, year rollover), `toEntryFields` (paise rounding, category/type fix).
- API tests: idempotency (same `clientId` twice), auth scoping, soft delete, pagination.
- Manual: real voice tests on Android Chrome and iOS Safari.

---

## 17. Project Structure & Setup

```
/
├─ app/
│  ├─ page.tsx
│  └─ api/
│     ├─ auth/guest/route.ts
│     ├─ me/route.ts
│     ├─ entries/route.ts
│     ├─ entries/[id]/route.ts
│     └─ stats/route.ts
├─ components/
├─ lib/
│  ├─ constants.ts
│  ├─ db.ts
│  ├─ auth.ts
│  ├─ rateLimit.ts
│  └─ parser/
│     ├─ index.ts        (parse())
│     ├─ prompt.ts
│     ├─ schema.ts
│     └─ normalize.ts
├─ models/
│  ├─ User.ts
│  └─ Entry.ts
└─ public/ (manifest, icons)
```

### Environment variables
```
MONGODB_URI=
JWT_SECRET=
GEMINI_API_KEY=
# later
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
```

### Run locally
```bash
npm install
npm run dev
```

---

## 18. Open Questions

- Product name and branding?
- Hosting plan limits: will the 8s LLM timeout fit the function timeout?
- Which analytics (if any) to measure activation and retention without hurting privacy?
- When to prompt users to save their recovery code (after N entries?)
- Should simple sentences be parsed by regex first to reduce LLM calls?
- Which paid LLM/provider to move to when free quota is not enough?
- How to handle "kal" meaning tomorrow for future-planned expenses (currently out of scope)?
- Do we need CAPTCHA on guest creation once users grow?
