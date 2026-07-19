# BookTracker — Product / Design / Engineering Brief

_Written 2026-07-03 by a Claude portfolio review session. Audience: a future Opus
session. Read `CLAUDE.md` first. BookTracker is a **research instrument** (PhD
study on tracking behavior), not a growth product — so "drawing users" means
serving the researcher and keeping participants compliant, not virality.
Verify current state before implementing._

---

## 0. Status ledger (2026-07-05) + how to pick up

**Status: FROZEN during the study.** Schema changes mid-study corrupt the dataset — do NOT ship participant-facing changes while data collection is live. (The default admin password is a known open item the user is handling separately — do not block on it.)
**R6 analysis-bundle export SHIPPED (2026-07-18, admin-only)** — Data page "Analysis
bundle" card → one click builds a zip: 8 tidy CSVs (participants, reading_logs, goals
incl. abandoned w/ criteria_met, goal_templates, feedback, survey_questions, check-ins
long + wide), `codebook.md` (every column + coding decisions: local-date streaks,
categories/pageCount era caveats, auto-completion, prompt-editability), and
`study_config.json` snapshot. New admin-only `GET /admin/bundle` (behind `requireAuth`;
the per-page endpoints truncate — /data caps feedback at 50, /goal-progress drops
abandoned) + pure `web/src/lib/analysisBundle.ts` (11 fixture tests; jszip client-side
zip). Zero participant surface, zero schema. Also: `npm audit fix` in web/ (axios
form-data + react-router advisories; prod deps now 0 vulns; remaining esbuild/vite one
is dev-server-only, needs a breaking Vite major — skipped).
**R7 power calculator SHIPPED (2026-07-11)** — admin `/power` page over pure `web/src/lib/power.ts` (two-proportion Fleiss uncorrected + continuity-corrected, two-mean via Cohen's d, Acklam normal quantile; 9 tests against canonical table values; vitest now wired in `web/` — `npm test`).
**Post-study v2 backlog (in order)** — §5 R1 configurable tracked-activity ⭐ + R2 study-phases ⭐ (these two are also the in-place path to the StudyKit product idea in `PROJECT_IDEAS.md`), then R3–R5. **Architecture doc: `STUDYKIT_V2.md` (2026-07-11)** — fork-vs-in-place verdict (in-place after `study-1-final` tag), additive schemas, goal-criteria generalization, phase resolution rules, build order (R2 → R1 → R6).
**Before any feature** — the device pilot (P1) still has not run on a physical phone.
**Usability audit (2026-07-12, NOTES ONLY — study frozen, no code changed)** —
participant RN app: no positioning/touch hazards found; check-ins are immutable **by
design** (data integrity) — for StudyKit v2 consider a short (~5 min) undo window for
fat-finger submissions; goals already have Abandon. **Admin-table follow-up SHIPPED
(2026-07-13, admin-only)** — all 9 admin tables (Dashboard, Data×3, Invites,
Participants, ParticipantDetail inner×2) wrapped in a shared `TableScroll`
(`overflowX:auto`, `ui.tsx`) so the panel is usable on a phone; desktop unchanged;
zero participant-surface changes.

## 1. Product roadmap (PM)

### P0 — Change the default admin password
Still the setup default per CLAUDE.md (`admin@booktracker.com`). This is a live,
internet-facing admin panel over participant data. Not a coding task — the user
does it via the admin panel's "Change password" button — but any Opus session in
this repo should refuse to build features until this is confirmed done.

### P1 — Device pilot (the documented next step)
`cd app && npx expo start --tunnel`, walk the full flow per study group (5-tab
full app and 2-tab check-in-only app) on a physical phone. The app has never run
on-device; assume New-Architecture quirks will surface. Fix what breaks; nothing
else ships before the pilot passes.

### P1 — Informed consent + data deletion (IRB requirements, already flagged)
**Instructions for Opus:**
- Consent: a consent screen after invite-code redemption (configurable text in a
  new `StudyConfig` field; store `consentedAt` on `User`; block the app until
  accepted; include consent status/date in CSV exports).
- Deletion: participant-initiated withdrawal in Profile ("withdraw and delete my
  data") → sets status withdrawn + hard-deletes logs/goals/surveys/feedback (or
  anonymizes, per the researcher's IRB protocol — ask before implementing), plus
  an admin-side delete on the participant detail modal.

### P2 — Reminder push for check-ins
Survey compliance decays fast. Expo Notifications local reminders scheduled from
`nextDueAt` (no backend push infra needed). This is the single best lever for
study data quality.

### P3 — Rate limiting via Upstash (documented as needing an external store on
Vercel) — worth it only if the study scales past friends-and-family size.

---

## 2. Design audit

1. **Participant app**: the invite-code → name → tabs gate is clean. Check-in
   compliance UX matters most: the Check-in tab should show due state on the tab
   badge itself, not only inside the screen.
2. **Admin panel** is utilitarian (fine for one researcher). The Invites page
   with QR + run-it-yourself instructions is genuinely good. Two cheap wins:
   participant table row-count/filters persistence, and a "study health"
   dashboard tile (check-in compliance % per group) on DashboardPage — that's
   the number the researcher actually watches.
3. Keep the control group's 2-tab app visually indistinguishable in polish from
   the full app (experimental validity — no "degraded feeling" confound).

---

## 3. Engineering audit

Documented posture is solid (Prisma parameterized, locked CORS, CSV formula-
injection guard, JWT fail-fast, bcrypt(12), 0 prod dep vulns). Remaining:
1. **Default admin password** (see P0) — the one real hole.
2. Participant endpoints are unauthenticated by design (122-bit device UUID as
   key, own-data-scoped) — an accepted tradeoff that's fine for anonymous
   research data; re-verify no endpoint returns another user's rows if handed a
   foreign UUID (spot-check `logs.ts`, `goals.ts`, `stats.ts`, `surveys.ts`).
3. `migrate deploy` P1002 advisory-lock flake on Neon pooled endpoint —
   documented; fix properly with Prisma `directUrl` for migrations.
4. No refactor needed: routes are already split by domain, shared Prisma select
   fragments exist, asyncHandler pattern is consistent. Keep it frozen during
   the study — schema changes mid-study complicate the dataset.

---

## 4. Surprise & delight (unbuilt ideas — with a research warning)

**⚠️ Confound warning first:** this is a study instrument. Delight features
change participant behavior — which is the *dependent variable*. Nothing below
ships mid-study, and anything participant-visible must either go to ALL groups
identically or be deliberately configured per-group as part of the design.
When in doubt, ask the researcher.

### D1 — End-of-study "Reading Passport" (safe: after data collection)
When the study closes, the researcher generates a personal thank-you artifact
per participant from the admin panel: a passport-styled recap — books logged,
pages, longest streak, genres visited (as "stamps") — exportable as an image or
PDF to send with the debrief. Costs nothing scientifically (data collection is
over), rewards participants, and makes the next study easier to recruit for.
Implementation: admin-panel render from existing per-user stats; no app change.

### D2 — Check-in thank-you moment (safe-ish: identical across groups)
After submitting a check-in, a small consistent acknowledgment ("That's 6 of 6
check-ins — thank you, this is what makes the study work"). Compliance is the
study's lifeblood and gratitude is the cheapest compliance lever; identical
copy across groups keeps it clean. Run it past the researcher anyway.

### D3 — Researcher delight: "study health" pulse (admin-only, always safe)
The admin dashboard gets a tiny sparkline strip — daily check-in compliance %,
logs/day, active participants — so the researcher opens the panel to a
heartbeat instead of tables. Admin-only, zero participant impact.

## 5. Depth roadmap — flexible study options (2026-07-05)

_Direction change from the user: deepen the research instrument. ⚠️ The
schema-freeze rule (section 3) still governs: NOTHING here ships mid-study.
This is the v2 backlog for after the current pilot/study concludes — it is
also the in-place path to the StudyKit idea in PROJECT_IDEAS.md._

### R1 — Configurable tracked activity (L) ⭐ (the flexibility unlock)
Replace hard-coded "books" with an admin-defined activity schema: name,
unit, per-log fields (search-a-catalog / free text / number / duration).
Borrow Tracker's type vocabulary (yesno/count/measure/series). Every other
feature (goals, streaks, exports) reads the definition. This one change
makes the platform reusable for any tracking study.

### R2 — Study phases (L) ⭐
A phase timeline per study: baseline → intervention → washout, with dates
and PER-PHASE app configuration (hide/show tracking per phase x group —
generalizes the current per-group hide). Auto-switch on dates; phase rides
along in every export row. Unlocks within-subject designs, which most
under-resourced researchers actually run.

### R3 — Randomization upgrades (M)
Stratified assignment (balance groups on a baseline variable), blocked
randomization, and a logged seed so any assignment is reproducible for the
methods section. Extends the existing balanced-random endpoint.

### R4 — Survey engine v2 (M)
Branching questions, per-group/per-phase questionnaires, Likert battery
presets with randomized item order, and versioning (edits mid-study create
a new version; responses record which version they answered — audit-safe).

### R5 — Compliance & retention analytics (M)
Admin dashboard: per-participant adherence curve, cohort dropout curve,
automated at-risk flags (2 missed check-ins), configurable reminder
escalation. The researcher watches THIS number daily; today it needs manual
CSV work.

### R6 — Analysis bundle export (S) ⭐ (cheap, beloved)
One click → zip of tidy CSVs + `codebook.md` documenting every column,
type, and coding decision, + a study-config snapshot. Codebooks are the
difference between "data" and "dataset" for a researcher.

### R7 — Power calculator (S, delight-tier for researchers)
In the admin: effect size + alpha + power → required n per group (two-
proportion + two-mean cases). Pure function + tests; it earns trust that
the tool understands research.

### R8 — Consent versioning + admin audit log (M, governance)
Consent text versions with participant-version linkage; append-only log of
admin config changes during a study. Both exist to defend the dataset in
review.

### Sequencing: R6 + R7 are safe ANYTIME (admin-only, no participant
surface). R3/R4/R5 next; R1 + R2 are the v2 core and pair naturally with
the StudyKit fork decision.

---

## Security & code-quality audit (2026-07-12, Fable portfolio pass)

_Repo is PUBLIC and the study is FROZEN — this pass changed no code. The
code-security posture is genuinely good (see CLAUDE.md "Security posture" — all
verified this pass: Prisma-parameterized, CORS locked, CSV-injection guarded,
secret fail-fast, bcrypt(12), and the admin public→`requireAuth`→protected boundary
is correctly ordered). Sensitive/operational items are tracked privately in
`C:\Users\snoww\PORTFOLIO_SECURITY_AUDIT.md` (B1–B3). Non-sensitive summary:_

- **⚠️ Top action, no code needed: change the default admin password now.** The
  admin panel guards the whole participant dataset; the account email is public (in
  CLAUDE.md), login isn't rate-limited, and CLAUDE.md says the password is still the
  setup default. That combination is the one thing that shouldn't wait for the study
  to unfreeze. Detail in the private doc (B1).
- **Admin JWT model is fine** — `requireAuth` is header-based, so the `router.use`
  ordering pitfall that bit DIWTK does NOT apply here. No admin IDOR.
- **Participant UUID-as-URL-credential** is a documented, accepted tradeoff (no
  cross-participant escalation), but the UUID rides in the path → Vercel logs. Treat
  as a data-governance note in the study's data-management plan, not a code fix
  (B2). **Do not change participant routes mid-study.**
- **For StudyKit v2 (the unfrozen successor):** fold in informed-consent capture +
  a participant data-deletion/withdrawal path (IRB items, already on the optional
  list — they pair with R1/R2), add DB-backed login throttling, and close the
  login timing/enumeration oracle (compare against a dummy hash on unknown email).
- No automated tests on the backend; the goal-auto-completion criteria engine
  (`lib/goalProgress.ts`) is the highest-value place for fixture tests in a rebuild
  (it's the logic the study's outcomes depend on).
