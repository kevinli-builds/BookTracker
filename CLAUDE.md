# BookTracker — Claude Context

## Concept
A research reading-tracker app for a marketing PhD study.
Participants log books they read, track streaks and reading time, and receive
goals (self-set or randomly assigned by the researcher). The researcher
("provisioner") has a separate web admin panel to design goals, assign them,
and view aggregated data and feedback.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Mobile app | React Native + Expo SDK 51 |
| Language | TypeScript throughout |
| Backend | Node.js + Express |
| ORM | Prisma v5 |
| Database | PostgreSQL (Neon.tech free tier) |
| Book data | Google Books API (no key needed for basic search) |
| Auth | JWT (provisioner only; users are anonymous device UUIDs) |
| Hosting (backend) | Render.com (free web service) |
| Admin panel | Vite + React (deploy to Vercel, Netlify, or Render static) |
| Secrets | `.env` file (never committed — gitignored) |

---

## Repository Structure

```
BookTracker/
├── backend/
│   ├── src/
│   │   ├── index.ts                Express app setup, route mounting
│   │   ├── lib/
│   │   │   ├── prisma.ts           Prisma client singleton
│   │   │   ├── streak.ts           Streak update logic (called after every log)
│   │   │   └── auth.ts             JWT sign/verify, requireAuth middleware
│   │   └── routes/
│   │       ├── users.ts            POST /users — upsert device user
│   │       ├── books.ts            GET /books/search — proxy Google Books API
│   │       ├── logs.ts             POST /logs, GET /logs/:userId
│   │       ├── goals.ts            GET /goals/templates, POST /goals/self, PATCH /goals/:id/complete|abandon, GET /goals/:userId
│   │       ├── feedback.ts         POST /feedback
│   │       ├── stats.ts            GET /stats/:userId — per-user aggregated stats
│   │       └── admin.ts            POST /admin/login, /register; protected: /users, /goals (CRUD), /assign, /data
│   ├── prisma/
│   │   └── schema.prisma           Models: User, ReadingLog, Streak, GoalTemplate, UserGoal, Feedback, Provisioner
│   ├── package.json
│   └── tsconfig.json
├── app/                            React Native / Expo app
│   ├── App.tsx                     Root: loads userId, upserts user, renders tab navigator
│   ├── app.json                    Expo config (extra.apiUrl)
│   ├── package.json
│   └── src/
│       ├── api/client.ts           Axios instance + all typed API functions
│       ├── lib/userId.ts           Persistent device UUID via expo-secure-store
│       └── screens/
│           ├── HomeScreen.tsx      Stat cards + recent reading log list
│           ├── SearchScreen.tsx    Google Books search + log-a-book flow
│           ├── GoalsScreen.tsx     Active/past goals, add/complete/abandon, feedback modal
│           └── ProfileScreen.tsx   Full stats: totals, streaks, top books, books/month chart
├── web/                            Provisioner admin panel (Vite + React)
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 Auth gate: LoginPage or nav + routes
│       ├── api/client.ts           Axios instance with JWT token management
│       └── pages/
│           ├── Nav.tsx             Top navigation bar
│           ├── LoginPage.tsx       Email/password login
│           ├── DashboardPage.tsx   Summary stats + top books + goal completion rates
│           ├── GoalsPage.tsx       Create/edit/delete goal templates; random assignment
│           ├── UsersPage.tsx       User table with checkboxes; targeted assignment
│           └── DataPage.tsx        Tabbed: feedback viewer | goal outcomes
├── render.yaml                     Render deployment config
└── .gitignore
```

---

## Database Schema

```prisma
User           id (device UUID), displayName, createdAt
ReadingLog     id, userId, googleBooksId, title, author, coverUrl, minutesRead, loggedAt
Streak         userId (PK), currentStreak, longestStreak, lastReadDate
GoalTemplate   id, title, description, type, criteria (JSON), randomPool, createdAt
UserGoal       id, userId, templateId, status (active|completed|abandoned), assignedBy (self|system), assignedAt, completedAt, deadline
Feedback       id, userId, userGoalId, rating (int 1-5), text, createdAt
Provisioner    id, email, passwordHash, createdAt
```

