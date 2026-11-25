# Body measurements tab Implementation Plan

## Overview

Add a "Measurements" tab where a user logs body measurements over time: weight and nine tape measurements (waist, chest, hips, and left and right arm, thigh and calf). The tab shows the latest values with the change since the previous entry, a trend chart per measurement, and an editable history. The user can also set a target weight and see how far they are from it. Each field has a "how to measure" tooltip with short text steps in English and Polish. The work adds one Flyway migration (V19), a new `bodymeasurement` backend package and a new page; the existing dashboard and workout flows are untouched.

## Current State Analysis

- Nothing exists for body measurements. "Bodyweight" in the code only means bodyweight exercises (`WeightMode`, change `bodyweight-and-timed-sets`).
- Navigation: `frontend/src/components/Topbar.tsx` renders `NavLink`s and a `titleKey(pathname)` map; routes live in `frontend/src/App.tsx` (each wrapped as a protected route).
- Backend pattern for per-user data: package `com.example.gymtrack.plan` (`TrainingPlanController` with `@AuthenticationPrincipal CurrentUser`, service doing ownership lookups, `PlanNotFoundException`, request records with Bean Validation, `InvalidFieldException(message, field, code)`); all `/api/**` except health/auth is authenticated (`SecurityConfig.java:45-49`). Error codes live in `common/ErrorCode.java`.
- A per-user single value already exists: `users.weekly_goal` (migration V9), set through `PUT /api/dashboard/weekly-goal` with a `{ weeklyGoal: n | null }` body (`DashboardController.java:43`, `client.ts:392`). Target weight copies this shape.
- Migrations: latest is `V18`, so the next is `V19` (CLAUDE.md says "next is V16", which is stale). Flyway owns the schema and Hibernate only validates it; applied migrations must never be edited.
- Charts: recharts with `chartTheme.ts` (`ProgressionChart.tsx`, `WeeklyVolumeChart.tsx`); the dashboard has a 7/30/90/all window toggle.
- Tooltip: `frontend/src/components/TechniqueTooltip.tsx` has the behaviour wanted (hover/keyboard-focus open, click/tap toggle, Escape, outside click, viewport-aware placement, phone bottom sheet) but is coupled to `Exercise` and `MuscleMap`. Its styles are the `technique-*` classes in `styles/page.css` and its behaviour is covered by e2e specs (`technique-tooltip.spec.ts`, `exercises-list.spec.ts`).
- UI conventions (CLAUDE.md): design tokens only, no literal colours/radii/arbitrary values, hover/focus-visible/disabled on every control, shared classes in `page.css`, `npm run check:tokens` scans an explicit file list.

## Desired End State

- A "Measurements" nav link opens `/measurements`: a form to log an entry (date defaulting to today, any of the 10 fields filled), "latest values" cards with the change since the previous entry per field, a trend chart with a measurement selector and a 7/30/90/all window, the history list with edit and delete (with confirmation), and a target weight control with progress.
- Each form field has an info button whose tooltip explains how to measure it properly (en and pl), usable by hover, keyboard, and tap.
- Data is per user; another user's entries are never visible or editable.
- Verify: backend tests for CRUD, validation, ownership and the schema; frontend unit tests for the data util; e2e covering log/edit/delete, chart, target, tooltip, isolation and phone layout; existing exercises-tooltip e2e still green after the extraction.

### Key Discoveries:

- `PlanEditorPage`/`PlansPage` show the project's patterns for list + edit + delete-with-confirmation and for the error translation (`translateError`); reuse them.
- `DashboardController.java:43` and `client.ts:392` are the template for the nullable single-value setting.
- `chartTheme.ts` and `index.css` own chart colours; a second series colour may need a token (light and dark).
- Time zones: a user ahead of UTC logging "today" shortly after local midnight has a local date one day after the server's UTC date, so a strict "not in the future" check would reject valid entries.

## What We're NOT Doing

