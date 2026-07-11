# StudyKit v2 — Architecture for R1 (configurable activity) + R2 (study phases)

_Written 2026-07-11 by the Fable session. This is the design doc the brief's §5
calls for — the v2 core that turns BookTracker into StudyKit (`PROJECT_IDEAS.md`
idea #2). NOTHING here ships mid-study; it is the post-freeze blueprint. Audience:
the Opus session that builds it after the current study closes._

---

## 0. Fork vs in-place (the decision PROJECT_IDEAS left open)

**Recommendation: in-place, after the study closes.** The admin panel, invites,
groups, survey engine, and export machinery are 90% of StudyKit and already live
here; a fork doubles maintenance from day one. The study's integrity is protected
by process, not repo separation:

1. When data collection ends: run the final exports, archive them, and tag
   `study-1-final` — the reproducible snapshot any methods section can cite.
2. Only then do v2 migrations land. Migrations are additive (below); the
   study-1 rows remain queryable forever.

Fork only if a *second concurrent study* materializes before study 1 closes.

## 1. R1 — Configurable tracked activity

### What is actually book-specific today
`ReadingLog` columns (googleBooksId/title/author/coverUrl/categories/pageCount/
minutesRead), the Open Library search route, four of six goal-criteria types,
`SearchScreen`, and the stat cards. Everything else — invites, groups, streaks,
check-ins, exports — is already activity-agnostic.

### New model (additive; ReadingLog stays for study-1 data)

```prisma
model ActivityConfig {            // singleton "default" (per-study later)
  id        String @id @default("default")
  name      String                // "Reading" / "Meals" / "Screen time"
  logNoun   String                // "book" / "meal" / "session" — drives all UI copy
  catalog   String @default("none") // 'openlibrary' | 'none' (free entry)
  fields    Json                  // LogFieldDef[] — see below
}

model ActivityLog {               // the generalized ReadingLog
  id        String   @id @default(cuid())
  userId    String
  values    Json                  // { [fieldId]: string | number | boolean }
  localDate String                // participant-local date (streaks rule, unchanged)
  loggedAt  DateTime @default(now())
}
```

```ts
interface LogFieldDef {
  id: string          // stable key — becomes the CSV column name
  label: string
  kind: 'catalogItem' | 'text' | 'number' | 'duration' | 'yesno' | 'select'
  required: boolean
  unit?: string       // number/duration display ("pages", "min")
  options?: string[]  // select
}
```

This is Tracker's type vocabulary (yesno/count/measure/series) wearing research
clothes — the convergence the brief predicted. BookTracker's current shape is
just one config: `catalogItem(book, openlibrary) + number(pageCount) +
duration(minutesRead)`.

### Rules that keep it sane
- **Validation at the write.** `POST /logs` validates `values` against the field
  defs (kind, required, options) server-side — a Json column with no gate is how
  datasets rot. One pure `validateLogValues(fields, values)` helper + tests.
- **Field defs are append-only once any log exists.** Editing a field's kind
  mid-study corrupts the column; the admin UI allows adding fields and editing
  labels, never retyping or deleting. (Same instinct as `categoryLocked` in
  DIWTK and survey versioning in R4.)
- **Goals generalize by referencing fieldIds**, replacing the four book types:
  `{type:'logCount', target}` (was books_count) · `{type:'fieldSum', fieldId,
  target}` (was pages/minutes) · `{type:'fieldMatch', fieldId, value}` (was
  author/genre) · `{type:'catalogItem', itemId}` (was specific_book). `custom`
  stays manual. `goalProgress.ts` becomes a pure interpreter over these — its
  tests are the heart of the migration.
- **Exports flatten `values`** into one CSV column per fieldId, in field order,
  formula-injection-guarded like everything else. The codebook (R6) writes
  itself from the field defs — build R6 *after* R1 and it inherits this.
- **Catalog is a seam, not a plugin system.** `catalog: 'openlibrary'` keeps the
  existing search route; `'none'` renders a free-text/number form. Do not build
  a general catalog interface for a second catalog nobody has asked for.

## 2. R2 — Study phases

### Model (additive)

```prisma
model StudyPhase {
  id        String  @id @default(cuid())
  name      String              // "baseline" / "intervention" / "washout"
  startsAt  String              // 'YYYY-MM-DD', participant-LOCAL semantics
  endsAt    String?             // null = open-ended final phase
  sortOrder Int
}

model PhaseGroupConfig {        // per-phase × per-group app experience
  id           String  @id @default(cuid())
  phaseId      String
  group        String           // studyGroup name, or '*' default
  hideTracking Boolean @default(false)
  @@unique([phaseId, group])
}
```

- **Resolution:** the phase for a request is chosen by the participant's LOCAL
  date (same rule as streaks — a 11:30pm participant is still in their own
  today). `/users` resolves `hideTracking` as: exact (phase, group) row → the
  phase's `'*'` row → the legacy global `StudyConfig` → false. The existing
  per-group hide becomes one degenerate case (a single open-ended phase).
- **Auto-switch is pure date comparison** — no cron, no job, nothing to wake.
- **Phases are non-overlapping and ordered**; the admin timeline editor
  validates gaps/overlaps at save. A gap means "no phase": fall back to legacy
  behavior and warn loudly in the admin.
- **Exports:** every row gains a `phase` column, *computed at export time* from
  the row's date against the timeline. Recomputing (rather than storing) keeps
  rows consistent if a typo'd phase date is corrected; defensibility comes from
  R8's append-only config audit log, which should land WITH R2 (a phase edit
  mid-study is exactly what a reviewer will ask about).
- **Within-subject designs fall out:** baseline (hide all) → intervention
  (show for group A) → washout (hide all) is just three rows per group.

## 3. Build order & test strategy

1. **R2 first** — it touches no log schema, generalizes an existing mechanism
   (hide-tracking), and is independently shippable. Pure helpers:
   `phaseForDate(phases, localDate)`, `resolveHideTracking(...)` — vitest both.
2. **R1 second** — schema + validation + goal interpreter + the app's dynamic
   log form (the one genuinely new UI). Port `goalProgress.ts` tests first;
   they define the contract.
3. **R6 analysis bundle last** — it consumes both (phase column, field-driven
   codebook) and becomes dramatically better for waiting.

Vitest now exists in `web/` (landed with the R7 power calculator); backend gets
the same treatment when R2's helpers land.

## 4. Risks, honestly

- **Json columns tempt laziness** — the write-side validator and append-only
  field rule are load-bearing, not optional.
- **Dynamic forms are where the app can get ugly** — keep field kinds few and
  boring; resist per-field conditional logic (that's R4's survey branching,
  a different feature).
- **Phase semantics vs timezones** — participant-local everywhere or the
  dataset develops midnight seams; never mix server-now into phase resolution.
- **Scope**: R1+R2 as specced here deliberately exclude multi-study tenancy.
  StudyKit-the-product needs it; StudyKit-the-v2 doesn't. Singleton configs
  now, `studyId` columns when a real second study exists.
