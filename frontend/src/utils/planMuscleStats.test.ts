import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS, MUSCLE_PARENTS } from './muscleGroups'
import { planMuscleStats } from './planMuscleStats'

const exercises = new Map([
  ['bench', { primaryMuscleGroup: 'MID_CHEST', secondaryMuscleGroups: [] as string[] }],
  ['press', { primaryMuscleGroup: 'MID_CHEST', secondaryMuscleGroups: ['FRONT_DELTS', 'TRICEPS'] }],
  ['dips', { primaryMuscleGroup: 'LOWER_CHEST', secondaryMuscleGroups: ['TRICEPS', 'BICEPS'] }],
  ['odd', { primaryMuscleGroup: 'BICEPS', secondaryMuscleGroups: ['BICEPS', 'NOT_A_GROUP'] }],
])

describe('planMuscleStats', () => {
  it('counts a primary-only exercise', () => {
    const stats = planMuscleStats([{ exerciseId: 'bench', sets: 3 }], exercises)
    expect(stats.totalSets).toBe(3)
    expect(stats.groups.get('MID_CHEST')).toEqual({ sets: 3, secondarySets: 0 })
    expect(stats.parents.get('CHEST')).toEqual({ sets: 3, secondarySets: 0 })
    expect(stats.parents.get('ARMS')).toEqual({ sets: 0, secondarySets: 0 })
  })

  it('counts secondary groups in full', () => {
    const stats = planMuscleStats([{ exerciseId: 'press', sets: 4 }], exercises)
    expect(stats.groups.get('FRONT_DELTS')).toEqual({ sets: 0, secondarySets: 4 })
    expect(stats.groups.get('TRICEPS')).toEqual({ sets: 0, secondarySets: 4 })
    expect(stats.parents.get('SHOULDERS')).toEqual({ sets: 0, secondarySets: 4 })
    expect(stats.totalSets).toBe(4)
  })

  it('counts a parent once when two of its groups are secondary', () => {
    const stats = planMuscleStats([{ exerciseId: 'dips', sets: 3 }], exercises)
    expect(stats.groups.get('TRICEPS')?.secondarySets).toBe(3)
    expect(stats.groups.get('BICEPS')?.secondarySets).toBe(3)
    expect(stats.parents.get('ARMS')).toEqual({ sets: 0, secondarySets: 3 })
    expect(stats.parents.get('CHEST')).toEqual({ sets: 3, secondarySets: 0 })
  })

  it('ignores a secondary group equal to the primary and unknown groups', () => {
    const stats = planMuscleStats([{ exerciseId: 'odd', sets: 2 }], exercises)
    expect(stats.groups.get('BICEPS')).toEqual({ sets: 2, secondarySets: 0 })
    expect(stats.parents.get('ARMS')).toEqual({ sets: 2, secondarySets: 0 })
  })

  it('sums duplicate exercise entries', () => {
    const stats = planMuscleStats(
      [
        { exerciseId: 'press', sets: 3 },
        { exerciseId: 'press', sets: 2 },
      ],
      exercises,
    )
    expect(stats.totalSets).toBe(5)
    expect(stats.groups.get('MID_CHEST')?.sets).toBe(5)
    expect(stats.groups.get('TRICEPS')?.secondarySets).toBe(5)
  })

  it('skips unknown exercises and invalid set counts', () => {
    const stats = planMuscleStats(
      [
        { exerciseId: 'missing', sets: 3 },
        { exerciseId: 'bench', sets: 0 },
        { exerciseId: 'bench', sets: 2.5 },
        { exerciseId: 'bench', sets: Number.NaN },
      ],
      exercises,
    )
    expect(stats.totalSets).toBe(0)
    expect(stats.groups.get('MID_CHEST')?.sets).toBe(0)
  })

  it('counts a parent as both primary and secondary when a secondary group shares the primary parent', () => {
    // Mirrors DashboardService: the parent counts the primary once and (separately) the secondary once.
    const incline = new Map([
      ['incline', { primaryMuscleGroup: 'UPPER_CHEST', secondaryMuscleGroups: ['MID_CHEST'] }],
    ])
    const stats = planMuscleStats([{ exerciseId: 'incline', sets: 3 }], incline)
    expect(stats.groups.get('UPPER_CHEST')).toEqual({ sets: 3, secondarySets: 0 })
    expect(stats.groups.get('MID_CHEST')).toEqual({ sets: 0, secondarySets: 3 })
    expect(stats.parents.get('CHEST')).toEqual({ sets: 3, secondarySets: 3 })
    expect(stats.totalSets).toBe(3)
  })

  it('counts an exercise with an unknown primary group only toward the total', () => {
    const odd = new Map([['odd', { primaryMuscleGroup: 'NOT_A_GROUP', secondaryMuscleGroups: ['TRICEPS'] }]])
    const stats = planMuscleStats([{ exerciseId: 'odd', sets: 2 }], odd)
    expect(stats.totalSets).toBe(2)
    for (const counts of stats.groups.values()) expect(counts.sets).toBe(0)
    expect(stats.groups.get('TRICEPS')).toEqual({ sets: 0, secondarySets: 2 })
  })

  it('skips negative set counts', () => {
    const stats = planMuscleStats(
      [
        { exerciseId: 'bench', sets: -2 },
        { exerciseId: 'bench', sets: 1 },
      ],
      exercises,
    )
    expect(stats.totalSets).toBe(1)
    expect(stats.groups.get('MID_CHEST')).toEqual({ sets: 1, secondarySets: 0 })
  })

  it('gives all zeros for empty input', () => {
    const stats = planMuscleStats([], exercises)
    expect(stats.totalSets).toBe(0)
    expect(stats.groups.size).toBe(MUSCLE_GROUPS.length)
    expect(stats.parents.size).toBe(MUSCLE_PARENTS.length)
    for (const counts of [...stats.groups.values(), ...stats.parents.values()]) {
      expect(counts).toEqual({ sets: 0, secondarySets: 0 })
    }
  })
})
