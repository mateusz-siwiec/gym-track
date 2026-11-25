---
change_id: plan-muscle-stats
title: Muscle group statistics for training plans
status: implementing
created: 2026-11-25
updated: 2026-11-25
archived_at: null
---

## Notes

Add muscle statistics for plans. I want to look at muscle groups when creating a plan and maybe when showing a plan. Additionally my full workout per week is three plans, and I want to have the possibility to check a few plans together and look at muscle groups for them together.

Context from the codebase (not decisions):
- Plans live in `com.example.gymtrack.plan` (`TrainingPlanController`, `PlanEntryResponse` has exerciseId/sets/reps/duration); frontend: `PlansPage.tsx`, `PlanEditorPage.tsx`, `PlanExerciseList.tsx`.
- Existing per-muscle stats for logged sets: `MuscleGroupStatsResponse` (groups + parents, primary `sets`, `secondarySets`, `failureSets`), `MuscleGroupStatsPage.tsx`, `MuscleMap`/`MuscleFigure` components. Related past change: `secondary-muscle-stats`.

Open design questions for the plan: stats computed from planned sets (sets x exercise primary/secondary muscle) rather than logged ones; include-secondary toggle and parent-row double counting, same semantics as `secondary-muscle-stats`; live preview in the editor (client-side vs new endpoint, unsaved entries); multi-select on the plans list with a combined view (endpoint taking plan ids vs client-side aggregation); reuse of `MuscleMap` for display.
