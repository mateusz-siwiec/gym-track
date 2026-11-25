import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MuscleBreakdown from './MuscleBreakdown'
import type { MuscleBreakdownParent } from './MuscleBreakdown'
import { MUSCLE_PARENTS } from '../utils/muscleGroups'
import type { MuscleGroup } from '../utils/muscleGroups'
import { planMuscleStats } from '../utils/planMuscleStats'
import type { PlanStatsEntry, PlanStatsExercise } from '../utils/planMuscleStats'
import '../styles/page.css'
import '../styles/muscle-groups.css'

interface PlanMuscleStatsProps {
  entries: readonly PlanStatsEntry[]
  exercises: ReadonlyMap<string, PlanStatsExercise>
  /** Unique per panel on a page; prefixes the child list ids. */
  idPrefix: string
  heading?: string
}

export default function PlanMuscleStats({ entries, exercises, idPrefix, heading }: PlanMuscleStatsProps) {
  const { t } = useTranslation()
  const checkboxId = useId()
  const [includeSecondary, setIncludeSecondary] = useState(false)

  const stats = useMemo(() => planMuscleStats(entries, exercises), [entries, exercises])

  // Most-trained first by primary sets, so the order does not change when the checkbox is toggled;
  // Array.sort is stable, so ties keep the hierarchy order.
  const parents = useMemo<MuscleBreakdownParent[]>(
    () =>
      MUSCLE_PARENTS.map((parent) => {
        const children = (parent.groups as readonly MuscleGroup[])
          .map((group) => {
            const counts = stats.groups.get(group)
            return { group, sets: counts?.sets ?? 0, secondarySets: counts?.secondarySets ?? 0 }
          })
          .sort((a, b) => b.sets - a.sets)
        const counts = stats.parents.get(parent.key)
        return { key: parent.key, children, sets: counts?.sets ?? 0, secondarySets: counts?.secondarySets ?? 0 }
      }).sort((a, b) => b.sets - a.sets),
    [stats],
  )

  return (
    <section className="plan-muscle-stats">
      {heading && <h2 className="plan-muscle-heading">{heading}</h2>}
      {stats.totalSets === 0 ? (
        <p className="page-subtext">{t('plans.muscles.empty')}</p>
      ) : (
        <>
          <label className="muscle-secondary-toggle" htmlFor={checkboxId}>
            <input
              id={checkboxId}
              type="checkbox"
              checked={includeSecondary}
              onChange={(event) => setIncludeSecondary(event.target.checked)}
            />
            {t('muscleStats.includeSecondary')}
          </label>
          <p className="muscle-total">{t('plans.muscles.total', { count: stats.totalSets })}</p>
          <MuscleBreakdown parents={parents} includeSecondary={includeSecondary} idPrefix={`${idPrefix}-muscle-children`} />
        </>
      )}
    </section>
  )
}
