import { MUSCLE_GROUPS, MUSCLE_PARENTS, type MuscleGroup, type MuscleParentKey } from './muscleGroups'

export interface MuscleSetCounts {
  sets: number
  secondarySets: number
}

export interface PlanMuscleStats {
  totalSets: number
  groups: Map<MuscleGroup, MuscleSetCounts>
  parents: Map<MuscleParentKey, MuscleSetCounts>
}

export interface PlanStatsEntry {
  exerciseId: string
  sets: number
}

export interface PlanStatsExercise {
  primaryMuscleGroup: string
  secondaryMuscleGroups: string[]
}

const KNOWN_GROUPS: ReadonlySet<string> = new Set(MUSCLE_GROUPS)

const PARENT_OF_GROUP: ReadonlyMap<MuscleGroup, MuscleParentKey> = new Map(
  MUSCLE_PARENTS.flatMap((parent) =>
    (parent.groups as readonly MuscleGroup[]).map((group) => [group, parent.key] as const),
  ),
)

/**
 * Per-group and per-parent set counts for planned entries. Mirrors the backend dashboard muscle stats
 * rules, without failure sets. Entries with invalid sets or an unknown exercise are skipped.
 */
export function planMuscleStats(
  entries: readonly PlanStatsEntry[],
  exercises: ReadonlyMap<string, PlanStatsExercise>,
): PlanMuscleStats {
  const groups = new Map<MuscleGroup, MuscleSetCounts>(
    MUSCLE_GROUPS.map((group) => [group, { sets: 0, secondarySets: 0 }]),
  )
  const parents = new Map<MuscleParentKey, MuscleSetCounts>(
    MUSCLE_PARENTS.map((parent) => [parent.key, { sets: 0, secondarySets: 0 }]),
  )
  let totalSets = 0

  for (const entry of entries) {
    if (!Number.isInteger(entry.sets) || entry.sets < 1) continue
    const exercise = exercises.get(entry.exerciseId)
    if (!exercise) continue
    totalSets += entry.sets

    const primary = exercise.primaryMuscleGroup
    if (KNOWN_GROUPS.has(primary)) {
      groups.get(primary as MuscleGroup)!.sets += entry.sets
      parents.get(PARENT_OF_GROUP.get(primary as MuscleGroup)!)!.sets += entry.sets
    }

    const secondaryGroups = new Set(
      exercise.secondaryMuscleGroups.filter((group) => group !== primary && KNOWN_GROUPS.has(group)),
    ) as Set<MuscleGroup>
    const secondaryParents = new Set<MuscleParentKey>()
    for (const group of secondaryGroups) {
      groups.get(group)!.secondarySets += entry.sets
      secondaryParents.add(PARENT_OF_GROUP.get(group)!)
    }
    for (const parent of secondaryParents) {
      parents.get(parent)!.secondarySets += entry.sets
    }
  }

  return { totalSets, groups, parents }
}
