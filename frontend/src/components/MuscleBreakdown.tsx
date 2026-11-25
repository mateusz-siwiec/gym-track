import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { muscleGroupLabel, muscleParentLabel } from '../utils/muscleGroups'
import type { MuscleParentKey } from '../utils/muscleGroups'
import '../styles/page.css'
import '../styles/muscle-groups.css'

export interface MuscleBreakdownChild {
  group: string
  sets: number
  secondarySets: number
  failureSets?: number
}

export interface MuscleBreakdownParent {
  key: MuscleParentKey
  sets: number
  secondarySets: number
  failureSets?: number
  children: MuscleBreakdownChild[]
}

interface MuscleBreakdownProps {
  /** Already sorted by the caller (most-trained first by primary sets). */
  parents: MuscleBreakdownParent[]
  includeSecondary: boolean
  /** Prefix for the child list ids (`<idPrefix>-<PARENT_KEY>`); must be unique per breakdown on a page. */
  idPrefix: string
  /** Controlled expansion: a caller that unmounts the breakdown (e.g. while reloading) keeps the state itself. */
  expanded?: ReadonlySet<MuscleParentKey>
  onToggle?: (key: MuscleParentKey) => void
}

export default function MuscleBreakdown({
  parents,
  includeSecondary,
  idPrefix,
  expanded: controlledExpanded,
  onToggle,
}: MuscleBreakdownProps) {
  const { t } = useTranslation()
  // Expanded parent rows; internal state unless the caller controls it, never persisted.
  const [internalExpanded, setInternalExpanded] = useState<ReadonlySet<MuscleParentKey>>(new Set())
  const expanded = controlledExpanded ?? internalExpanded

  function toggle(key: MuscleParentKey) {
    if (onToggle) {
      onToggle(key)
      return
    }
    setInternalExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // One scale for both modes (primary + secondary), so ticking the box only adds to the bars and never resizes them.
  const max = Math.max(...parents.map((parent) => parent.sets + parent.secondarySets))
  const percent = (value: number, of: number) => `${of > 0 ? Math.min(100, (value / of) * 100) : 0}%`
  const barLabel = (sets: number, secondarySets: number) =>
    includeSecondary && secondarySets > 0
      ? `${t('muscleStats.setsCount', { count: sets })}, ${t('muscleStats.secondaryCount', { count: secondarySets })}`
      : t('muscleStats.setsCount', { count: sets })
  const bar = (sets: number, secondarySets: number, of: number) => (
    <span className="muscle-bar" role="img" aria-label={barLabel(sets, secondarySets)}>
      <span
        className="muscle-bar-secondary"
        style={{ width: percent(includeSecondary ? sets + secondarySets : sets, of) }}
      />
      <span className="muscle-bar-fill" style={{ width: percent(sets, of) }} />
    </span>
  )
  const count = (sets: number, secondarySets: number) => (
    <span className="muscle-count">
      {sets}
      {includeSecondary && secondarySets > 0 && <span className="muscle-secondary-count"> (+{secondarySets})</span>}
    </span>
  )

  return (
    <ul className="muscle-list">
      {parents.map((parent) => {
        const open = expanded.has(parent.key)
        const listId = `${idPrefix}-${parent.key}`
        // A muscle's primary + secondary sets never exceed its parent's, so child bars fit inside the parent's total.
        const parentTotal = parent.sets + parent.secondarySets
        const parentFailure = parent.failureSets ?? 0
        return (
          <li key={parent.key} className="muscle-parent" data-parent={parent.key}>
            <div className="muscle-row">
              {parent.children.length > 1 ? (
                <button
                  type="button"
                  className="muscle-toggle"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() => toggle(parent.key)}
                >
                  <svg
                    className="muscle-chevron"
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  {muscleParentLabel(parent.key)}
                </button>
              ) : (
                <span className="muscle-name">{muscleParentLabel(parent.key)}</span>
              )}
              {bar(parent.sets, parent.secondarySets, max)}
              {count(parent.sets, parent.secondarySets)}
              {parentFailure > 0 && (
                <span className="muscle-failure">{t('muscleStats.failureCount', { count: parentFailure })}</span>
              )}
            </div>
            {parent.children.length > 1 && (
              <ul id={listId} className="muscle-children" hidden={!open}>
                {parent.children.map((child) => {
                  const childFailure = child.failureSets ?? 0
                  return (
                    <li key={child.group} className="muscle-row" data-group={child.group}>
                      <span className="muscle-name">{muscleGroupLabel(child.group)}</span>
                      {bar(child.sets, child.secondarySets, parentTotal)}
                      {count(child.sets, child.secondarySets)}
                      {childFailure > 0 && (
                        <span className="muscle-failure">{t('muscleStats.failureCount', { count: childFailure })}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
