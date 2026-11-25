import { describe, expect, it } from 'vitest'
import type { BodyMeasurement } from '../api/client'
import {
  chartSeries,
  changeFromPrevious,
  checkRange,
  filterWindow,
  latestValues,
  MEASUREMENT_FIELDS,
  parseDecimal,
} from './bodyMeasurements'

const TODAY = '2026-06-30'

let counter = 0
function entry(measuredOn: string, values: Partial<BodyMeasurement> = {}): BodyMeasurement {
  counter += 1
  const stamp = `2026-01-01T00:00:${String(counter).padStart(2, '0')}Z`
  return {
    id: `id-${counter}`,
    measuredOn,
    weightKg: null,
    waistCm: null,
    chestCm: null,
    hipsCm: null,
    armLeftCm: null,
    armRightCm: null,
    thighLeftCm: null,
    thighRightCm: null,
    calfLeftCm: null,
    calfRightCm: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...values,
  }
}

describe('MEASUREMENT_FIELDS', () => {
  it('describes weight in kg and the rest in cm, with sides only on limbs', () => {
    expect(MEASUREMENT_FIELDS).toHaveLength(10)
    expect(MEASUREMENT_FIELDS.filter((f) => f.unit === 'kg').map((f) => f.key)).toEqual(['weightKg'])
    expect(MEASUREMENT_FIELDS.filter((f) => f.side).every((f) => ['arm', 'thigh', 'calf'].includes(f.area))).toBe(true)
  })
})

describe('latestValues', () => {
  it('takes the newest non-null value per field from sparse entries', () => {
    const entries = [
      entry('2026-06-01', { weightKg: 80, waistCm: 90 }),
      entry('2026-06-10', { weightKg: 79 }),
      entry('2026-06-20', { chestCm: 100 }),
    ]
    const latest = latestValues(entries)
    expect(latest.weightKg).toEqual({ value: 79, date: '2026-06-10' })
    expect(latest.waistCm).toEqual({ value: 90, date: '2026-06-01' })
    expect(latest.chestCm).toEqual({ value: 100, date: '2026-06-20' })
    expect(latest.hipsCm).toBeNull()
  })

  it('prefers the later-created entry when several share a date', () => {
    const first = entry('2026-06-10', { weightKg: 80 })
    const second = entry('2026-06-10', { weightKg: 79.5 })
    expect(latestValues([second, first]).weightKg?.value).toBe(79.5)
    expect(latestValues([first, second]).weightKg?.value).toBe(79.5)
  })

  it('returns all nulls without entries', () => {
    expect(Object.values(latestValues([])).every((v) => v === null)).toBe(true)
  })
})

describe('changeFromPrevious', () => {
  it('compares the latest value with the previous entry that has the field', () => {
    const entries = [
      entry('2026-06-01', { weightKg: 80 }),
      entry('2026-06-05', { waistCm: 90 }),
      entry('2026-06-10', { weightKg: 79.4 }),
    ]
    const change = changeFromPrevious(entries, 'weightKg')
    expect(change?.delta).toBe(-0.6)
    expect(change?.previous.date).toBe('2026-06-01')
    expect(change?.latest.date).toBe('2026-06-10')
  })

  it('is null when there is no previous value or no value at all', () => {
    const entries = [entry('2026-06-01', { weightKg: 80 })]
    expect(changeFromPrevious(entries, 'weightKg')).toBeNull()
    expect(changeFromPrevious(entries, 'waistCm')).toBeNull()
  })

  it('uses a same-date entry as the previous value', () => {
    const entries = [entry('2026-06-10', { weightKg: 80 }), entry('2026-06-10', { weightKg: 81 })]
    expect(changeFromPrevious(entries, 'weightKg')?.delta).toBe(1)
  })
})