- No dashboard card or any dashboard change (explicit decision).
- No body fat %, neck, shoulders, forearm, abdomen or other fields; no user-defined measurement types; no per-entry notes or photos.
- No unit setting: kg and cm only, no imperial conversion.
- No saved weekly grouping or comparison across periods, reminders, import/export.
- No cut-versus-bulk logic for the target: progress is a plain difference to the target weight.
- No body illustration in tooltips (text steps only).
- No change to the muscle-group stats or to workout/plan behaviour; the technique tooltips must behave exactly as before.

## Implementation Approach

Backend first so the UI is built against a tested API. Then extract the generic tooltip shell (a regression-sensitive refactor) before anything depends on it. Then the frontend foundations (client, pure data util, strings, route and nav), the page with form and history, and finally the chart and target weight. E2E and docs close the change. Charts, windows and deltas are computed in the browser from the full entry list (per-user volume is small), which avoids window parameters and extra endpoints.

## Critical Implementation Details

- **Date rule:** `measuredOn` is a calendar date, not a timestamp. The server rejects a date more than one day after today's UTC date (time-zone tolerance) and before 1950-01-01; the browser date picker caps at the user's local today.
- **Decimal input:** Polish users type a comma ("72,5"). The form must accept both "." and "," and the display must use the active language's number format; values go to the API as plain numbers.
- **Tooltip refactor safety:** keep every `technique-*` class name, `data-open` / `data-placement` attribute and ARIA wiring unchanged so CSS and the existing e2e selectors keep working.

## Phase 1: Backend data and API

### Overview

