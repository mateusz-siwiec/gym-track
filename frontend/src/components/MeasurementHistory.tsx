import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteBodyMeasurement } from '../api/client'
import type { BodyMeasurement } from '../api/client'
import { MEASUREMENT_FIELDS } from '../utils/bodyMeasurements'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import { formatCalendarDate, formatMeasurement } from '../utils/format'

interface MeasurementHistoryProps {
  entries: readonly BodyMeasurement[]
  /** Id of the entry currently open in the form, highlighted in the list. */
  editingId: string | null
  onEdit: (entry: BodyMeasurement) => void
  onDeleted: (id: string) => void
}

function newestFirst(a: BodyMeasurement, b: BodyMeasurement): number {
  if (a.measuredOn !== b.measuredOn) return a.measuredOn < b.measuredOn ? 1 : -1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return 0
}

export default function MeasurementHistory({ entries, editingId, onEdit, onDeleted }: MeasurementHistoryProps) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const sorted = useMemo(() => [...entries].sort(newestFirst), [entries])

  async function handleDelete(id: string) {
    setError(null)
    setBusy(true)
    try {
      await deleteBodyMeasurement(id)
      onDeleted(id)
    } catch (err) {
      setError({ err, key: 'measurements.deleteFailed' })
    } finally {
      setBusy(false)
      setConfirmingId(null)
    }
  }

  return (
    <section className="measurement-history" aria-labelledby="measurement-history-title">
      <h2 id="measurement-history-title">{t('measurements.history.title')}</h2>
      <p className="page-subtext">{t('measurements.history.count', { count: entries.length })}</p>
      {error && (
        <p className="error-text" role="alert">
          {translateError(error.err, error.key)}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="page-subtext">{t('measurements.history.empty')}</p>
      ) : (
        <ul className="measurement-list">
          {sorted.map((entry) => (
            <li
              key={entry.id}
              className="measurement-item"
              data-testid="measurement-entry"
              data-date={entry.measuredOn}
              data-editing={entry.id === editingId ? '' : undefined}
            >
              <div className="measurement-item-info">
                <span className="measurement-item-date">{formatCalendarDate(entry.measuredOn)}</span>
                <ul className="measurement-values">
                  {MEASUREMENT_FIELDS.flatMap(({ key, unit }) => {
                    const value = entry[key]
                    return value === null
                      ? []
                      : [
                          <li key={key} data-field={key}>
                            <span className="measurement-values-name">{t(`measurements.fields.${key}`)}</span>{' '}
                            <span className="measurement-values-number">
                              {formatMeasurement(value)} {t(`measurements.units.${unit}`)}
                            </span>
                          </li>,
                        ]
                  })}
                </ul>
              </div>
              {confirmingId === entry.id ? (
                <div
                  className="measurement-item-actions"
                  role="group"
                  aria-label={t('measurements.history.confirmDelete')}
                >
                  <span className="measurement-confirm-text">{t('measurements.history.confirmDelete')}</span>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busy}
                    data-testid="measurement-confirm-delete"
                    onClick={() => handleDelete(entry.id)}
                  >
                    {t('measurements.history.confirmYes')}
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirmingId(null)}>
                    {t('measurements.history.confirmNo')}
                  </button>
                </div>
              ) : (
                <div className="measurement-item-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    data-testid="measurement-edit"
                    onClick={() => {
                      setConfirmingId(null)
                      onEdit(entry)
                    }}
                  >
                    {t('measurements.history.edit')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    data-testid="measurement-delete"
                    onClick={() => setConfirmingId(entry.id)}
                  >
                    {t('measurements.history.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