describe('filterWindow', () => {
  const entries = [entry('2026-05-30'), entry('2026-05-31'), entry('2026-06-01'), entry('2026-06-30'), entry('2026-07-01')]

  it('includes the boundary day and everything after it', () => {
    // 30 days before 2026-06-30 is 2026-05-31.
    expect(filterWindow(entries, 30, TODAY).map((e) => e.measuredOn)).toEqual([
      '2026-05-31',
      '2026-06-01',
      '2026-06-30',
      '2026-07-01',
    ])
    expect(filterWindow(entries, 29, TODAY).map((e) => e.measuredOn)).toEqual(['2026-06-01', '2026-06-30', '2026-07-01'])
  })

  it('returns everything for all', () => {
    expect(filterWindow(entries, 'all', TODAY)).toHaveLength(5)
  })

  it('crosses year boundaries', () => {
    const e = [entry('2025-12-29'), entry('2025-12-30'), entry('2025-12-31')]
    expect(filterWindow(e, 7, '2026-01-06').map((x) => x.measuredOn)).toEqual(['2025-12-30', '2025-12-31'])
  })
})

describe('chartSeries', () => {
  const entries = [
    entry('2026-06-20', { armLeftCm: 35, armRightCm: 36 }),
    entry('2026-06-10', { armLeftCm: 34 }),
    entry('2026-06-15', { weightKg: 80 }),
  ]

  it('returns one ascending series per side for limbs, pairing left and right', () => {
    const series = chartSeries(entries, 'arm', 'all', TODAY)
    expect(series.map((s) => [s.key, s.side])).toEqual([
      ['armLeftCm', 'left'],
      ['armRightCm', 'right'],
    ])
    expect(series[0].points).toEqual([
      { date: '2026-06-10', value: 34 },
      { date: '2026-06-20', value: 35 },
    ])
    expect(series[1].points).toEqual([{ date: '2026-06-20', value: 36 }])
  })

  it('applies the window and omits series without data', () => {
    expect(chartSeries(entries, 'weight', 5, TODAY)).toHaveLength(0)
    expect(chartSeries(entries, 'arm', 15, TODAY)[0].points).toHaveLength(1)
  })

  it('returns a single series without a side for non-limb areas', () => {
    const series = chartSeries(entries, 'weight', 'all', TODAY)
    expect(series).toHaveLength(1)
    expect(series[0].side).toBeUndefined()
  })

  it('keeps several entries on one date in creation order', () => {
    const a = entry('2026-06-10', { weightKg: 80 })
    const b = entry('2026-06-10', { weightKg: 79 })
    expect(chartSeries([b, a], 'weight', 'all', TODAY)[0].points.map((p) => p.value)).toEqual([80, 79])
  })
})

describe('parseDecimal', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseDecimal('72.5')).toBe(72.5)
    expect(parseDecimal('72,5')).toBe(72.5)
    expect(parseDecimal(' 80 ')).toBe(80)
    expect(parseDecimal('.5')).toBe(0.5)
  })

  it('rejects empty, non-numeric and negative text', () => {
    for (const text of ['', '   ', 'abc', '1,2,3', '1.2.3', '-5', '12kg', '.', ',']) {
      expect(parseDecimal(text)).toBeNull()
    }
  })
})

describe('checkRange', () => {
  it('applies the weight limits 20-500', () => {
    expect(checkRange('weightKg', 19.99)).toBe('min')
    expect(checkRange('weightKg', 20)).toBeNull()
    expect(checkRange('weightKg', 500)).toBeNull()
    expect(checkRange('weightKg', 500.01)).toBe('max')
  })

  it('applies the circumference limits 5-300', () => {
    expect(checkRange('waistCm', 4.9)).toBe('min')
    expect(checkRange('waistCm', 5)).toBeNull()
    expect(checkRange('calfRightCm', 300)).toBeNull()
    expect(checkRange('calfRightCm', 300.1)).toBe('max')
  })

  it('limits decimal places: 2 for weight, 1 for circumferences', () => {
    expect(checkRange('weightKg', 72.55)).toBeNull()
    expect(checkRange('weightKg', 72.555)).toBe('decimals')
    expect(checkRange('hipsCm', 90.5)).toBeNull()
    expect(checkRange('hipsCm', 90.55)).toBe('decimals')
  })
})