Store entries and the target weight and expose them through a per-user REST API, with validation and tests.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V19__create_body_measurements.sql` (new)

**Intent**: Create the entries table and the per-user target weight column.

**Contract**: Table `body_measurements`: `id uuid pk`, `user_id uuid not null references users(id)`, `measured_on date not null`, `weight_kg numeric(5,2)`, nine `numeric(4,1)` centimetre columns (`waist_cm`, `chest_cm`, `hips_cm`, `arm_left_cm`, `arm_right_cm`, `thigh_left_cm`, `thigh_right_cm`, `calf_left_cm`, `calf_right_cm`), `created_at` and `updated_at` timestamptz not null; check constraints for ranges (weight 20-500, each tape value 5-300) and "at least one measurement is not null"; index on `(user_id, measured_on desc, created_at desc)`. `alter table users add column target_weight_kg numeric(5,2)` with a check 20-500 when not null. Follow the style of V5 and V9.

#### 2. Domain, repository, service

**Files**: `src/main/java/com/example/gymtrack/bodymeasurement/` (new package: `BodyMeasurement`, `BodyMeasurementRepository`, `BodyMeasurementService`, `BodyMeasurementNotFoundException`), `user/User.java`

**Intent**: Entity with nullable `BigDecimal` fields mapped to the columns, owned by a user id; service with list (newest first by `measuredOn`, then `createdAt`), create, replace (full update of all fields, so clearing a field is possible) and delete, all scoped by user id and throwing not-found for another user's entry; `User` gets `targetWeightKg` with the same set/clear pattern as `weeklyGoal`.

**Contract**: Ownership via `findByIdAndUserId`, same style as `TrainingPlanService.findOwned`; the "at least one value" and date rules are enforced in the service via `InvalidFieldException` (field + code) in addition to the DB check.

#### 3. Controller, request and response records, error codes

**Files**: `bodymeasurement/BodyMeasurementController`, `BodyMeasurementRequest`, `BodyMeasurementResponse`, `BodyMeasurementsResponse`, `common/ErrorCode.java`

**Intent**: Expose the API and keep errors in the project's `{ error, code }` shape.

**Contract**: `GET /api/body-measurements` returns `{ targetWeightKg: number | null, entries: [...] }` (all entries, newest first); `POST /api/body-measurements` returns 201 with the entry; `PUT /api/body-measurements/{id}` replaces it; `DELETE /api/body-measurements/{id}` returns 204; `PUT /api/body-measurements/target-weight` takes `{ targetWeightKg: number | null }` (required key, 20-500 or null) and returns the stored value. Entry JSON fields: `id`, `measuredOn` (ISO date), `weightKg`, `waistCm`, `chestCm`, `hipsCm`, `armLeftCm`, `armRightCm`, `thighLeftCm`, `thighRightCm`, `calfLeftCm`, `calfRightCm`, `createdAt`, `updatedAt` (numbers or null). New codes `BODY_MEASUREMENT_NOT_FOUND`, `INVALID_TARGET_WEIGHT`; range violations and "no values" use the existing validation error shape.

#### 4. Backend tests

**Files**: `src/test/java/com/example/gymtrack/bodymeasurement/` (new: controller test, schema test), following `TrainingPlanControllerTest` / `TrainingPlanSchemaTest` style

**Intent**: Pin the behaviour and the DB constraints.

**Contract**: Cases: create/list ordering (same date ordered by creation), update clears a field, delete, 401 without a token, another user's entry gives 404 on PUT/DELETE and never appears in GET, "no values" rejected, each range boundary (min, max, just outside), date one day ahead accepted and two days ahead rejected, target weight set/clear/invalid, schema constraints reject out-of-range and all-null rows directly.

### Success Criteria:

#### Automated Verification:

- Migration applies and new backend tests pass: `./mvnw test -Dtest='BodyMeasurement*'`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Against the local backend (`local` profile), create, edit and delete an entry and set and clear a target weight with curl or a REST client, and confirm another user's entry id returns 404

**Implementation Note**: After this phase's automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Generic info tooltip

### Overview

Extract the reusable open/close, positioning and phone bottom-sheet behaviour out of `TechniqueTooltip` so measurement fields can use it, without changing how the exercise tooltips behave.

### Changes Required:

#### 1. InfoTooltip

**File**: `frontend/src/components/InfoTooltip.tsx` (new)

**Intent**: Move all behaviour of `TechniqueTooltip` that is independent of exercises into a generic component: state, hover/focus/click/touch handling, Escape and outside-click closing, scroll lock on phones, viewport positioning, the trigger button, backdrop and the panel shell with a title and close button.

**Contract**: Props: `title: string`, `triggerLabel: string` (accessible name of the info button), `closeLabel: string`, `children: ReactNode` (panel body). Renders the same DOM and classes as today (`technique-tooltip`, `technique-trigger`, `technique-backdrop`, `technique-panel`, `technique-panel-head`, `technique-panel-title`, `technique-close`), including `data-open` / `data-placement`, `role="tooltip"`, `aria-expanded` and `aria-describedby`.

#### 2. TechniqueTooltip as a wrapper

**File**: `frontend/src/components/TechniqueTooltip.tsx`

**Intent**: Keep its public props and the "render nothing when there are neither cues nor muscles" rule; build the label, title and body (muscle map and cues) and hand them to `InfoTooltip`.

**Contract**: No change to rendered output or behaviour for the exercises list, the exercise form or the workout pages that use it.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (from `frontend/`)
- Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`
- Existing tooltip behaviour is unchanged: `npm run test:e2e -- technique-tooltip.spec.ts exercises-list.spec.ts muscle-map.spec.ts exercise-favorites.spec.ts`

#### Manual Verification:

- Tooltips on `/exercises` and in the exercise form behave exactly as before (hover, keyboard focus, Escape, outside click, phone bottom sheet)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Frontend foundations

### Overview

API client, a tested pure data util, translations (including the measuring tips), the route and the nav link with a first page that loads and lists the data.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Types and functions for the new endpoints, in the file's existing style.

**Contract**: `BodyMeasurement`, `BodyMeasurementInput`, `BodyMeasurementsResponse` types; `listBodyMeasurements()`, `createBodyMeasurement(input)`, `updateBodyMeasurement(id, input)`, `deleteBodyMeasurement(id)`, `setTargetWeight(kg | null)`.

