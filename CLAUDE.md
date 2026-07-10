# BookTracker — Claude Context

## Notes & handoff — READ FIRST when told to "go through your notes"
**`OPUS_BRIEF.md`** (repo root) is the forward roadmap of record: PM/design/security
audits (sections 1-3), delight ideas (4), first-visit cold opens (5, shipped), wave-2 (6),
Fable design notes (7), mobile/web scan (8), and the depth roadmap (9) — plus a **status
ledger at the very top** marking what has shipped vs. what is next. When asked to pick up
the next enhancement: (1) read the brief; (2) run `git log --oneline -20` + `git status` —
a dirty working tree means another agent is mid-flight, so choose a different area or write
specs rather than edit the same files; (3) confirm the item is not already built; (4) build
it with the house conventions (tests, then commit + push).

## Concept
A research reading-tracker app for a marketing PhD study comparing reading
behavior **when people track vs. when they don't**. Participants log books, build
streaks, log reading time, and pursue goals (self-chosen or randomly assigned).
The researcher ("provisioner") uses a separate web admin panel to invite
participants, assign them to experimental groups, build goals and a recurring
check-in survey, configure each group's app experience, and export everything to
CSV keyed to the participant.

Participation is **invite-only**: the researcher generates single-use invite
codes; a participant enters a valid code on first launch. Participants are
otherwise anonymous — a device UUID + a name/ID they enter (or a label baked into
their invite code). No participant passwords, minimal PII.

### Research design support (the why behind several features)
- **Study groups / conditions** — randomly (balanced) or manually assign each
  participant to a named group (e.g. `tracking` / `control`). The group rides
  along in every CSV export so analysis can split by condition.
- **Periodic check-in survey** — an admin-configurable questionnaire EVERY
  participant answers on a schedule. It's the **shared outcome measure** across
  conditions (the control group isn't logging books, so logs alone can't compare
  groups).
- **Per-group app experience** — the admin can opt-in to hide the tracking
  features (logging, goals) for any group, giving e.g. the control group a
  check-in-only app. Default: every group sees the full app.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Mobile app | React Native 0.81 + Expo SDK 54 (React 19; New Architecture default) |
| Language | TypeScript throughout |
| Backend | Node.js + Express (serverless on Vercel via `@vercel/node`) |
| ORM | Prisma v5 |
| Database | PostgreSQL (Neon.tech free tier, pooled connection) |
| Book data | Open Library API (free, no key); optional Google Books if `GOOGLE_BOOKS_API_KEY` set |
| Admin auth | JWT (provisioner only; 7-day expiry) |
| Participant gating | Single-use invite codes (no passwords) |
| Hosting | Vercel — backend + admin panel are separate Vercel projects |

---

## Live URLs

| Surface | URL |
|---|---|
| Backend API | https://book-tracker-api.vercel.app (alias of `book-tracker-five-nu`) |
| Web admin panel | https://book-tracker-admin.vercel.app (alias of `book-tracker-pf8s`) |
| GitHub | https://github.com/snowwarrior1-alt/BookTracker (branch `main`) |

A provisioner account exists (`admin@booktracker.com`). **⚠️ The password is still
the setup default — change it via the admin panel's "Change password" button.**
Never commit the password.

---

## Repository Structure

