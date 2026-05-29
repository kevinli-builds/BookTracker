# BookTracker — Claude Context

## Concept
A research reading-tracker app for a marketing PhD study. Participants log books
they read, track streaks and reading time, and receive goals (self-set or
randomly assigned by the researcher). The researcher ("provisioner") has a
separate web admin panel to invite participants, design and assign goals, manage
participants, and export aggregated data and feedback.

Participation is **invite-only**: the researcher generates single-use invite
codes; a participant must enter a valid code on first launch to use the app.
Participants are otherwise anonymous (a device UUID + a name/ID they enter, or a
label baked into their invite code) — no passwords, minimal PII.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Mobile app | React Native 0.81 + Expo SDK 54 (React 19; New Architecture on by default) |
| Language | TypeScript throughout |
| Backend | Node.js + Express (serverless on Vercel via `@vercel/node`) |
| ORM | Prisma v5 |
| Database | PostgreSQL (Neon.tech free tier, pooled connection) |
| Book data | Google Books API (no key needed for basic search) |
| Admin auth | JWT (provisioner only; 7-day expiry) |
| Participant gating | Single-use invite codes (no passwords) |
| Hosting | Vercel — backend + admin panel are separate Vercel projects |
| Secrets | backend `.env` (gitignored) + Vercel dashboard env vars |

---

## Live URLs

| Surface | URL |
|---|---|
| Backend API | https://book-tracker-api.vercel.app (alias of `book-tracker-five-nu`) |
| Web admin panel | https://book-tracker-admin.vercel.app (alias of `book-tracker-pf8s`) |
| GitHub | https://github.com/snowwarrior1-alt/BookTracker (branch `main`) |

A provisioner account exists (`admin@booktracker.com`). The password is the
default seeded at setup — **change it** via the admin panel's "Change password"
button. Never commit the password to this repo.

---

## Repository Structure

```
BookTracker/
├── backend/
│   ├── src/
│   │   ├── index.ts                Express app; route mounting; 404 + global error handler; exports app (serverless) and only listens when !VERCEL
│   │   ├── lib/
│   │   │   ├── prisma.ts           Prisma client singleton
│   │   │   ├── streak.ts           Streak update logic (called after every log)
│   │   │   ├── auth.ts             JWT sign/verify, requireAuth middleware
│   │   │   ├── asyncHandler.ts     Wraps async routes so rejections hit the global error handler
│   │   │   ├── inviteCode.ts       Human-friendly invite-code generator (no ambiguous chars)
│   │   │   └── goalProgress.ts     Shared "criteria met?" computation for a goal + a user's logs
│   │   └── routes/
│   │       ├── users.ts            POST /users — upsert device user; returns hasAccess
│   │       ├── invites.ts          POST /invites/redeem — participant redeems an invite code
│   │       ├── books.ts            GET /books/search — proxy Google Books API
│   │       ├── logs.ts             POST /logs (stores categories), GET /logs/:userId
│   │       ├── goals.ts            GET /goals/templates, POST /goals/self, PATCH /goals/:id/complete|abandon, GET /goals/:userId
│   │       ├── feedback.ts         POST /feedback
│   │       ├── stats.ts            GET /stats/:userId — per-user aggregated stats
│   │       └── admin.ts            Auth + provisioner-only endpoints (see API table)
│   ├── prisma/
│   │   ├── schema.prisma           Models: User, ReadingLog, Streak, GoalTemplate, UserGoal, Feedback, Provisioner, InviteCode
│   │   └── migrations/             init, invite_codes, participant_status, reading_log_categories
│   ├── vercel.json                 Routes all paths to src/index.ts via @vercel/node
│   └── package.json                vercel-build = "prisma generate && prisma migrate deploy"
├── app/                            React Native / Expo app
│   ├── App.tsx                     Root gate: invite code → name → 4-tab navigator
│   ├── app.json                    Expo config (extra.apiUrl = Vercel backend)
│   ├── eas.json                    EAS Build profiles (development/preview/production)
│   └── src/
│       ├── api/client.ts           Axios instance + all typed API functions
│       ├── lib/userId.ts           Persistent device UUID via expo-secure-store
│       └── screens/
│           ├── InviteCodeScreen.tsx  First-launch invite-code gate
│           ├── NameEntryScreen.tsx   Name/participant-ID entry (skipped if code carried a label)
│           ├── HomeScreen.tsx        Stat cards + recent reading log list
│           ├── SearchScreen.tsx      Google Books search + log-a-book (sends categories)
│           ├── GoalsScreen.tsx       Active/past goals, add/complete/abandon, feedback modal
│           └── ProfileScreen.tsx     Editable name + full stats (totals, streaks, top books, chart)
├── web/                            Provisioner admin panel (Vite + React)
│   ├── .env.production             VITE_API_URL (committed; the prod API URL is not secret)
│   ├── vercel.json                 SPA rewrite — all paths → index.html
│   └── src/
│       ├── App.tsx                 Auth gate + global error banner + session-expiry handling
│       ├── api/client.ts           Axios + JWT mgmt + response interceptor (errors / 401)
│       ├── lib/csv.ts              Generic CSV builder + browser download
│       └── pages/
│           ├── Nav.tsx               Top nav (Dashboard, Goals, Invites, Participants, Data) + Change password
│           ├── LoginPage.tsx         Provisioner login (+ "session expired" notice)
│           ├── DashboardPage.tsx     Summary stats + top books + goal completion rates
│           ├── GoalsPage.tsx         Graphical goal builder (no JSON) + random assignment
│           ├── InvitesPage.tsx       Invite instructions + generate/copy/revoke codes + export
│           ├── UsersPage.tsx         "Participants": search, code/label/status, detail modal, mgmt
│           └── DataPage.tsx          Tabs: Goal Progress (auto-check) | Feedback | Goal Outcomes
├── render.yaml                     Legacy Render config — UNUSED (we deploy on Vercel)
└── .gitignore
```

