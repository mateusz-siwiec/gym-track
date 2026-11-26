import type { BodyMeasurement } from '../api/client'

export type MeasurementKey =
  | 'weightKg'
  | 'waistCm'
  | 'chestCm'
  | 'hipsCm'
  | 'armLeftCm'
  | 'armRightCm'
  | 'thighLeftCm'
  | 'thighRightCm'
  | 'calfLeftCm'
  | 'calfRightCm'

export type MeasurementArea = 'weight' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh' | 'calf'

export interface MeasurementField {
  key: MeasurementKey
  unit: 'kg' | 'cm'
  area: MeasurementArea
  /** Only for limbs; both sides share their area's measuring tip. */
  side?: 'left' | 'right'
}

export const MEASUREMENT_FIELDS: readonly MeasurementField[] = [
  { key: 'weightKg', unit: 'kg', area: 'weight' },
  { key: 'waistCm', unit: 'cm', area: 'waist' },
  { key: 'chestCm', unit: 'cm', area: 'chest' },
  { key: 'hipsCm', unit: 'cm', area: 'hips' },
  { key: 'armLeftCm', unit: 'cm', area: 'arm', side: 'left' },
  { key: 'armRightCm', unit: 'cm', area: 'arm', side: 'right' },
  { key: 'thighLeftCm', unit: 'cm', area: 'thigh', side: 'left' },
  { key: 'thighRightCm', unit: 'cm', area: 'thigh', side: 'right' },
  { key: 'calfLeftCm', unit: 'cm', area: 'calf', side: 'left' },
  { key: 'calfRightCm', unit: 'cm', area: 'calf', side: 'right' },
]

export const MEASUREMENT_AREAS: readonly MeasurementArea[] = ['weight', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf']

export interface DatedValue {
  value: number
  /** measuredOn of the entry the value comes from. */
  date: string
}

export type LatestValues = Record<MeasurementKey, DatedValue | null>

export interface Change {
  /** latest minus previous, rounded to two decimals. */
  delta: number
  latest: DatedValue
  previous: DatedValue
}

export type ChartWindow = number | 'all'

export interface ChartPoint {
  date: string
  value: number
}

export interface ChartSeries {
  key: MeasurementKey
  side?: 'left' | 'right'
  points: ChartPoint[]
}

/** Newest first: by date, then by creation time for several entries on the same date. */
export function newestFirst(a: BodyMeasurement, b: BodyMeasurement): number {
  if (a.measuredOn !== b.measuredOn) return a.measuredOn < b.measuredOn ? 1 : -1
  const ka = instantKey(a.createdAt)
  const kb = instantKey(b.createdAt)
  return ka === kb ? 0 : ka < kb ? 1 : -1
}

/**
 * ISO instants carry 0, 3, 6 or 9 fraction digits, so plain string comparison is wrong
 * ("…05.123Z" > "…05.123456Z") and Date.parse drops micros. Pad the fraction to 9 digits.
 */
function instantKey(iso: string): string {
  const match = /^(.*?)(?:\.(\d+))?Z$/.exec(iso)
  return match ? `${match[1]}.${(match[2] ?? '').padEnd(9, '0')}` : iso
}

/** Values of the field from entries that are already sorted newest first. */
function valuesFromSorted(sorted: readonly BodyMeasurement[], field: MeasurementKey): DatedValue[] {
  return sorted.flatMap((entry) => {
    const value = entry[field]
    return value === null || value === undefined ? [] : [{ value, date: entry.measuredOn }]
  })
}

/** Entries that carry a value for the field, newest first. */
function valuesFor(entries: readonly BodyMeasurement[], field: MeasurementKey): DatedValue[] {
  return valuesFromSorted([...entries].sort(newestFirst), field)
}

function changeOf([latest, previous]: DatedValue[]): Change | null {
  if (!latest || !previous) return null
  return { delta: Math.round((latest.value - previous.value) * 100) / 100, latest, previous }
}

/** The newest non-null value of every field (entries are sparse), or null when it was never recorded. */
export function latestValues(entries: readonly BodyMeasurement[]): LatestValues {
  const result = {} as LatestValues
  for (const { key } of MEASUREMENT_FIELDS) {
    result[key] = valuesFor(entries, key)[0] ?? null
  }
  return result
}

/** Latest value versus the previous entry that has the field; null when there is no previous one. */
export function changeFromPrevious(entries: readonly BodyMeasurement[], field: MeasurementKey): Change | null {
  return changeOf(valuesFor(entries, field))
}

/** Latest value and change of every field, sorting the entries only once. */
export function latestSummary(
  entries: readonly BodyMeasurement[],
): Record<MeasurementKey, { latest: DatedValue | null; change: Change | null }> {
  const sorted = [...entries].sort(newestFirst)
  const result = {} as Record<MeasurementKey, { latest: DatedValue | null; change: Change | null }>
  for (const { key } of MEASUREMENT_FIELDS) {
    const values = valuesFromSorted(sorted, key)
    result[key] = { latest: values[0] ?? null, change: changeOf(values) }
  }
  return result
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Entries from the last `days` days: measuredOn on or after `today` minus `days` days (boundary day
 * included). `today` is a YYYY-MM-DD calendar date passed in so callers and tests control the clock.
 */
export function filterWindow(
  entries: readonly BodyMeasurement[],
  days: ChartWindow,
  today: string,
): BodyMeasurement[] {
  if (days === 'all') return [...entries]
  const from = shiftDate(today, -days)
  return entries.filter((entry) => entry.measuredOn >= from)
}

/**
 * Chart data for one area, ascending by date. A limb yields one series per side that has data; for
 * a same-day tie the entry created later comes last.
 */
export function chartSeries(
  entries: readonly BodyMeasurement[],
  area: MeasurementArea,
  window: ChartWindow,
  today: string,
): ChartSeries[] {
  const inWindow = filterWindow(entries, window, today)
  return MEASUREMENT_FIELDS.filter((field) => field.area === area).flatMap((field) => {
    const points = valuesFor(inWindow, field.key)
      .reverse()
      .map(({ date, value }) => ({ date, value }))
    return points.length > 0 ? [{ key: field.key, side: field.side, points }] : []
  })
}

/** Accepts "72.5" and "72,5"; returns null for empty, non-numeric or negative text. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export interface FieldLimits {
  min: number
  max: number
  /** Maximum digits after the decimal point. */
  decimals: number
}

/** Mirrors the backend bounds in BodyMeasurementRequest. */
export function limitsFor(field: MeasurementKey): FieldLimits {
  return field === 'weightKg' ? { min: 20, max: 500, decimals: 2 } : { min: 5, max: 300, decimals: 1 }
}

export type RangeProblem = 'min' | 'max' | 'decimals'

/** null when the value is acceptable for the field. */
export function checkRange(field: MeasurementKey, value: number): RangeProblem | null {
  const limits = limitsFor(field)
  if (value < limits.min) return 'min'
  if (value > limits.max) return 'max'
  const scaled = value * 10 ** limits.decimals
  if (Math.abs(scaled - Math.round(scaled)) > 1e-9) return 'decimals'
  return null
}
