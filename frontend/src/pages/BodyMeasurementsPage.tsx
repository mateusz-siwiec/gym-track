import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listBodyMeasurements } from '../api/client'
import type { BodyMeasurementsResponse } from '../api/client'
import { MEASUREMENT_FIELDS } from '../utils/bodyMeasurements'
import { formatDate, formatNumber } from '../utils/format'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'
import '../styles/page.css'

export default function BodyMeasurementsPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<BodyMeasurementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)

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

  return (
    <div className="page-shell">
      <main className="page-card">
        <h1>{t('measurements.title')}</h1>
        {error && <p className="error-text">{translateError(error.err, error.key)}</p>}
        {loading ? (
          <p className="page-subtext">{t('measurements.loading')}</p>
        ) : !error && entries.length === 0 ? (
          <p className="page-subtext">{t('measurements.empty')}</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <strong>{formatDate(entry.measuredOn)}</strong>
                {MEASUREMENT_FIELDS.flatMap((field) => {
                  const value = entry[field.key]
                  return value === null
                    ? []
                    : [
                        <span key={field.key}>
                          {' · '}
                          {t(`measurements.fields.${field.key}`)} {formatNumber(value)} {t(`measurements.units.${field.unit}`)}
                        </span>,
                      ]
                })}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