---

## Database Schema

```prisma
User           id (device UUID), displayName, status (active|withdrawn), createdAt
ReadingLog     id, userId, googleBooksId, title, author, coverUrl, categories[], minutesRead, loggedAt
Streak         userId (PK), currentStreak, longestStreak, lastReadDate
GoalTemplate   id, title, description, type, criteria (JSON), randomPool, createdAt
UserGoal       id, userId, templateId, status (active|completed|abandoned), assignedBy (self|system), assignedAt, completedAt, deadline
Feedback       id, userId, userGoalId, rating (int 1-5), text, createdAt
Provisioner    id, email, passwordHash, createdAt
InviteCode     id, code (unique), label (optional participant ID), usedByUserId (unique), usedAt, createdAt
```

`User.inviteCode` is a 1:1 back-relation to the `InviteCode` a participant
redeemed — this is how behavioral data is tied back to a recruited person.

---

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|---|---|---|
| POST | `/users` | Upsert device user; returns `{…, hasAccess}` |
| POST | `/invites/redeem` | `{userId, code}` → redeem an invite code (gates the app); adopts code label as name |
| GET | `/books/search?q=` | Search Google Books |
| POST | `/logs` | Log a reading session (stores `categories`; triggers streak update) |
| GET | `/logs/:userId` | Get all logs for user |
| GET | `/goals/templates` | List all goal templates |
| POST | `/goals/self` | User picks a goal |
| GET | `/goals/:userId` | Get user's goals |
| PATCH | `/goals/:goalId/complete` | Mark goal complete |
| PATCH | `/goals/:goalId/abandon` | Abandon goal |
| POST | `/feedback` | Submit feedback on a goal |
| GET | `/stats/:userId` | Aggregated stats for user |
| GET | `/health` | `{ok: true}` |

