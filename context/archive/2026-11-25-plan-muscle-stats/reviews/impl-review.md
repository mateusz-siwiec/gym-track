<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Muscle group statistics for training plans

- **Plan**: context/changes/plan-muscle-stats/plan.md
- **Scope**: Full plan (5 of 5 phases)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Notes: no DRIFT and no MISSING items against the plan. Two deliberate, user-approved deviations are recorded as MATCH-with-note: the icon-only chevron row toggle with phone-tightened row CSS, and the optional controlled `expanded`/`onToggle` props on `MuscleBreakdown`. Two benign EXTRA items: `PlansPage.tsx` was also added to the token guard list, and the e2e spec has a phone-layout test. Automated criteria re-run during review: `npm test` (77), `npm run build`, `npm run lint` (0 errors), `npm run check:tokens` (23 files) pass; the full e2e suite (114) and `./mvnw test` (289) passed at the end of Phase 5 with no code changes since.

## Findings

### F1 — Phone padding rule in plans.css is dead code

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/plans.css:212-215 and 237-240
- **Detail**: The `@media (max-width: 480px)` block sets `padding-inline: 0.5rem` on `.plan-list--selectable .plan-item-actions .btn-secondary, .btn-danger`. An unconditional block with identical selectors and the same specificity at lines 237-240 comes later and sets `padding-inline: 0.875rem`, so it wins at every width. The phone tightening never applies to Edit/Delete/Confirm/Cancel. The 390px e2e test passes anyway; 320-360px phones may wrap or leave the name column too narrow. Confirmed by reading the file order.
- **Fix**: Move the base padding block (237-240) above the media query so the phone value overrides it.
- **Decision**: FIXED (Fix now) — base padding block moved above the media query; row re-measured at 1280/390/360/320px, plan e2e 5/5

### F2 — aria-controls points at an element that does not exist while collapsed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/PlansPage.tsx:245 (target rendered at :267 only when expanded)
- **Detail**: The row toggle always sets `aria-controls="plan-muscles-<id>"`, but the panel is only in the DOM while expanded, so the reference dangles when collapsed.
- **Fix**: Set `aria-controls` only while expanded.
- **Decision**: FIXED (Fix now) — aria-controls is set only while the panel is expanded

### F3 — Toggle label changes while aria-expanded also changes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/PlansPage.tsx:246-247
- **Detail**: The `aria-label` switches between "Show muscles" and "Hide muscles" and `aria-expanded` flips too, so a screen reader announces the state twice ("Hide muscles, expanded"). The e2e spec uses both names.
- **Fix**: Keep one fixed label (for example "Muscles") and let `aria-expanded` carry the state; update the e2e selectors and strings.
- **Decision**: FIXED (Fix now) — one fixed toggle label "Muscles of {{name}}" (en/pl), show/hide strings removed, e2e selectors updated; plan spec 5/5

### F4 — Loading and error messages are not live regions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/PlansPage.tsx:183-185, 268-271
- **Detail**: Per-plan and combined loading/error lines have no `role="status"` / `role="alert"`; other pages use `role="alert"` for load errors, and the combined result appearing after a tick is not announced.
- **Fix**: Add `role="alert"` to the error lines and `aria-live="polite"` around the combined panel.
- **Decision**: FIXED (Fix now) — role=alert on error lines, role=status on loading lines, plus one persistent hidden polite live region for the hint/combined total (a wrapper live region on the whole panel would re-announce on every checkbox toggle); e2e hint selectors scoped and live region asserted, plan spec 5/5

### F5 — Row entries array rebuilt every render, defeating PlanMuscleStats memoization

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/PlansPage.tsx:274
- **Detail**: `detail.plan.exercises.map(...)` creates a new array on each render, so the `useMemo` inside `PlanMuscleStats` recomputes on every `PlansPage` render (checkbox ticks, confirm toggles). Cost is trivial at these sizes.
- **Fix**: Build the entries once when a plan is stored in `details` (or memoize per plan).
- **Decision**: FIXED (Fix now) — entries are built once when a plan is stored in `details` and reused by the row and the combined panel; build/lint/tokens pass

### F6 — Row checkbox is smaller than the page's touch-target size

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/plans.css:159-166
- **Detail**: The checkbox is 1.5rem while buttons on the page have a 48px minimum height.
- **Fix**: Wrap it in a label or add padding so the hit area reaches about 44px without changing the visual size.
- **Decision**: FIXED (Fix now) — checkbox wrapped in a label with 0.625rem padding offset by a negative margin: 44x44 hit area, visual size and name column unchanged (87px at 390px); verified by clicking the padding area

### F7 — Some e2e assertions are substring matches that could pass on a wrong count

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/e2e/plan-muscle-stats.spec.ts:51-53, 58, 62-63, 83-85, 119-121
- **Detail**: `toContainText('3')` / `toContainText('0')` on a whole row would also match "13" or any count containing a zero; `CORE` `toContainText('0')` is weak. The "(+" checks only prove a secondary count exists, not its value.
- **Fix**: Assert the exact text of the row's `.muscle-count` element instead.
- **Decision**: FIXED (Fix now) — count assertions now compare the exact text of the .muscle-count element; new test asserts the exact secondary value ("0 (+4)") derived from the exercise API; break-check red on "+= 1"; plan spec 6/6

### F8 — Unit tests miss three edge cases of planMuscleStats

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/src/utils/planMuscleStats.test.ts
- **Detail**: No test for a secondary group in the same parent as the primary (a parent then counts both a primary and a secondary set, as in DashboardService:205-214), an exercise with an unknown primary group (counts only toward totalSets), or negative sets.
- **Fix**: Add those three cases to pin the parity with the backend.
- **Decision**: FIXED (Fix now) — three unit tests added (same-parent primary+secondary, unknown primary group, negative sets); break-check red on a parent-skipping change; 80 unit tests pass
