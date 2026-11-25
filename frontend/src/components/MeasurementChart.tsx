import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BodyMeasurement } from '../api/client'
import { chartSeries, MEASUREMENT_AREAS } from '../utils/bodyMeasurements'
import type { ChartWindow, MeasurementArea } from '../utils/bodyMeasurements'
import { formatCalendarDate, formatMeasurement, localToday } from '../utils/format'
import { axisProps, gridProps, secondSeriesColor, seriesColor, targetLineColor, tooltipProps } from './chartTheme'

const WINDOWS: readonly ChartWindow[] = [7, 30, 90, 'all']

interface MeasurementChartProps {
  entries: readonly BodyMeasurement[]
  targetWeightKg: number | null
}

type Row = { date: string } & Record<string, number | string>

export default function MeasurementChart({ entries, targetWeightKg }: MeasurementChartProps) {
  const { t } = useTranslation() // also re-renders on language change so dates and numbers are reformatted
  const [area, setArea] = useState<MeasurementArea>('weight')
  const [window, setWindow] = useState<ChartWindow>(30)

  const series = chartSeries(entries, area, window, localToday())
  const unit = t(`measurements.units.${area === 'weight' ? 'kg' : 'cm'}`)
  const areaLabel = t(`measurements.areas.${area}`)
  const showTarget = area === 'weight' && targetWeightKg !== null

  // One row per date; a limb's two sides share the row so the lines connect across missing days.
  const byDate = new Map<string, Row>()
  for (const s of series) {
    for (const point of s.points) {
      const row = byDate.get(point.date) ?? { date: point.date }
      row[s.key] = point.value
      byDate.set(point.date, row)
    }
  }
  const rows = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  function seriesName(side?: 'left' | 'right'): string {
    return side ? t(`measurements.chart.${side}`) : areaLabel
  }

  const rangeLabel = window === 'all' ? t('measurements.chart.windowAll') : t('measurements.chart.windowDays', { days: window })
  const latestParts = series.map((s) => {
    const last = s.points[s.points.length - 1]
    return `${seriesName(s.side)} ${formatMeasurement(last.value)} ${unit}`
  })
  const summary = t('measurements.chart.summary', { area: areaLabel, range: rangeLabel, latest: latestParts.join(', ') })

  let body
  if (rows.length === 0) {
    body = <p className="page-subtext">{t('measurements.chart.noData')}</p>
  } else {
    const domain: [(min: number) => number, (max: number) => number] = [
      (min) => Math.floor(showTarget ? Math.min(min, targetWeightKg) : min),
      (max) => Math.ceil(showTarget ? Math.max(max, targetWeightKg) : max),
    ]
    body = (
      <div className="progression-chart-body" role="img" aria-label={summary} data-testid="measurement-chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatCalendarDate} {...axisProps} />
            <YAxis unit={` ${unit}`} width={64} domain={domain} allowDecimals {...axisProps} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(label) => formatCalendarDate(String(label))}
              formatter={(value, name) => [`${formatMeasurement(Number(value))} ${unit}`, name]}
            />
            {series.length > 1 && <Legend />}
            {showTarget && (
              <ReferenceLine
                y={targetWeightKg}
                stroke={targetLineColor}
                strokeDasharray="6 4"
                label={{ value: t('measurements.chart.target'), position: 'insideTopRight', fill: targetLineColor, fontSize: 12 }}
              />
            )}
            {series.map((s, index) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={seriesName(s.side)}
                stroke={index === 0 ? seriesColor : secondSeriesColor}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <section className="progression-chart" data-testid="measurement-chart">
      <h2>{t('measurements.chart.title')}</h2>
      <div className="field">
        <label htmlFor="measurement-chart-select">{t('measurements.chart.area')}</label>
        <select
          id="measurement-chart-select"
          className="workout-select"
          data-testid="measurement-chart-select"
          value={area}
          onChange={(e) => setArea(e.target.value as MeasurementArea)}
        >
          {MEASUREMENT_AREAS.map((a) => (
            <option key={a} value={a}>
              {t(`measurements.areas.${a}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="dashboard-toggle" role="group" aria-label={t('measurements.chart.window')}>
        {WINDOWS.map((value) => (
          <button
            key={value}
            type="button"
            className="btn-secondary"
            data-testid={`measurement-window-${value}`}
            aria-pressed={window === value}
            onClick={() => setWindow(value)}
          >
            {value === 'all' ? t('measurements.chart.windowAll') : t('measurements.chart.windowDays', { days: value })}
          </button>
        ))}
      </div>
      <div aria-live="polite">{body}</div>
    </section>
  )
}