```
BookTracker/
├── backend/
│   ├── src/
│   │   ├── index.ts                Express app; CORS allowlist; route mounting; 404 + global error handler; listens only when !VERCEL
│   │   ├── lib/
│   │   │   ├── prisma.ts           Prisma client singleton (global-guarded)
│   │   │   ├── streak.ts           Streak update, keyed off the participant's LOCAL date
│   │   │   ├── auth.ts             JWT sign/verify, requireAuth, Request.provisionerId augmentation, prod fail-fast if JWT_SECRET unset
│   │   │   ├── asyncHandler.ts     Wraps async routes so rejections hit the global error handler
│   │   │   ├── inviteCode.ts       Human-friendly invite-code generator (no ambiguous chars)
│   │   │   ├── goalProgress.ts     Shared "criteria met?" computation (books_count/pages/minutes/author/genre/specific_book)
│   │   │   └── studyConfig.ts      shouldHideTracking(group) helper
│   │   └── routes/
│   │       ├── users.ts            POST /users — upsert device user; returns hasAccess + hideTracking
│   │       ├── invites.ts          POST /invites/redeem — atomic code claim; adopts label as name
│   │       ├── surveys.ts          GET /surveys/:userId (questions + due), POST /surveys (submit)
│   │       ├── books.ts            GET /books/search — Open Library (Google Books if key set), real 502 on failure
│   │       ├── logs.ts             POST /logs (stores categories+pageCount, auto-completes goals), GET /logs/:userId
│   │       ├── goals.ts            GET /goals/templates, POST /goals/self, PATCH /goals/:id/complete|abandon, GET /goals/:userId (incl. hasFeedback)
│   │       ├── feedback.ts         POST /feedback
│   │       ├── stats.ts            GET /stats/:userId — per-user aggregated stats
│   │       └── admin/             (split by domain; index.ts owns the public-vs-protected boundary)
│   │           ├── index.ts        login/register public → requireAuth → mounts the rest
│   │           ├── auth.ts         login, register (SETUP_KEY-gated), change-password
│   │           ├── participants.ts /users list/detail/edit, assign-groups, study-config (hide-tracking)
│   │           ├── goals.ts        goal-template CRUD + /assign (random pool)
│   │           ├── invites.ts      generate/list/revoke invite codes
│   │           ├── data.ts         /logs export, /goal-progress, /data dashboard aggregates
│   │           ├── survey.ts       cadence + question CRUD + standard set + /surveys responses export
│   │           └── shared.ts       reusable Prisma select fragments (invite code, participant, identity)
│   ├── prisma/
│   │   ├── schema.prisma           Models below
│   │   └── migrations/             init → invite_codes → participant_status → reading_log_categories → reading_log_pagecount → user_study_group → survey → study_config_hide_tracking
│   ├── vercel.json                 Routes all paths to src/index.ts via @vercel/node
│   └── package.json                vercel-build = "prisma generate && prisma migrate deploy"
├── app/                            React Native / Expo app
│   ├── App.tsx                     Gate: invite code → name → tabs. Tabs depend on hideTracking (full = Home/Log/Goals/Check-in/Profile; hidden = Check-in/Profile)
│   ├── app.json                    Expo config (extra.apiUrl = Vercel backend)
│   ├── eas.json                    EAS Build profiles (development/preview/production)
│   └── src/
│       ├── api/client.ts           Axios instance + all typed API functions
│       ├── lib/userId.ts           Persistent device UUID via expo-secure-store
│       ├── components/RetryView.tsx  Shared load-error/retry view
│       └── screens/
│           ├── InviteCodeScreen.tsx  First-launch invite-code gate
│           ├── NameEntryScreen.tsx   Name/participant-ID entry (skipped if code carried a label)
│           ├── HomeScreen.tsx        Stat cards + recent reading (refetch on focus)
│           ├── SearchScreen.tsx      Book search + log-a-book (sends categories, pageCount, localDate)
│           ├── GoalsScreen.tsx       Goals; auto-checkable goals show "auto-completes" note; feedback prompt on completed-without-feedback
│           ├── CheckinScreen.tsx     Dynamic survey form (number/rating/text), due/next-due logic
│           └── ProfileScreen.tsx     Editable name + full stats
├── web/                            Provisioner admin panel (Vite + React)
│   ├── .env.production             VITE_API_URL (committed; the prod API URL is not secret)
│   ├── vercel.json                 SPA rewrite — all paths → index.html
│   └── src/
│       ├── App.tsx                 Auth gate + global error banner + session-expiry handling
│       ├── api/client.ts           Axios + JWT mgmt + response interceptor (errors / 401)
│       ├── lib/csv.ts              CSV builder + download (escapes formula-injection)
│       ├── components/
│       │   ├── ui.tsx               Shared PageHeader / ExportButton / ConfirmDialog / tableStyles
│       │   └── ParticipantDetail.tsx  Per-participant management modal (rename, status, group, logs/goals/feedback)
│       └── pages/
│           ├── Nav.tsx               Dashboard · Goals · Invites · Participants · Survey · Data
│           ├── LoginPage.tsx         Provisioner login (+ "session expired" notice)
│           ├── DashboardPage.tsx     Summary stats + top books + goal completion rates
│           ├── GoalsPage.tsx         Graphical goal builder (books/pages/minutes/genre/author/specific-book) + random assignment
│           ├── InvitesPage.tsx       Invite + recruit instructions, QR generator, owner "run it yourself" steps, code mgmt
│           ├── UsersPage.tsx         "Participants": search, code/label/status/group columns, random+manual group assignment, per-group hide-tracking toggles, detail modal, CSV
│           ├── SurveyPage.tsx        Check-in builder: cadence, add/edit/reorder/remove questions, responses CSV
│           └── DataPage.tsx          Tabs: Goal Progress (auto-check) | Feedback | Goal Outcomes
└── .gitignore
```

