# Plan muscle statistics — Plan Brief

> Full plan: `context/changes/plan-muscle-stats/plan.md`

## What & Why

Show which muscle groups a training plan works, based on planned sets. You want to see it while building a plan and when looking at plans, and to tick your three weekly plans and see the muscle balance of the whole week together.

## Starting Point

Muscle stats exist only for logged workouts (`/muscle-groups`). Plans show just a name and exercise count; the editor has no preview and the plans list can only edit or delete. The client already holds everything needed: each exercise's primary/secondary muscles and each plan entry's set count.

## Desired End State

A live "muscles worked" panel in the plan editor, an expandable breakdown on every plan row, and a combined panel when two or more plans are ticked. All use the same bar list as `/muscle-groups`, with the same include-secondary checkbox.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where to compute | In the browser, no backend change | Gives a live preview of unsaved edits and needs no endpoint | Plan |
| Where to show | Editor panel + expandable list rows | Covers "creating" and "showing" without a new page | Plan |
| Secondary muscles | Same as logged stats: full count, checkbox, once per parent | Planned and logged numbers compare directly | Plan |
| Combining plans | Checkboxes on the plans list, combined panel at 2+ | Quick toggling, no new route or storage | Plan |
| Unit | Sets only; timed exercises count their sets too | Matches logged stats; no volume weighting | Plan |
| Shared UI | Extract the bar list from the stats page into one component | One rendering, no copy-paste | Plan |

## Scope

**In scope:** counting util with parity tests, shared breakdown component, editor panel, per-row breakdown, combined view, en/pl strings, e2e, docs.

**Out of scope:** backend/API changes, saved weekly groups or URL-shared selections, a read-only plan page, fractional secondary weights, body-figure display, volume weighting.

## Architecture / Approach

A pure `planMuscleStats(entries, exercises)` function mirrors the `DashboardService` counting rules. A `MuscleBreakdown` component, extracted from `MuscleGroupStatsPage`, renders the result; `PlanMuscleStats` wraps both. The editor feeds it current entries. The plans list loads exercises once and plan details lazily on expand or tick, caching them.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Counting function | Util + unit tests | Drift from backend rules |
| 2. Shared component | `MuscleBreakdown`, `PlanMuscleStats`, strings | Regressing `/muscle-groups` during extraction |
| 3. Editor panel | Live panel in the plan editor | Half-typed set counts |
| 4. List + combined view | Row breakdowns, checkboxes, combined panel | Per-plan loading, error and delete states |
| 5. E2E + docs | Playwright spec, README, test plan | Test data setup |

**Prerequisites:** none; Postgres for e2e.
**Estimated effort:** ~3-4 sessions across 5 phases.

## Open Risks & Assumptions

- The counting rules live in two places (TS and Java); unit tests pin them but do not link them.
- Full-weight secondary counts can overstate indirect work, as on the existing page.
- Combined selection resets on reload by design.

## Success Criteria (Summary)

- Building or opening a plan shows its muscle breakdown immediately.
- Ticking the three weekly plans shows one combined breakdown equal to the sum of the three.
- `/muscle-groups` is unchanged and all tests pass.
