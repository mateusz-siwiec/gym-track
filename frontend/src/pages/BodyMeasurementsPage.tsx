import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listBodyMeasurements } from '../api/client'
import type { BodyMeasurement, BodyMeasurementsResponse } from '../api/client'
import LatestMeasurements from '../components/LatestMeasurements'
import MeasurementChart from '../components/MeasurementChart'
import MeasurementForm from '../components/MeasurementForm'
import MeasurementHistory from '../components/MeasurementHistory'
import TargetWeight from '../components/TargetWeight'
import { latestValues } from '../utils/bodyMeasurements'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import '../styles/page.css'
import '../styles/workout.css'
import '../styles/measurements.css'

export default function BodyMeasurementsPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<BodyMeasurementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [editing, setEditing] = useState<BodyMeasurement | null>(null)

  useEffect(() => {
    let active = true
    listBodyMeasurements()
      .then((response) => {
        if (active) setData(response)
      })
      .catch((err) => {
        if (active) setError({ err, key: 'measurements.loadFailed' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const entries = data?.entries ?? []

  function handleSaved(saved: BodyMeasurement, wasEdit: boolean) {
    setData((current) => {
      const base = current ?? { targetWeightKg: null, entries: [] }
      return {
        ...base,
        entries: wasEdit
          ? base.entries.map((entry) => (entry.id === saved.id ? saved : entry))
          : [...base.entries, saved],
      }
    })
    if (wasEdit) setEditing(null)
  }

  function handleTargetChanged(target: number | null) {
    setData((current) => ({ entries: [], ...current, targetWeightKg: target }))
  }

  function handleDeleted(id: string) {
    setData((current) => (current ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) } : current))
    setEditing((current) => (current?.id === id ? null : current))
  }

  return (
    <div className="page-shell">
      <main className="page-card measurements-card">
        <h1>{t('measurements.title')}</h1>
        <p className="page-subtext">{t('measurements.subtitle')}</p>
        {error && <p className="error-text">{translateError(error.err, error.key)}</p>}
        {loading ? (
          <p className="page-subtext">{t('measurements.loading')}</p>
        ) : (
          !error && (
            <>
              {entries.length === 0 ? (
                <p className="page-subtext">{t('measurements.empty')}</p>
              ) : (
                <LatestMeasurements entries={entries} />
              )}
              <TargetWeight
                targetWeightKg={data?.targetWeightKg ?? null}
                latestWeightKg={latestValues(entries).weightKg?.value ?? null}
                onChange={handleTargetChanged}
              />
              {entries.length > 0 && <MeasurementChart entries={entries} targetWeightKg={data?.targetWeightKg ?? null} />}
              <section aria-label={editing ? t('measurements.form.editTitle') : t('measurements.form.title')}>
                <MeasurementForm
                  key={editing?.id ?? 'new'}
                  entry={editing}
                  onSaved={handleSaved}
                  onCancel={() => setEditing(null)}
                />
              </section>
              <MeasurementHistory
                entries={entries}
                editingId={editing?.id ?? null}
                onEdit={setEditing}
                onDeleted={handleDeleted}
              />
            </>
          )
        )}
      </main>
    </div>
  )
}
