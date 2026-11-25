import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { BodyMeasurement } from '../api/client'
import { changeFromPrevious, latestValues, MEASUREMENT_FIELDS } from '../utils/bodyMeasurements'
import { formatCalendarDate, formatMeasurement } from '../utils/format'

interface LatestMeasurementsProps {
  entries: readonly BodyMeasurement[]
}

export default function LatestMeasurements({ entries }: LatestMeasurementsProps) {
  const { t } = useTranslation()
  const latest = useMemo(() => latestValues(entries), [entries])
  const fields = MEASUREMENT_FIELDS.filter((field) => latest[field.key] !== null)

  return (
    <section className="measurement-latest" aria-labelledby="measurement-latest-title">
      <h2 id="measurement-latest-title">{t('measurements.latest.title')}</h2>
      {fields.length === 0 ? (
        <p className="page-subtext">{t('measurements.latest.noValue')}</p>
      ) : (
        <ul className="measurement-cards">
          {fields.map((field) => {
            const current = latest[field.key]!
            const unit = t(`measurements.units.${field.unit}`)
            const change = changeFromPrevious(entries, field.key)
            let visible: string | null = null
            let spoken: string | null = null
            if (change) {
              const since = formatCalendarDate(change.previous.date)
              const amount = formatMeasurement(Math.abs(change.delta))
              if (change.delta === 0) {
                visible = `±0 ${unit}`
                spoken = t('measurements.delta.same', { date: since })
              } else {
                const up = change.delta > 0
                visible = `${up ? '+' : '−'}${amount} ${unit}`
                spoken = t(up ? 'measurements.delta.up' : 'measurements.delta.down', {
                  value: amount,
                  unit,
                  date: since,
                })
              }
            }
            return (
              <li
                key={field.key}
                className="measurement-card card"
                data-testid="measurement-latest"
                data-field={field.key}
              >
                <span className="stat-label">{t(`measurements.fields.${field.key}`)}</span>
                <span className="stat-value" data-testid="measurement-latest-value">
                  {formatMeasurement(current.value)} {unit}
                </span>
                <span className="measurement-card-date">
                  {t('measurements.latest.asOf', { date: formatCalendarDate(current.date) })}
                </span>
                {visible !== null ? (
                  <span className="measurement-card-change" data-testid="measurement-latest-change">
                    <span aria-hidden="true">{visible}</span>
                    <span className="visually-hidden">{spoken}</span>
                  </span>
                ) : (
                  <span className="measurement-card-change">{t('measurements.latest.firstEntry')}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
