<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Body measurements tab

- **Plan**: context/changes/body-measurements/plan.md
- **Scope**: Full plan (6 of 6 phases)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-11-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria re-run on 2026-11-25: `npm test` 99 passed; `npm run build`, `npm run lint` (2 existing AuthContext warnings), `npm run check:tokens` (29 files) pass; `./mvnw test` 310 run, 0 failures, 1 skipped. The e2e specs (new spec 11/11, full suite 126 after the baseline refresh) were run during Phase 6 and not re-run in this review.

## Findings

### F1 — Same-day tie-break compares createdAt strings lexically

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/utils/bodyMeasurements.ts:71, frontend/src/components/MeasurementHistory.tsx:20
- **Detail**: Jackson prints Instant fractions in groups of 0, 3, 6 or 9 digits. "…05.123Z" therefore sorts after "…05.123456Z" because 'Z' > '4', which is the wrong way round. Two entries on the same date whose createdAt differ only in the sub-second part can then swap, giving a wrong "latest" value or wrong "change since previous". The backend ORDER BY is correct; only the client re-sort is wrong.
- **Fix**: Compare with `Date.parse(a.createdAt) - Date.parse(b.createdAt)` in both places (or share one comparator).
- **Decision**: FIXED — Fix now. Comparator shared from the util; it pads the fraction to 9 digits because Date.parse drops micros. Unit test added and break-checked.

### F2 — Left and right tooltip triggers share one accessible name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/MeasurementForm.tsx:136
- **Detail**: `triggerLabel` is built from the area label, so left and right arm, thigh and calf all get the same name ("How to measure: arm"). Screen-reader users cannot tell the buttons apart.
- **Fix**: Build the trigger label from the field label (which includes the side), and update any e2e selector that relies on the area-only name.
- **Decision**: FIXED — Fix now. Trigger label uses the field label (with side); e2e assertion added.

### F3 — setTargetWeight saves the whole User entity

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/bodymeasurement/BodyMeasurementService.java:68
- **Detail**: The service loads the User and saves it back. User has no @Version or @DynamicUpdate, so every column is written from the loaded snapshot. A concurrent change to another user column (for example the weekly goal) in that small window can be overwritten. Not checked: whether the weekly-goal endpoint uses the same pattern, in which case this is consistent with the project.
- **Fix**: Use a targeted `@Modifying @Query("update User u set u.targetWeightKg = :t where u.id = :id")` in the repository.
  - Strength: Touches one column only.
  - Tradeoff: Differs from the weeklyGoal pattern the plan told us to copy.
  - Confidence: MED — depends on how weeklyGoal does it.
  - Blind spot: Entity cache is not refreshed after a bulk update.
- **Decision**: FIXED — Fix now. UserRepository.updateTargetWeight (@Modifying, one column); service uses its row count for not-found. weeklyGoal keeps the old pattern.

### F4 — No retry after a failed initial load

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/BodyMeasurementsPage.tsx:74
- **Detail**: When the first request fails, the page body is hidden and only the error line shows. The user must reload the page.
- **Fix**: Add a Retry button next to the error that re-runs the load.
- **Decision**: FIXED — Fix now. Retry button (attempt counter, common.retry) on the page; e2e test added (mock must fail every GET because of StrictMode double effect).

### F5 — Unbounded list and repeated full sorts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: BodyMeasurementService.java:37, frontend/src/components/LatestMeasurements.tsx:26
- **Detail**: The list endpoint has no limit, and each latest card re-sorts the whole array (about 20 sorts per render). The plan's Performance Considerations accept this for about a thousand rows.
- **Fix**: None needed now; sort once with useMemo if entries ever grow.
- **Decision**: FIXED — Fix now. latestSummary() sorts once; LatestMeasurements uses it; unit test added and break-checked. Endpoint stays unbounded (plan accepts it).

### F6 — Target-weight exception carries its own advice

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/main/java/com/example/gymtrack/bodymeasurement/InvalidTargetWeightException.java
- **Detail**: `InvalidTargetWeightException` has a nested @RestControllerAdvice, while `InvalidWeeklyGoalException` takes an ErrorCode and is mapped by a shared handler. It works and is tested, but it is a second way to do the same thing. `parseTarget` also reads the body as Double, so "at most 2 decimals" is not exact for inputs like 80.10000000000000001.
- **Fix**: Optionally align with the weekly-goal exception mapping; otherwise leave as is.
- **Decision**: FIXED — Fix now. Package-level BodyMeasurementExceptionHandler (like workout/exercise); exception exposes getCode(). Double-precision edge case left as is (harmless).

### F7 — Small leftovers

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/components/MeasurementChart.tsx:22, frontend/scripts/check-hardcoded-values.mjs:34
- **Detail**: The state variable `window` shadows the global. `InfoTooltip.tsx` is not in the token-guard file list, although `TechniqueTooltip.tsx` (now a thin wrapper) is.
- **Fix**: Rename `window` to `range`; add `InfoTooltip.tsx` to the guard list if it passes.
- **Decision**: FIXED — Fix now. `window` renamed to `range` (only the variable; the i18n key and test id keep the word); InfoTooltip.tsx added to the token guard and passes (30 files).

## Triage summary

Fixed: F1, F2, F3, F4, F5, F6, F7 (7). Skipped: none. Accepted as rule: none.

Verification after the fixes: `npm test` 101 passed, `npm run build`, `npm run lint` (2 existing AuthContext warnings), `npm run check:tokens` (30 files), `./mvnw test` 310 run, 0 failures, 1 skipped. New tests: `newestFirst` ordering and `latestSummary` (both break-checked), e2e for distinct left/right tooltip names and for Retry after a failed load.

Notes: the F1 fix pads the fraction to 9 digits instead of using `Date.parse`, which drops microseconds (found by the new test). F5 leaves the endpoint unbounded, as the plan accepts. The `Double` precision edge case in the target-weight parser (F6) was left alone.