#### 2. Data util and tests

**Files**: `frontend/src/utils/bodyMeasurements.ts`, `frontend/src/utils/bodyMeasurements.test.ts` (new)

**Intent**: One place for field metadata and pure logic used by the cards, chart and form.

**Contract**: `MEASUREMENT_FIELDS` (key, unit `kg` | `cm`, area `weight` | `waist` | `chest` | `hips` | `arm` | `thigh` | `calf`, optional side), `latestValues(entries)` (newest non-null value per field with its date), `changeFromPrevious(entries, field)` (latest vs the previous entry that has that field; null when there is none), `filterWindow(entries, days | 'all', today)`, `chartSeries(entries, area, window)` (ascending by date, one series per side for limbs), `parseDecimal(text)` accepting "." and "," and rejecting empty/NaN, and a range check per field. Tests: sparse entries, several entries on one date, missing previous value, windows at the boundary, left/right pairing, comma decimals, range limits.

#### 3. Strings

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: All `measurements.*` text in both languages, including the how-to-measure tips (a title and 2-4 short steps per area: weight, waist, chest, hips, arm, thigh, calf; left and right share an area's tip). Polish must be proper Polish with correct plural forms.

**Contract**: Keys for nav label, page title, form labels and units, buttons, empty/loading/error states, deltas, target weight, chart labels and `measurements.tips.<area>.title` / `.steps` (array). The existing locale parity unit test must still pass.

#### 4. Route, nav and first page

**Files**: `frontend/src/App.tsx`, `frontend/src/components/Topbar.tsx`, `frontend/src/pages/BodyMeasurementsPage.tsx` (new)

**Intent**: Protected `/measurements` route, a nav link and a `titleKey` entry for the narrow-screen header, and a page that loads the data and shows loading, error and empty states (form, history and chart arrive in the next phases).

**Contract**: Same protected-route wrapping as `/plans`; the link is active for `/measurements`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (including the new util tests and locale parity): `npm test`
- Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`

#### Manual Verification:

- The Measurements link opens the empty-state page in English and Polish, and the title shows in the narrow drawer layout

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Log and history

### Overview

The entry form with tooltips, the history list with edit and delete, and the latest-values summary.

### Changes Required:

#### 1. Entry form

**Files**: `frontend/src/components/MeasurementForm.tsx` (new), `frontend/src/pages/BodyMeasurementsPage.tsx`

**Intent**: One form for create and edit: a date input (default today, capped at the local today) and the 10 fields grouped as weight, trunk (waist, chest, hips) and limbs (left and right pairs). Each field's label has an `InfoTooltip` with that area's tips. Empty fields are sent as null on edit so values can be cleared; at least one value is required.

**Contract**: Text inputs with `inputMode="decimal"`, parsed with `parseDecimal` (comma or dot), client-side range check with field-level messages, server errors shown through `translateError`, disabled state while saving, edit mode populated from an entry with a cancel action. New interactive controls have hover, focus-visible and disabled states; styling uses tokens and shared classes.

#### 2. History list

**Files**: `frontend/src/components/MeasurementHistory.tsx` (new), `frontend/src/styles/measurements.css` (new)

**Intent**: Newest-first list of entries (date plus the values that were recorded), with Edit and Delete; Delete uses the same confirm/cancel pattern as the plans list.

**Contract**: Number formatting follows the active language; the row layout works at phone width (no horizontal page scroll).

#### 3. Latest values

**File**: `frontend/src/components/LatestMeasurements.tsx` (new)

**Intent**: Cards for each field that has data: latest value, unit, date, and the change since the previous entry with an explicit sign and accessible text; neutral styling (no good/bad colouring).

**Contract**: Uses `latestValues` and `changeFromPrevious`; hidden fields without data; empty state when there are no entries.

#### 4. Token guard

**File**: `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Add the new component and style files to the scanned list once they pass.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`

#### Manual Verification:

- Log an entry with a few fields (including comma decimals in Polish) and see it in the history and the latest cards with the correct change
- Edit an entry (including clearing a field) and delete one with confirmation
- Every field's tooltip opens by hover, keyboard focus and tap, and the steps read clearly in English and Polish
- Works keyboard-only and at phone width

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Trend chart and target weight

### Overview

A chart per measurement with a window, and the target weight with progress.

### Changes Required:

#### 1. Trend chart

**Files**: `frontend/src/components/MeasurementChart.tsx` (new), `frontend/src/components/chartTheme.ts`, `frontend/src/index.css`

**Intent**: A recharts line chart with a measurement selector (weight, waist, chest, hips, arm, thigh, calf) and the 7/30/90/all window toggle used on the dashboard; limbs draw two series (left and right) with a legend; sparse data still draws a line (connect gaps); empty and single-point states are handled.

**Contract**: Colours come from tokens via `chartTheme.ts`; if a second series colour token is missing add it to `index.css` for light and dark and record it in `context/changes/dashboard-ui-contract/tokens.md`. The chart exposes an accessible summary (role and label) like the existing charts.

#### 2. Target weight

**Files**: `frontend/src/components/TargetWeight.tsx` (new), `frontend/src/pages/BodyMeasurementsPage.tsx`

**Intent**: Set, change and clear the target weight; show progress as a plain difference between the latest weight and the target ("X kg above/below target", or "at target"); draw the target as a reference line on the weight chart.

**Contract**: Uses `setTargetWeight`; validates 20-500 with `parseDecimal` before sending; shows a prompt when there is a target but no weight entries yet.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`

#### Manual Verification:

- The selector and the 7/30/90/all window update the chart; limbs show both sides; a single point and sparse data render sensibly
- Setting, changing and clearing the target weight updates the progress text and the reference line
- Charts and controls look right in light and dark mode and at phone width

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: E2E coverage and docs

### Overview

Cover the user-visible behaviour end to end and document the feature.

### Changes Required:

#### 1. E2E spec

**File**: `frontend/e2e/body-measurements.spec.ts` (new)

**Intent**: Using the API helpers in `e2e/helpers.ts` and the login pattern of the existing specs, cover: the nav link; logging an entry; the latest card and change after two entries; edit including clearing a field; delete with confirmation; validation errors (empty entry, out-of-range value, comma decimals in Polish); chart selector and window; target weight set, progress and clear; a tooltip opening by keyboard and showing its steps in English and Polish; another user's data never visible; phone width without horizontal overflow.

**Contract**: Selectors by role, label and `data-*` attributes; no visual baselines; exact-text assertions for values.

#### 2. Docs

**Files**: `README.md`, `context/foundation/test-plan.md`, `CLAUDE.md`

**Intent**: Add a Measurements row to the README features table; add the new risks to the test plan (per-user isolation, decimal and locale parsing, date edge case, tooltip refactor regression) naming the tests that cover them; update the CLAUDE.md migration note from "next is V16" to "next is V20".

**Contract**: Match each file's existing style; no stale links; never write to `context/archive/`.

### Success Criteria:

#### Automated Verification:

- New e2e passes: `npm run test:e2e -- body-measurements.spec.ts`
- Full e2e suite passes: `npm run test:e2e`
- Backend suite passes: `./mvnw test`

#### Manual Verification:

- README, test plan and CLAUDE.md read correctly and link nothing stale

---

## Testing Strategy

### Unit Tests:

- `bodyMeasurements.test.ts`: latest/previous/change logic, windows, series building, decimal parsing and ranges.

### Integration Tests:

- Backend controller and schema tests (Phase 1); Playwright flows (Phase 6); the existing tooltip e2e specs as the regression guard for the extraction (Phase 2).

### Manual Testing Steps:

1. Log three entries over a few days (some fields blank) and check the cards, history and chart agree.
2. Set a target weight, log a new weight, and check the progress text.
3. Open each tooltip with mouse, keyboard and on a phone-width viewport.
4. Repeat the key flows in Polish with comma decimals.

## Performance Considerations

The list endpoint returns all of a user's entries and the browser computes windows, deltas and series. A daily logger accumulates about a thousand small rows over three years, which is fine; add paging or a server-side window only if that ever changes.

## Migration Notes

V19 only adds a new table and a nullable column; no existing data is touched. Flyway runs it on the next production deploy. Never edit an applied migration.

## References

- Change notes: `context/changes/body-measurements/change.md`
- Per-user API pattern: `src/main/java/com/example/gymtrack/plan/TrainingPlanController.java`
- Nullable user setting: `src/main/java/com/example/gymtrack/workout/DashboardController.java:43`, `frontend/src/api/client.ts:392`
- Tooltip to extract from: `frontend/src/components/TechniqueTooltip.tsx`
- Charts: `frontend/src/components/ProgressionChart.tsx`, `chartTheme.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend data and API

#### Automated

- [x] 1.1 Migration applies and new backend tests pass: `./mvnw test -Dtest='BodyMeasurement*'` — c2a31c0
- [x] 1.2 Full backend suite passes: `./mvnw test` — c2a31c0

#### Manual

- [x] 1.3 Against the local backend, create, edit and delete an entry and set and clear a target weight, and confirm another user's entry id returns 404 — c2a31c0

### Phase 2: Generic info tooltip

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 8647bce
- [x] 2.2 Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens` — 8647bce
- [x] 2.3 Existing tooltip behaviour is unchanged: `npm run test:e2e -- technique-tooltip.spec.ts exercises-list.spec.ts muscle-map.spec.ts exercise-favorites.spec.ts` — 8647bce

#### Manual

- [x] 2.4 Tooltips on `/exercises` and in the exercise form behave exactly as before (hover, keyboard focus, Escape, outside click, phone bottom sheet) — 8647bce

### Phase 3: Frontend foundations

#### Automated

- [x] 3.1 Unit tests pass (including the new util tests and locale parity): `npm test` — 518b201
- [x] 3.2 Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens` — 518b201

#### Manual

- [x] 3.3 The Measurements link opens the empty-state page in English and Polish, and the title shows in the narrow drawer layout — 518b201

### Phase 4: Log and history

#### Automated

- [x] 4.1 Unit tests pass: `npm test`
- [x] 4.2 Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`

#### Manual

- [x] 4.3 Log an entry with a few fields (including comma decimals in Polish) and see it in the history and the latest cards with the correct change
- [x] 4.4 Edit an entry (including clearing a field) and delete one with confirmation
- [x] 4.5 Every field's tooltip opens by hover, keyboard focus and tap, and the steps read clearly in English and Polish
- [x] 4.6 Works keyboard-only and at phone width

### Phase 5: Trend chart and target weight

#### Automated

- [ ] 5.1 Unit tests pass: `npm test`
- [ ] 5.2 Build, lint and token guard pass: `npm run build`, `npm run lint`, `npm run check:tokens`

#### Manual

- [ ] 5.3 The selector and the 7/30/90/all window update the chart; limbs show both sides; a single point and sparse data render sensibly
- [ ] 5.4 Setting, changing and clearing the target weight updates the progress text and the reference line
- [ ] 5.5 Charts and controls look right in light and dark mode and at phone width

### Phase 6: E2E coverage and docs

#### Automated

- [ ] 6.1 New e2e passes: `npm run test:e2e -- body-measurements.spec.ts`
- [ ] 6.2 Full e2e suite passes: `npm run test:e2e`
- [ ] 6.3 Backend suite passes: `./mvnw test`

#### Manual

- [ ] 6.4 README, test plan and CLAUDE.md read correctly and link nothing stale