### Admin (JWT required, except login/register)
| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` | Get JWT (7-day) |
| POST | `/admin/register` | Create provisioner (requires SETUP_KEY) |
| POST | `/admin/change-password` | Change own password (verifies current) |
| GET | `/admin/users` | All participants w/ code, label, status, counts, streak |
| GET | `/admin/users/:id` | Full participant detail: code, logs, goals+progress, feedback |
| PATCH | `/admin/users/:id` | Edit displayName and/or status (active|withdrawn) |
| GET | `/admin/goals` | Goal templates w/ assignment counts |
| POST/PATCH/DELETE | `/admin/goals[/:id]` | CRUD goal templates |
| POST | `/admin/assign` | Randomly assign pool goals (to all *active*, or selected) |
| GET | `/admin/invites` | List invite codes + redeemer |
| POST | `/admin/invites` | Generate codes — `{labels:[…]}` or `{count:N}` |
| DELETE | `/admin/invites/:id` | Revoke an unused code |
| GET | `/admin/logs` | All reading logs joined with participant name/code (for export) |
| GET | `/admin/goal-progress` | Per-assignment auto-checked progress + "criteria met" flag |
| GET | `/admin/data` | Aggregate research data + feedback (w/ participant code) |

Unknown routes return JSON `{error:"Not found"}` (404); unhandled errors return a
generic 500 (or 400 for malformed JSON) via the global error middleware — no
stack-trace leaks.

---

## Goals & Auto-checking

The admin builds goals with a **graphical form** (no JSON). `type` + `criteria`:
- `books_count` → `{count:N}` — distinct books logged
- `minutes` → `{minutes:N}` — total minutes logged
- `author` → `{author:"…"}` — a book whose author matches
- `genre` → `{genre:"…"}` — a book whose Google Books categories match
- `custom` → `{}` — free-form, manual only

Participants mark goals complete themselves (this self-report + feedback is a
research signal). The admin **Data → Goal Progress** tab also auto-checks each
assignment against reading logged *after* it was assigned, and flags "criteria
met" without changing the participant's status (so self-reported vs behavioral
completion stay distinguishable). Auto-checkable: books_count, minutes, author,
genre. `custom` is manual-only. Genre only works for books logged *after* the
categories feature shipped (older logs have no categories).

---

## Environment Variables

Never commit values. Names only:

### Backend — `backend/.env` locally; Vercel dashboard in prod
```
DATABASE_URL        # Neon pooled connection string
JWT_SECRET          # long random string for JWT signing
SETUP_KEY           # one-time secret to create the provisioner account
GOOGLE_BOOKS_API_KEY  # optional — works without, just rate-limited
PORT                # local only; ignored on Vercel
```

### Web admin
`VITE_API_URL` is committed in `web/.env.production` (the prod API URL is public,
not a secret). There is **no** `VITE_API_URL` in the Vercel dashboard — it was
removed after a hand-typed-typo incident broke the admin; keep it in the file.

### App — `app/app.json` → `extra.apiUrl`
Already points at `https://book-tracker-api.vercel.app`.

---

## Running Locally

```bash
# Backend
cd backend
npm install
# create backend/.env (see vars above)
npx prisma generate
npm run dev                 # http://localhost:3000

# Web admin (separate terminal)
cd web
npm install
# .env.production already has the prod URL; for local API use a .env.local with VITE_API_URL=http://localhost:3000
npm run dev                 # http://localhost:5173

# App (separate terminal) — talks to the cloud backend by default
cd app
npm install
npm start                   # scan QR with Expo Go
```

First-time provisioner account:
```bash
curl -X POST https://book-tracker-api.vercel.app/admin/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"…","setupKey":"<SETUP_KEY>"}'
```

---

## Deployment (Vercel)

Two Vercel projects watch this repo; every push to `main` deploys both.

1. **Backend** project `book-tracker` — root dir `backend`. `vercel-build` runs
   `prisma generate && prisma migrate deploy`. Domain alias `book-tracker-api`.
   Env vars set in the Vercel dashboard.
2. **Admin** project `book-tracker-pf8s` — root dir `web`. Vite build; `web/vercel.json`
   gives the SPA an index.html rewrite (deep links/refresh work). Domain alias
   `book-tracker-admin`. Reads `VITE_API_URL` from `web/.env.production`.
3. **Database** — Neon. Migrations are applied locally with `prisma migrate dev`
   (against Neon) before pushing; the prod `migrate deploy` is then a no-op safety net.

> **Known flake:** `prisma migrate deploy` occasionally fails on Neon's pooled
> endpoint with `P1002` (advisory-lock timeout). It's transient — just redeploy
> the failed build. (Hardening option: point migrations at Neon's direct,
> non-pooled connection via Prisma `directUrl`, or drop `migrate deploy` from the
> build since migrations are already applied locally.)

---

## Getting the App to Participants

The app talks to the **cloud** backend (`extra.apiUrl` = the Vercel URL), so a
participant's phone only needs internet — it does NOT need to be on the same
Wi-Fi as the developer.

### Pilot (free, no build) — Expo Go + tunnel

Run this on any computer with the repo. Participants can be anywhere.

```bash
cd app
npm install                 # first time only
npx expo start --tunnel     # first run asks to install @expo/ngrok — say yes
```