---

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|---|---|---|
| POST | `/users` | Upsert device user |
| GET | `/books/search?q=` | Search Google Books |
| POST | `/logs` | Log a reading session (triggers streak update) |
| GET | `/logs/:userId` | Get all logs for user |
| GET | `/goals/templates` | List all goal templates |
| POST | `/goals/self` | User picks a goal |
| GET | `/goals/:userId` | Get user's goals |
| PATCH | `/goals/:goalId/complete` | Mark goal complete |
| PATCH | `/goals/:goalId/abandon` | Abandon goal |
| POST | `/feedback` | Submit feedback on a goal |
| GET | `/stats/:userId` | Aggregated stats for user |
| GET | `/health` | `{ok: true}` |

### Admin (JWT required)
| Method | Path | Description |
|---|---|---|
| POST | `/admin/login` | Get JWT |
| POST | `/admin/register` | Create provisioner account (requires SETUP_KEY) |
| GET | `/admin/users` | All users with counts |
| GET | `/admin/goals` | All goal templates with assignment counts |
| POST | `/admin/goals` | Create goal template |
| PATCH | `/admin/goals/:id` | Update template |
| DELETE | `/admin/goals/:id` | Delete template |
| POST | `/admin/assign` | Randomly assign pool goals to all/selected users |
| GET | `/admin/data` | Aggregate research data + feedback |

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...     # Neon.tech connection string
JWT_SECRET=...                    # Long random string for JWT signing
SETUP_KEY=...                     # One-time secret to create provisioner account
GOOGLE_BOOKS_API_KEY=...          # Optional — works without it, just rate-limited
PORT=3000
```

### Web (`web/.env`)
```
VITE_API_URL=http://localhost:3000   # Change to Render URL after deploy
```

### App (`app/app.json` → `extra.apiUrl`)
Change to the live Render URL after deploying.

---

## Running Locally

```bash
# Backend
cd backend
npm install --ignore-scripts
# create backend/.env with vars above
npm run dev

# Web admin (separate terminal)
cd web
npm install
# create web/.env with VITE_API_URL=http://localhost:3000
npm run dev
# Opens at http://localhost:5173

# App (separate terminal)
cd app
npm install --ignore-scripts
# Update app.json extra.apiUrl to http://<local-ip>:3000
npm start
# Scan QR with Expo Go
```

---

## First-time Provisioner Setup

After the backend is running:
```bash
curl -X POST http://localhost:3000/admin/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"...","setupKey":"<SETUP_KEY from .env>"}'
```
Then log in via the web admin panel at `http://localhost:5173`.

---

## Deployment

1. **Neon.tech** — create free PostgreSQL project, copy connection string
2. **Render.com** — new web service → this repo → set env vars (`DATABASE_URL`, `JWT_SECRET`, `SETUP_KEY`, optionally `GOOGLE_BOOKS_API_KEY`)
3. **Web admin** — deploy `/web` to Vercel/Netlify as a static site; set `VITE_API_URL` to the Render URL at build time
4. **App** — update `app/app.json` `extra.apiUrl` to Render URL; build with EAS or run via Expo Go for testing

> Note: the live backend is on **Vercel** (`https://book-tracker-api.vercel.app`),
> not Render, and the admin panel is at `https://book-tracker-admin.vercel.app`.
> `app/app.json` `extra.apiUrl` already points at the Vercel backend.

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

## Current Status (as of May 2026)

**Full scaffold written. TypeScript should compile clean. Not yet run end-to-end.**

### Done
- Complete backend: all routes, streak logic, JWT auth, random goal assignment
- Mobile app: 4-screen tab navigator (Home, Search, Goals, Profile)
- Web admin: Login, Dashboard, Goals manager, Users table with targeted assignment, Data/feedback viewer
- Prisma schema + render.yaml

### Next session
1. `cd backend && npm install --ignore-scripts` — install deps, run `npx prisma generate`
2. Create `backend/.env` with a local Neon/Postgres URL
3. `npm run dev` — verify server starts
4. Create provisioner account via `/admin/register`
5. `cd web && npm install && npm run dev` — test admin panel in browser
6. `cd app && npm install --ignore-scripts && npm start` — test on device

---

## Notes
- Use `npm.cmd` (not `npm`) in PowerShell to avoid `.ps1` execution policy errors
- Use `npm install --ignore-scripts` in the app to avoid native build failures in Expo
- The `prisma` package must be in `dependencies` (not devDependencies) — `start:prod` calls it
- Google Books API works without a key but is rate-limited; add a key in production
- Goal `criteria` is a freeform JSON field — examples: `{"count":5}` (books_count), `{"minutes":300}` (minutes), `{"genre":"Science Fiction"}` (genre)