---

## Database Schema

```prisma
User           id (device UUID), displayName, status (active|withdrawn), studyGroup (nullable), createdAt
ReadingLog     id, userId, googleBooksId, title, author, coverUrl, categories[], pageCount?, minutesRead, loggedAt
Streak         userId (PK), currentStreak, longestStreak, lastReadDate
GoalTemplate   id, title, description, type, criteria (JSON), randomPool, createdAt
UserGoal       id, userId, templateId, status (active|completed|abandoned), assignedBy (self|system), assignedAt, completedAt, deadline
Feedback       id, userId, userGoalId, rating, text, createdAt
Provisioner    id, email, passwordHash, createdAt
InviteCode     id, code (unique), label (participant ID), usedByUserId (unique), usedAt, createdAt
SurveyConfig   id="default" (singleton), cadenceDays
SurveyQuestion id, prompt, type (number|rating|text), sortOrder, required, active
SurveyResponse id, userId, answers (JSON {questionId: value}), submittedAt
StudyConfig    id="default" (singleton), hideTrackingGroups[]
```

`User.inviteCode` (1:1 back-relation) ties behavioral data to a recruited person.
`studyGroup` is a free-form name; the admin's hide-tracking config and exports use it.

---

## API Endpoints

### Public (no auth) — keyed by device UUID
| Method | Path | Description |
|---|---|---|
| POST | `/users` | Upsert device user → `{…, hasAccess, hideTracking}` |
| POST | `/invites/redeem` | `{userId, code}` → atomic claim; adopts code label as name → `{…, hasAccess, hideTracking}` |
| GET | `/books/search?q=` | Open Library search (Google Books if key set); 502 on failure |
| POST | `/logs` | Log reading (stores categories/pageCount; updates streak via `localDate`; **auto-completes met goals**) |
| GET | `/logs/:userId` | All logs for user |
| GET | `/goals/templates` · POST `/goals/self` · GET `/goals/:userId` (incl. `hasFeedback`) | Goal templates / self-add / list |
| PATCH | `/goals/:goalId/complete\|abandon` | Manual complete (custom goals) / abandon |
| POST | `/feedback` | Feedback on a goal |
| GET | `/stats/:userId` | Aggregated stats |
| GET | `/surveys/:userId` | Active questions + cadence + `due`/`nextDueAt` |
| POST | `/surveys` | `{userId, answers}` → submit a check-in (validates required) |
| GET | `/health` | `{ok:true}` |

