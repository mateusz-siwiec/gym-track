# Body measurements tab — Plan Brief

> Full plan: `context/changes/body-measurements/plan.md`

## What & Why

A new "Measurements" tab for logging body measurements over time: weight and nine tape measurements. It shows the latest values with the change since the last entry, a trend chart, an editable history and a target weight with progress. Each field has a "how to measure" tooltip, so the numbers are comparable from one entry to the next.

## Starting Point

The app tracks workouts, plans and muscle stats but nothing about the body itself ("bodyweight" in the code only means bodyweight exercises). The pieces to build on exist: a per-user API pattern (`plan` package), a nullable per-user setting (weekly goal), recharts charts with a shared theme, the dashboard window toggle, and a tooltip with the behaviour wanted (but tied to exercises).

## Desired End State

`/measurements` has a log form (date + any of 10 fields, each with an info tooltip in English and Polish), latest-value cards with the change since the previous entry, a chart with a measurement selector and 7/30/90/all window, a history list with edit and delete, and a target weight with progress. Data is per user.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Fields | Weight, waist, chest, hips, and left and right arm, thigh (quads), calf (10 fields, all optional) | Covers the places you asked for, including per-side limbs. | Plan |
| Entry model | One entry per date with nullable columns, several per day allowed | One simple form, table and chart source; matches one measuring session. | Plan |
| Display | Latest cards + trend chart + history list | Answers "where am I and where am I heading" at once. | Plan |
| Units | kg and cm only | Matches the rest of the app, no conversion or setting. | Plan |
| Extras | Target weight (plain difference, no cut/bulk logic); no dashboard card | The goal you asked for without touching the dashboard. | Plan |
| Tooltips | Extract a generic `InfoTooltip` from `TechniqueTooltip`; short text steps (en/pl) | One tested behaviour for both, no copy of tricky positioning code. | Plan |
| Where it computes | Backend stores and serves all entries; windows, deltas and series are computed in the browser | Per-user volume is small; avoids window parameters and extra endpoints. | Plan |
| Date rule | Date only; server allows up to one day ahead of UTC today | A user ahead of UTC logging "today" after local midnight must not be rejected. | Plan |

## Scope

**In scope:** V19 migration, `bodymeasurement` backend package and tests, generic info tooltip, client and data util, `/measurements` page (form, tooltips, cards, history, chart, target weight), en/pl strings, e2e, docs.

**Out of scope:** dashboard card, body fat % and other fields, custom measurement types, notes/photos, imperial units, reminders, import/export, cut-vs-bulk logic, body illustrations.

## Architecture / Approach

Backend: a new package modelled on `plan`, a `body_measurements` table (nullable measurement columns with DB check constraints) and a `users.target_weight_kg` column; CRUD plus a target-weight endpoint. Frontend: a pure util for latest/change/window/series, a form with `InfoTooltip` per field, cards, history, a recharts chart and a target control on one page; the tooltip shell is extracted from `TechniqueTooltip` first so its existing behaviour is guarded by the current e2e specs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend data and API | V19, entity/service/controller, validation, tests | Validation and ownership edge cases |
| 2. Generic info tooltip | `InfoTooltip` extracted, `TechniqueTooltip` as wrapper | Regressing the exercises tooltips |
| 3. Frontend foundations | Client, util + tests, strings, route, nav | Polish text quality and plurals |
| 4. Log and history | Form with tooltips, history, latest cards | Decimal parsing, phone layout |
| 5. Chart and target | Chart with selector/window, target weight | Chart colours and sparse data |
| 6. E2E and docs | Playwright spec, README, test plan, CLAUDE.md | Test data setup |

**Prerequisites:** none; Postgres for backend tests (Testcontainers) and e2e.
**Estimated effort:** ~6-7 sessions across 6 phases.

## Open Risks & Assumptions

- The tooltip extraction touches a working component; the existing e2e specs are the safety net.
- Tooltip texts are written by us; they should be reviewed (a sports-science check is not part of this plan).
- All entries are fetched at once; fine for a few thousand rows, revisit if usage grows.
- Full-weight chart comparison of left and right limbs assumes the user measures both sides the same way.

## Success Criteria (Summary)

- You can log, edit and delete entries, and see latest values, deltas, a trend chart and your progress to a target weight.
- Every field explains how to measure it, in English and Polish.
- Another user's data is never visible, and the exercises tooltips behave exactly as before.
