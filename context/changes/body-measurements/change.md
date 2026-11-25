---
change_id: body-measurements
title: Body measurements tab
status: impl_reviewed
created: 2026-11-25
updated: 2026-11-25
archived_at: null
---

## Notes

I want a new tab with body measurements. Plan it with me.

Context from the codebase (not decisions):
- Nothing exists yet for body measurements; "bodyweight" in the code only means bodyweight *exercises* (`WeightMode`, `bodyweight-and-timed-sets`).
- Navigation is `frontend/src/components/Topbar.tsx` (NavLinks + `titleKey` map), routes in `frontend/src/App.tsx`. Charts use recharts (`ProgressionChart.tsx`, `WeeklyVolumeChart.tsx`, `chartTheme.ts`).
- Backend packages: `auth`, `common`, `config`, `exercise`, `plan`, `user`, `workout`; per-user data pattern as in `plan` (controller + service + repository, `@AuthenticationPrincipal CurrentUser`). Next Flyway migration is V19 (CLAUDE.md still says V16).
- PRD non-goals: no sleep/RPE/calories personalization; body measurements are not listed as a non-goal either way.

Open design questions for the plan: which measurements (weight only vs weight + tape measurements), entry model (one row per date vs per measurement), units and editing, history list vs chart, target/goal, relation to the dashboard, i18n en/pl.