### Admin (JWT required, except login/register)
| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` · `/admin/register` (SETUP_KEY) · `/admin/change-password` | Auth |
| GET | `/admin/users` | Participants w/ code, label, status, **group**, counts, streak |
| GET/PATCH | `/admin/users/:id` | Detail (logs, goals+progress, feedback); edit displayName/status/**studyGroup** |
| POST | `/admin/assign-groups` | Balanced random group assignment (target all/unassigned/selected) |
| GET/PATCH | `/admin/study-config` | `hideTrackingGroups` — which groups get the check-in-only app |
| GET/POST/PATCH/DELETE | `/admin/goals[/:id]` · POST `/admin/assign` | Goal templates + random pool assignment |
| GET/POST/DELETE | `/admin/invites[/:id]` | Invite codes |
| GET | `/admin/logs` · `/admin/goal-progress` · `/admin/data` | Exports + dashboard (all carry participant code/label/group) |
| GET/PATCH | `/admin/survey/config` | Cadence (days) |
| GET/POST/PATCH/DELETE | `/admin/survey/questions[/:id]` · POST `/admin/survey/questions/standard` | Question CRUD + load standard set |
| GET | `/admin/surveys` | All responses + question set, for dynamic CSV export |

Unknown routes → JSON 404; unhandled errors → generic 500 (or 400 malformed JSON). No stack-trace leaks.

---

## Goals & Auto-completion

Admin builds goals with a **graphical form** (no JSON). `type` → `criteria`:
- `books_count` → `{count}` · `pages` → `{pages}` (sums distinct books' page counts)
- `minutes` → `{minutes}` · `author` → `{author}` · `genre` → `{genre}` (matches Open Library categories)
- `specific_book` → `{googleBooksId, title}` (admin searches & picks the book)
- `custom` → `{}` — manual only

**Goals auto-complete from logging.** When a participant logs a book, the backend
re-evaluates their active goals and completes any whose criteria are met (all
types except `custom`). The app shows "✓ Completes automatically as you log
books" for these, and on the Goals tab prompts for rating/comment feedback on any
completed goal that lacks it (`/goals/:userId` returns `hasFeedback`). Only
`custom` goals keep a manual "Mark complete" button. The admin **Data → Goal
Progress** tab independently shows computed progress + a "criteria met" flag.

---

## Security posture
- **No SQL injection** (Prisma parameterized; zero raw queries). **No XSS sinks**
  (no innerHTML/eval; React escapes). **0 dependency vulnerabilities** (prod).
- **CORS locked** to the admin origin(s) + localhost (override with `ADMIN_ORIGINS`).
  No-Origin clients (native app, curl) allowed; unknown browser origins blocked.
- **CSV formula-injection guarded**: cells starting with `= + - @` (tab/CR) are
  quote-prefixed so participant text can't execute in Excel/Sheets.
- **Secrets fail-fast**: prod throws if `JWT_SECRET` is unset (no public-default
  fallback); `/admin/register` requires `SETUP_KEY` to be set. Passwords bcrypt(12).
- **Accepted tradeoffs**: participant endpoints are unauthenticated, keyed by an
  unguessable 122-bit UUID and scoped to that one user (no cross-participant leak)
  — reasonable for anonymous research data. No rate limiting (would need an
  external store on Vercel; a strong admin password covers login brute-force).
- **Outstanding**: change the default admin password (see Live URLs).

---

## Environment Variables (names only — never commit values)

### Backend — `backend/.env` locally; Vercel dashboard in prod
```
DATABASE_URL          # Neon pooled connection string
JWT_SECRET            # REQUIRED in prod (app refuses to start without it)
SETUP_KEY             # REQUIRED to use /admin/register
GOOGLE_BOOKS_API_KEY  # optional — if set, Google Books is tried before Open Library
ADMIN_ORIGINS         # optional — comma-separated CORS allowlist (defaults to the known admin origins + localhost)
PORT                  # local only; ignored on Vercel
```

### Web admin
`VITE_API_URL` is committed in `web/.env.production` (public). There is **no**
`VITE_API_URL` in the Vercel dashboard — it was removed after a typo there broke
the admin; keep it in the file.

### App — `app/app.json` → `extra.apiUrl`
Points at `https://book-tracker-api.vercel.app`.

---

## Running Locally

```bash
# Backend
cd backend && npm install
# create backend/.env (vars above); then:
npx prisma generate && npm run dev      # http://localhost:3000

# Web admin (separate terminal)
cd web && npm install
# for a local API: .env.local with VITE_API_URL=http://localhost:3000
npm run dev                              # http://localhost:5173

# App (separate terminal) — talks to the cloud backend by default
cd app && npm install && npm start       # scan QR with Expo Go (SDK 54 build)
```

First-time provisioner: `POST /admin/register` with `{email,password,setupKey:<SETUP_KEY>}`.

---

## Deployment (Vercel)

Two projects watch this repo; every push to `main` deploys both.
1. **Backend** `book-tracker` — root `backend`; `vercel-build` runs
   `prisma generate && prisma migrate deploy`; alias `book-tracker-api`. Env in dashboard.
