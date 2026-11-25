# Plan muscle statistics Implementation Plan

## Overview

Show which muscle groups a training plan works, using planned sets. The numbers appear in three places: a live panel in the plan editor, an expandable breakdown per plan on the plans list, and a combined panel for two or more plans ticked on the list (for a weekly split of three plans). Everything is computed in the browser from data the pages already load; there are no backend, API or migration changes.

## Current State Analysis

- Plans: `TrainingPlanController` exposes list/get/create/replace/delete. `GET /api/training-plans/{id}` returns entries with `exerciseId`, `sets`, `reps`/`targetDurationSeconds` (`PlanEntryResponse.java:5`); the list endpoint returns only `exerciseCount` (`PlanSummary`, `client.ts:402`).
- The editor (`PlanEditorPage.tsx`) already loads `getExercises()` (`:46`), and each `Exercise` has `primaryMuscleGroup` and `secondaryMuscleGroups` (`client.ts:145-146`). Entry `sets` is a text field (`PlanEditorEntry.sets: string`), parsed on save by `toTarget` (`:25`).
- `PlansPage.tsx` lists plans with Edit and Delete only. There is no read-only plan view and no selection.
- Logged-set muscle stats: `DashboardService.muscleGroupStats` (`DashboardService.java:178-229`) defines the counting rules, and `MuscleGroupStatsPage.tsx` renders them (parent rows, expandable children, bars, include-secondary checkbox). The parent/group hierarchy is in `utils/muscleGroups.ts` (`MUSCLE_PARENTS`, labels).
- Counting rules to mirror: each set counts as a primary set for the exercise's primary group and as a secondary set for every other secondary group; a parent counts a set at most once as primary and at most once as secondary (even with several secondary muscles in it); a group listed both as primary and secondary counts as primary only.

## Desired End State

- In the plan editor, a "Muscles worked" panel updates as exercises are added, removed or their sets are edited, including unsaved changes.
- On the plans list, each plan row can expand to show that plan's muscle breakdown.
- Each plan row has a checkbox; with two or more ticked, a combined panel shows the summed breakdown across them, naming the included plans.
- All three use one shared breakdown component with the same look and include-secondary checkbox as `/muscle-groups`, and the logged-stats page uses that component too, unchanged in behavior.
- Verify: unit tests for the counting function; existing `muscle-group-stats` e2e still green; new e2e covers editor, row expansion and combined view.

### Key Discoveries:

- No new endpoint is needed: exercise muscle data and plan entries are both already on the client (`client.ts:145`, `PlanEntryResponse.java:5`).
- Counting rules to copy are in `DashboardService.java:196-215`; failure sets do not exist for a plan, so that column is simply absent.
- `MuscleGroupStatsPage.tsx:81-190` holds the rendering to extract; its bars use one shared scale for primary+secondary so toggling never resizes them, and that must be kept.
- `check:tokens` scans an explicit file list (`frontend/scripts/check-hardcoded-values.mjs:9-30`); new component files belong in it.

## What We're NOT Doing

- No backend endpoint, migration or API change.
- No saved "week" grouping of plans and no shareable URL for a selection; the selection lives in page state and resets on reload.
- No new read-only plan page or route.
- No fractional weighting of secondary muscles; secondary sets count in full, like the logged stats.
- No volume, reps, weight or duration weighting: the unit is sets, and a timed exercise counts its sets the same as a reps exercise.
- No changes to the logged-stats numbers or the `/api/dashboard/muscle-groups` response.
- No body-figure (`MuscleMap`) rendering in this change; the display is the same bar list as `/muscle-groups`.

## Implementation Approach