This prints a **QR code** and an `exp://…exp.direct` **link**. That QR/link is
exactly the "study's BookTracker link" referenced in the admin panel's invite
instructions — share it in recruitment.

Tell each participant:
- **iPhone:** install **Expo Go** from the App Store → open the **Camera** app →
  point at the QR → tap the banner to open it in Expo Go.
- **Android:** install **Expo Go** from Google Play → open Expo Go → **Scan QR
  code** → scan it.

Then BookTracker loads and asks for their invite code.

**Pilot caveats:**
- Works only while this `expo start` process keeps running on the computer.
- The tunnel URL changes each time you restart, so regenerate/reshare the QR per
  session. Fine for validating with a handful of people; not for a 24/7 study.

### Scaling up (always-on) — EAS Build

`app/eas.json` is already configured. When you outgrow the pilot:
- **Android (free):** `cd app && eas build -p android --profile preview` →
  produces a permanent, installable **APK** with a shareable link/QR. Participants
  tap to install (they may need to allow "install from unknown sources").
- **iOS (paid):** requires an **Apple Developer account ($99/yr)** + **TestFlight**
  (participants install the TestFlight app, then accept an invite). There is no
  free way to put an iOS app on arbitrary phones.
- Both need a free **Expo account** + `npm i -g eas-cli` then `eas login` and
  `eas init` (the latter writes `extra.eas.projectId` into `app.json`).

> Heads-up: modern Expo (SDK 50+) removed the old `expo publish` flow, so there is
> no "permanent Expo Go link anyone can open." Permanent distribution = EAS Build.

---

## Current Status (as of 2026-05-29)

**Backend + admin panel are deployed, live, and verified. The mobile app
compiles and bundles clean on SDK 54 but has NOT yet been run on a physical
device — the pilot run will be its first real on-device launch.**

### Done & verified live
- Backend on Vercel: all routes, JWT auth, global error handling, invite redeem
  (atomic), participant management, goal auto-check (books/minutes/author/genre).
  Verified via live end-to-end tests. Streaks use the participant's local date.
- Admin panel: invites (+ install/recruit instructions + QR generator), graphical
  goal builder, Participants page (search, detail, rename, withdraw), Goal Progress
  auto-check, CSV exports with invite code/label threaded through, change-password,
  global error banner + session-expiry redirect, shared UI components. Verified
  in-browser.
- Mobile app upgraded to **Expo SDK 54** (React 19, RN 0.81, React Navigation v7).
  `expo install --check` clean, tsc clean, full Metro `expo export` bundle (836
  modules) builds with no errors. Per-screen load-error/retry handling added.
- Database on Neon with 6 migrations applied.

### Next
1. **Pilot run** — `cd app && npm install && npx expo start --tunnel`; open in
   **Expo Go (must be the SDK 54 build)**; walk the full flow (redeem code → log a
   book → goals → profile). New Architecture is on by default — watch for any
   on-device-only quirks.
2. Generate invite codes in the admin, paste the tunnel link into the Invites-page
   QR tool, hand the QR + codes to a few testers.
3. When ready to scale, set up EAS Build (Android free APK / iOS TestFlight).

### Optional follow-ups noted
- Harden the `migrate deploy` advisory-lock flake (Prisma `directUrl`, or drop it).
- From the code review, conscious-tradeoff items left as-is: distinct-book count
  inconsistency (id vs title), unauthenticated UUID-keyed participant endpoints,
  open CORS / no login rate-limit, duplicated API types between app and web.

---

## Notes
- Use `npm.cmd` (not `npm`) in PowerShell to avoid `.ps1` execution policy errors.
- The `prisma` package must be in `dependencies` (not devDependencies) — the
  build calls it at deploy time.
- Apply schema changes with `prisma migrate dev` locally (against Neon) before
  pushing, so prod `migrate deploy` is just a confirmation.
- Google Books API works without a key but is rate-limited; add a key in prod.
- Participants are invite-gated and anonymous; keep the master list of
  code → real person OUTSIDE the app.
- SDK 54 requires participants' Expo Go to be the SDK 54 build; New Architecture
  is enabled by default. The reading streak relies on the app sending its local
  date with each log (`localDate`).
- `@expo/ngrok` is a dependency so `npx expo start --tunnel` works out of the box.