2. **Admin** `book-tracker-pf8s` — root `web`; Vite build; `web/vercel.json` SPA
   rewrite; alias `book-tracker-admin`; reads `VITE_API_URL` from `.env.production`.
3. **Database** Neon — apply migrations locally with `prisma migrate dev` (against
   Neon) BEFORE pushing, so prod `migrate deploy` is a no-op safety net.

> **Known flake:** `prisma migrate deploy` occasionally fails on Neon's pooled
> endpoint with `P1002` (advisory-lock timeout) — transient; just redeploy.

---

## Getting the App to Participants

The app talks to the **cloud** backend, so a phone only needs internet (not the
same Wi-Fi). The admin **Invites** page has full in-app instructions, a QR
generator, and an owner "run it yourself" step-by-step (incl. cloning the repo).

### Pilot (free, no build) — Expo Go + tunnel
```bash
cd app && npm install
npx expo start --tunnel      # first run installs @expo/ngrok — say yes
```
Prints a QR + `exp://…exp.direct` link. Participants install **Expo Go**, then
iPhone: Camera → QR; Android: Expo Go → Scan QR. Caveats: only works while the
process runs; the link changes on restart (regenerate the QR in the admin).

### Scaling up — EAS Build (`app/eas.json` ready)
- **Android (free):** `eas build -p android --profile preview` → installable APK.
- **iOS (paid):** Apple Developer account ($99/yr) + TestFlight.
- Needs a free Expo account + `eas login` + `eas init` (writes `extra.eas.projectId`).
> Modern Expo removed `expo publish`; permanent distribution = EAS Build.

---

## Current Status (as of 2026-06-01)

**Backend + admin panel are deployed, live, and verified end-to-end. The mobile
app compiles, type-checks, and bundles clean on SDK 54 but has NOT yet been run
on a physical device — the pilot run is its first real on-device launch.**

### Built & verified live this far
- Invite-gated anonymous participation; participant management (search, detail,
  rename, withdraw).
- **Study groups** — random (balanced) + manual assignment; group in every CSV.
- **Check-in survey** — admin-configurable questions + cadence; participant
  Check-in tab; responses export with dynamic per-question columns + code/group.
- **Per-group hide-tracking** — opt-in; hidden groups get a Check-in/Profile-only
  app; default is the full app.
- **Goals** — graphical builder (6 types), **auto-completion from logging**, plus
  the admin Goal-Progress flag view; feedback still collected on completion.
- Open Library book search; local-date streaks; CSV exports; goal/data/survey
  dashboards.
- **Security hardening** — locked CORS, CSV-injection guard, secret fail-fast.
- Backend refactored into domain route modules; shared web UI components.
- Each feature verified with live end-to-end tests; test data cleaned up.
- 8 Neon migrations applied.

### Next (priority order)
1. **Change the admin password** (still the default).
2. **Device pilot** — `cd app && npx expo start --tunnel`, open in Expo Go (SDK
   54 build), walk the full flow per group (full app + check-in-only). Watch for
   New-Architecture-only quirks and the 5-tab / 2-tab layouts.
3. Generate codes, assign groups, configure the survey, hand QR + codes to testers.
4. When scaling: EAS Build.

### Optional follow-ups noted (not done)
- Informed-consent capture at onboarding (IRB/ethics) and a participant
  data-deletion path (withdrawal/GDPR) — flagged as the next worthwhile features.
- Real rate limiting (needs Upstash/Redis on Vercel).
- Harden the `migrate deploy` advisory-lock flake (Prisma `directUrl`).

---

## Notes
- Use `npm.cmd` (not `npm`) in PowerShell to avoid `.ps1` execution-policy errors.
- `prisma` must be in `dependencies` (the deploy build calls it).
- Apply schema changes with `prisma migrate dev` locally before pushing.
- Genre/pages goal checks only count books logged AFTER those features shipped
  (older logs lack categories/pageCount).
- Reading streak relies on the app sending `localDate` with each log.
- Participants are invite-gated and anonymous; keep the code → real-person master
  list OUTSIDE the app.
- The neighboring `C:\Users\snoww\Do I Want To Know` folder is a SEPARATE project
  (a Gmail "Wrapped" app) — not part of BookTracker.
```