Pure counting logic first (easy to test against the backend's rules), then a shared presentational breakdown extracted from the existing stats page so there is one rendering of this data, then the three surfaces on top. Plan details for the list and combined view are fetched lazily (when a row is expanded or ticked) and cached in page state; the exercise list is fetched once on first need.

## Phase 1: Plan muscle counting function

### Overview

A pure, well-tested function that turns plan entries plus exercise muscle data into per-group and per-parent set counts.

### Changes Required:

#### 1. Counting util

**File**: `frontend/src/utils/planMuscleStats.ts` (new)

**Intent**: Compute muscle stats for any list of planned entries, so the editor (unsaved entries), one saved plan and several plans together all use the same function. Mirrors `DashboardService.muscleGroupStats` rules without failure sets.

**Contract**: `planMuscleStats(entries: { exerciseId: string; sets: number }[], exercises: ReadonlyMap<string, { primaryMuscleGroup: string; secondaryMuscleGroups: string[] }>)` returns `{ totalSets: number; groups: Map<MuscleGroup, { sets; secondarySets }>; parents: Map<MuscleParentKey, { sets; secondarySets }> }`. Rules: entries with a non-integer or less-than-1 `sets`, or whose exercise is not in the map, are skipped; the same exercise appearing twice is summed; secondary groups equal to the primary are ignored; a parent adds `sets` once for the primary and once for the secondary regardless of how many of its groups are secondary; `totalSets` is the sum of counted entries' sets (equals the sum of primary sets).

#### 2. Unit tests

**File**: `frontend/src/utils/planMuscleStats.test.ts` (new)

**Intent**: Pin parity with the backend rules so the two implementations cannot drift silently.

**Contract**: Cases: single exercise primary only; secondary groups counted in full; two secondary groups under one parent count once for that parent; primary also listed as secondary; duplicate exercise entries summed; unknown exercise and invalid sets skipped; empty input gives all zeros and `totalSets` 0. Follow the existing `utils/muscleGroups.test.ts` style.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (from `frontend/`)
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Hand-check one realistic bench-press plan against what `/muscle-groups` shows after logging the same sets

**Implementation Note**: After this phase's automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Shared breakdown component

### Overview

Extract the parent/children bar list from `MuscleGroupStatsPage` into a presentational component that both the logged-stats page and the plan surfaces use.

### Changes Required:

#### 1. Breakdown component

**File**: `frontend/src/components/MuscleBreakdown.tsx` (new)

**Intent**: Render parent rows (expandable into groups), bars and counts from already-normalized numbers, with the include-secondary state owned by the caller. Move the markup, expand/collapse state and bar scaling out of `MuscleGroupStatsPage.tsx:81-190` unchanged in behavior, including `data-parent` / `data-group` attributes, ARIA wiring and the shared primary+secondary scale.

**Contract**: Props: `parents` (key, sets, secondarySets, optional failureSets, children with the same fields) already sorted by the caller or sorted inside, `includeSecondary: boolean`. Failure label renders only when `failureSets > 0`. The expanded set is internal state. `id`s for the child lists must not collide when several breakdowns are on one page (prefix with an `idPrefix` prop).

#### 2. Adapt the logged-stats page

**File**: `frontend/src/pages/MuscleGroupStatsPage.tsx`

**Intent**: Build the normalized data from the API response and render `MuscleBreakdown`; keep window toggle, checkbox, total line and notes in the page.

**Contract**: No change to visible output or to selectors used by `e2e/muscle-group-stats.spec.ts`.

#### 3. Plan-facing wrapper

**File**: `frontend/src/components/PlanMuscleStats.tsx` (new)

**Intent**: Take plan entries plus the exercise map, call `planMuscleStats`, and render the include-secondary checkbox, a total-sets line and `MuscleBreakdown`; show an empty-state line when `totalSets` is 0.

**Contract**: Props: `entries`, `exercises`, `idPrefix`, optional `heading`. Include-secondary state is local, default off.

#### 4. Strings, styles and token guard

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`, `frontend/src/styles/plans.css`, `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Add `plans.muscles.*` strings in both languages (panel title, total sets, empty state, per-plan loading and error, combined heading and "select 2 or more" hint), reuse existing `muscleStats.*` strings for labels and notes where they fit, add new component files to the token guard list, and style only with tokens and existing `.card`/`muscle-*` classes. Any new control gets hover, focus-visible and disabled states.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Build passes: `npm run build`
- Lint passes: `npm run lint`
- Token guard passes: `npm run check:tokens`
- Existing logged-stats e2e still passes: `npm run test:e2e -- muscle-group-stats.spec.ts`

#### Manual Verification:

- `/muscle-groups` looks and behaves exactly as before in both languages (expand, checkbox, windows)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Editor panel

### Overview

Show the live breakdown while creating or editing a plan.

### Changes Required:

#### 1. Editor integration

**File**: `frontend/src/pages/PlanEditorPage.tsx`

**Intent**: Under the exercise list, render `PlanMuscleStats` fed from the current `entries` (parsed with the same strictness as `toTarget`, so a half-typed or blank `sets` is ignored rather than counted) and a map built from the already-loaded `exercises`. Hide the panel when there are no entries.

**Contract**: No change to save payload, validation or navigation. The exercise map is derived with `useMemo` from `exercises`.

### Success Criteria:

#### Automated Verification:

- Build and lint pass: `npm run build`, `npm run lint`
- Token guard passes: `npm run check:tokens`
- Unit tests pass: `npm test`

#### Manual Verification:

- Adding a bench press shows chest, plus front delts and triceps with the secondary checkbox ticked
- Changing sets from 3 to 5 updates the numbers immediately; clearing the field ignores that entry; removing an entry updates the panel
- Editing an existing plan shows its stats on load; works in en and pl; usable at phone width

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Plans list breakdown and combined view

### Overview

Per-plan expandable breakdown on each row, plus checkboxes that feed a combined panel.

### Changes Required:

#### 1. Plan details cache

**File**: `frontend/src/pages/PlansPage.tsx`

**Intent**: Lazily load `getExercises()` once, and `getPlan(id)` for a plan the first time it is expanded or ticked; keep results in state keyed by plan id with per-plan loading/error states so one failed plan does not block the others. Drop a plan from the selection, expansion and cache when it is deleted.

**Contract**: State: `expandedIds`, `selectedIds`, `details: Map<id, { status: 'loading' | 'error' | 'ready'; plan? }>`, `exercises` (null until loaded). Existing list loading, delete confirmation and error handling are untouched.

#### 2. Row UI

**File**: `frontend/src/pages/PlansPage.tsx`, `frontend/src/styles/plans.css`

**Intent**: Add a checkbox per row (labelled with the plan name for assistive tech) and an expand/collapse control that reveals `PlanMuscleStats` for that plan under the row; use a distinct `idPrefix` per plan.

**Contract**: Controls follow existing `btn-secondary` and field patterns with hover, focus-visible and disabled states; buttons are keyboard reachable and expose `aria-expanded`/`aria-controls`.

#### 3. Combined panel

**File**: `frontend/src/pages/PlansPage.tsx`

**Intent**: When two or more plans are ticked, show a "Combined" panel above or below the list that concatenates the selected plans' entries (the util sums duplicates) and renders `PlanMuscleStats` with the names of the included plans. With one ticked plan show a hint that two or more are needed; while any selected plan is still loading show a loading line, and if one fails show an error naming it and still allow deselecting.

**Contract**: Selection resets on reload; no URL state.

### Success Criteria:

#### Automated Verification:

- Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`
- Unit tests pass: `npm test`

#### Manual Verification:

- Expanding a row shows that plan's breakdown; collapsing hides it; deleting an expanded or selected plan removes it cleanly
- Ticking three plans (push/pull/legs) shows the summed breakdown and the three names; unticking one updates it; the sum matches the three individual row breakdowns
- Works with keyboard only, in en and pl, and at phone width

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: E2E coverage and docs

### Overview

Cover the user-visible behavior end to end and document it.

### Changes Required:

#### 1. E2E spec

**File**: `frontend/e2e/plan-muscle-stats.spec.ts` (new)

**Intent**: Using API helpers from `e2e/helpers.ts` to create plans for a fresh user, check: editor panel shows expected parent rows and updates when sets change; a plans-list row expands to the right counts; ticking two plans shows the combined sums; the secondary checkbox adds secondary counts; another user's plans never appear (data isolation is already server-enforced, so one assertion is enough). Reuse the login pattern from `muscle-group-stats.spec.ts`.

**Contract**: Selectors by `data-parent`/`data-group` and accessible names, no visual baselines.

#### 2. Docs

**Files**: `README.md`, `context/foundation/test-plan.md`

**Intent**: One line in the README features table (Plans row) mentioning muscle stats and the combined view; add the counting-parity risk (frontend rules mirror `DashboardService`) to the test plan with the unit and e2e tests that cover it.

### Success Criteria:

#### Automated Verification:

- New e2e passes: `npm run test:e2e -- plan-muscle-stats.spec.ts`
- Full e2e suite passes: `npm run test:e2e`
- Backend unaffected: `./mvnw test`

#### Manual Verification:

- README and test plan read correctly and link nothing stale

---

## Testing Strategy

### Unit Tests:

- `planMuscleStats` parity cases listed in Phase 1, including the once-per-parent rule and primary-also-secondary.

### Integration Tests:

- Playwright flows in Phase 5; existing `muscle-group-stats.spec.ts` as the regression guard for the extracted component.

### Manual Testing Steps:

1. Create a plan with bench press, overhead press and triceps pushdown; read the editor panel with and without secondary.
2. Save three plans (push, pull, legs); tick all three on the list and compare the combined numbers to the sum of each row's breakdown.
3. Log the same sets in a workout and compare `/muscle-groups` totals to the plan breakdown.

## Performance Considerations

Plans are small. The list fetches plan details only on first expand or tick and caches them, so there is no per-row request on page load.

## Migration Notes

None. No schema or API changes.

## References

- Change notes: `context/changes/plan-muscle-stats/change.md`
- Counting rules: `src/main/java/com/example/gymtrack/workout/DashboardService.java:178`
- Rendering to extract: `frontend/src/pages/MuscleGroupStatsPage.tsx:81`
- Related past change: `context/changes/secondary-muscle-stats/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Plan muscle counting function

#### Automated

- [x] 1.1 Unit tests pass: `npm test` (from `frontend/`) — 98f05dd
- [x] 1.2 Type check and build pass: `npm run build` — 98f05dd
- [x] 1.3 Lint passes: `npm run lint` — 98f05dd

#### Manual

- [x] 1.4 Hand-check one realistic bench-press plan against what `/muscle-groups` shows after logging the same sets — 98f05dd

### Phase 2: Shared breakdown component

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 27d21f2
- [x] 2.2 Build passes: `npm run build` — 27d21f2
- [x] 2.3 Lint passes: `npm run lint` — 27d21f2
- [x] 2.4 Token guard passes: `npm run check:tokens` — 27d21f2
- [x] 2.5 Existing logged-stats e2e still passes: `npm run test:e2e -- muscle-group-stats.spec.ts` — 27d21f2

#### Manual

- [x] 2.6 `/muscle-groups` looks and behaves exactly as before in both languages (expand, checkbox, windows) — 27d21f2

### Phase 3: Editor panel

#### Automated

- [x] 3.1 Build and lint pass: `npm run build`, `npm run lint`
- [x] 3.2 Token guard passes: `npm run check:tokens`
- [x] 3.3 Unit tests pass: `npm test`

#### Manual

- [x] 3.4 Adding a bench press shows chest, plus front delts and triceps with the secondary checkbox ticked
- [x] 3.5 Changing sets from 3 to 5 updates the numbers immediately; clearing the field ignores that entry; removing an entry updates the panel
- [x] 3.6 Editing an existing plan shows its stats on load; works in en and pl; usable at phone width

### Phase 4: Plans list breakdown and combined view

#### Automated

- [ ] 4.1 Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`
- [ ] 4.2 Unit tests pass: `npm test`

#### Manual

- [ ] 4.3 Expanding a row shows that plan's breakdown; collapsing hides it; deleting an expanded or selected plan removes it cleanly
- [ ] 4.4 Ticking three plans shows the summed breakdown and the three names; unticking one updates it; the sum matches the three individual row breakdowns
- [ ] 4.5 Works with keyboard only, in en and pl, and at phone width

### Phase 5: E2E coverage and docs

#### Automated

- [ ] 5.1 New e2e passes: `npm run test:e2e -- plan-muscle-stats.spec.ts`
- [ ] 5.2 Full e2e suite passes: `npm run test:e2e`
- [ ] 5.3 Backend unaffected: `./mvnw test`

#### Manual

- [ ] 5.4 README and test plan read correctly and link nothing stale
