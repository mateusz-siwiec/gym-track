import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { deletePlan, getExercises, getPlan, listPlans } from '../api/client'
import type { Exercise, Plan, PlanSummary } from '../api/client'
import PlanMuscleStats from '../components/PlanMuscleStats'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/plans.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'

type PlanDetail = { status: 'loading' | 'error' | 'ready'; plan?: Plan }

export default function PlansPage() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [details, setDetails] = useState<Map<string, PlanDetail>>(new Map())
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [exercisesFailed, setExercisesFailed] = useState(false)
  // Refs mirror the fetch state so duplicate/stale requests are decided synchronously.
  const detailsRef = useRef<Map<string, PlanDetail>>(new Map())
  const exercisesStateRef = useRef<'idle' | 'loading' | 'ready'>('idle')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    listPlans()
      .then((list) => {
        if (mountedRef.current) setPlans(list)
      })
      .catch((err) => {
        if (mountedRef.current) setError({ err, key: 'plans.loadFailed' })
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
    return () => {
      mountedRef.current = false
    }
  }, [])

  function commitDetails() {
    setDetails(new Map(detailsRef.current))
  }

  function ensureExercises() {
    if (exercisesStateRef.current !== 'idle') return
    exercisesStateRef.current = 'loading'
    setExercisesFailed(false)
    getExercises()
      .then((list) => {
        exercisesStateRef.current = 'ready'
        if (mountedRef.current) setExercises(list)
      })
      .catch(() => {
        // Allows a retry on the next expand/tick.
        exercisesStateRef.current = 'idle'
        if (mountedRef.current) setExercisesFailed(true)
      })
  }

  function ensurePlan(id: string) {
    ensureExercises()
    const current = detailsRef.current.get(id)
    if (current && current.status !== 'error') return
    detailsRef.current.set(id, { status: 'loading' })
    commitDetails()
    getPlan(id)
      .then((plan) => {
        // Skipped if the plan was deleted (entry removed) or the page unmounted meanwhile.
        if (!mountedRef.current || detailsRef.current.get(id)?.status !== 'loading') return
        detailsRef.current.set(id, { status: 'ready', plan })
        commitDetails()
      })
      .catch(() => {
        if (!mountedRef.current || detailsRef.current.get(id)?.status !== 'loading') return
        detailsRef.current.set(id, { status: 'error' })
        commitDetails()
      })
  }

  function toggleIn(setter: typeof setExpandedIds, id: string, add: boolean) {
    setter((prev) => {
      const next = new Set(prev)
      if (add) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleExpanded(id: string) {
    const opening = !expandedIds.has(id)
    toggleIn(setExpandedIds, id, opening)
    if (opening) ensurePlan(id)
  }

  function toggleSelected(id: string) {
    const selecting = !selectedIds.has(id)
    toggleIn(setSelectedIds, id, selecting)
    if (selecting) ensurePlan(id)
  }

  function forgetPlan(id: string) {
    toggleIn(setExpandedIds, id, false)
    toggleIn(setSelectedIds, id, false)
    detailsRef.current.delete(id)
    commitDetails()
  }

  const exerciseMap = useMemo(
    () =>
      new Map(
        (exercises ?? []).map((x) => [
          x.id,
          { primaryMuscleGroup: x.primaryMuscleGroup, secondaryMuscleGroups: x.secondaryMuscleGroups },
        ]),
      ),
    [exercises],
  )

  const selectedPlans = useMemo(() => plans.filter((p) => selectedIds.has(p.id)), [plans, selectedIds])
  const failedPlans = selectedPlans.filter((p) => details.get(p.id)?.status === 'error')
  const combinedLoading =
    exercises === null ||
    selectedPlans.some((p) => {
      const status = details.get(p.id)?.status
      return status === undefined || status === 'loading'
    })
  const combinedEntries = useMemo(
    () =>
      selectedPlans.flatMap((p) => {
        const detail = details.get(p.id)
        return detail?.status === 'ready' && detail.plan
          ? detail.plan.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets }))
          : []
      }),
    [selectedPlans, details],
  )

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deletePlan(id)
      setPlans((list) => list.filter((p) => p.id !== id))
      forgetPlan(id)
    } catch (err) {
      setError({ err, key: 'plans.deleteFailed' })
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  return (
    <div className="page-shell">
      <main className="page-card plans-card">
        <div className="plans-header">
          <h1>{t('plans.title')}</h1>
          <Link to="/plans/new" className="plans-link-button">
            {t('plans.newPlan')}
          </Link>
        </div>
        {error && <p className="error-text">{translateError(error.err, error.key)}</p>}
        {selectedPlans.length === 1 && <p className="page-subtext">{t('plans.muscles.selectHint')}</p>}
        {selectedPlans.length >= 2 && (
          <div className="plan-combined">
            <p className="page-subtext">
              {t('plans.muscles.combinedPlans', { names: selectedPlans.map((p) => p.name).join(', ') })}
            </p>
            {failedPlans.length > 0 ? (
              <p className="error-text">
                {t('plans.muscles.combinedFailed', { names: failedPlans.map((p) => p.name).join(', ') })}
              </p>
            ) : exercisesFailed ? (
              <p className="error-text">{t('plans.muscles.loadFailed')}</p>
            ) : combinedLoading ? (
              <p className="page-subtext">{t('plans.muscles.loading')}</p>
            ) : (
              <PlanMuscleStats
                entries={combinedEntries}
                exercises={exerciseMap}
                idPrefix="plans-combined"
                heading={t('plans.muscles.combinedHeading')}
              />
            )}
          </div>
        )}
        {loading ? (
          <p className="page-subtext">{t('plans.loading')}</p>
        ) : plans.length === 0 ? (
          <p className="page-subtext">{t('plans.empty')}</p>
        ) : (
          <ul className="plan-list plan-list--selectable">
            {plans.map((plan) => {
              const expanded = expandedIds.has(plan.id)
              const detail = details.get(plan.id)
              return (
                <li key={plan.id} className="plan-item">
                  <input
                    type="checkbox"
                    className="plan-item-select"
                    aria-label={t('plans.muscles.selectPlan', { name: plan.name })}
                    checked={selectedIds.has(plan.id)}
                    onChange={() => toggleSelected(plan.id)}
                  />
                  <div className="plan-item-info">
                    <span className="plan-item-name">{plan.name}</span>
                    <span>
                      {t('plans.exerciseCount', { count: plan.exerciseCount })}
                    </span>
                  </div>
                  {confirmingId === plan.id ? (
                    <div className="plan-item-actions">
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => handleDelete(plan.id)}
                      >
                        {t('common.confirm')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="plan-item-actions">
                      <button
                        type="button"
                        className="btn-secondary plan-muscles-toggle"
                        aria-expanded={expanded}
                        aria-controls={`plan-muscles-${plan.id}`}
                        aria-label={expanded ? t('plans.muscles.hide') : t('plans.muscles.show')}
                        title={expanded ? t('plans.muscles.hide') : t('plans.muscles.show')}
                        onClick={() => toggleExpanded(plan.id)}
                      >
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </button>
                      <Link to={`/plans/${plan.id}`} className="btn-secondary">
                        {t('common.edit')}
                      </Link>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setConfirmingId(plan.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                  {expanded && (
                    <div className="plan-item-muscles" id={`plan-muscles-${plan.id}`}>
                      {detail?.status === 'error' || exercisesFailed ? (
                        <p className="error-text">{t('plans.muscles.loadFailed')}</p>
                      ) : detail?.status !== 'ready' || !detail.plan || exercises === null ? (
                        <p className="page-subtext">{t('plans.muscles.loading')}</p>
                      ) : (
                        <PlanMuscleStats
                          entries={detail.plan.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets }))}
                          exercises={exerciseMap}
                          idPrefix={`plan-${plan.id}`}
                        />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
