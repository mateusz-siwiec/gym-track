import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createBodyMeasurement, updateBodyMeasurement } from '../api/client'
import type { BodyMeasurement, BodyMeasurementInput } from '../api/client'
import InfoTooltip from './InfoTooltip'
import { checkRange, limitsFor, MEASUREMENT_FIELDS, parseDecimal } from '../utils/bodyMeasurements'
import type { MeasurementArea, MeasurementField, MeasurementKey } from '../utils/bodyMeasurements'
import { translateError } from '../utils/errors'
import { formatMeasurement, localToday } from '../utils/format'

const MIN_DATE = '1950-01-01'

type Values = Record<MeasurementKey, string>

const TRUNK_AREAS: readonly MeasurementArea[] = ['waist', 'chest', 'hips']

const GROUPS: readonly { id: 'weight' | 'trunk' | 'limbs'; fields: MeasurementField[] }[] = [
  { id: 'weight', fields: MEASUREMENT_FIELDS.filter((f) => f.area === 'weight') },
  { id: 'trunk', fields: MEASUREMENT_FIELDS.filter((f) => TRUNK_AREAS.includes(f.area)) },
  { id: 'limbs', fields: MEASUREMENT_FIELDS.filter((f) => f.area !== 'weight' && !TRUNK_AREAS.includes(f.area)) },
]

// Tip steps are an array in the locale files, so the key is built at runtime and read with returnObjects.
type TranslateObject = (key: string, options: { returnObjects: true }) => unknown

function emptyValues(): Values {
  return Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, ''])) as Values
}

function valuesFrom(entry: BodyMeasurement | null): Values {
  const values = emptyValues()
  if (!entry) return values
  for (const { key } of MEASUREMENT_FIELDS) {
    const value = entry[key]
    // Plain dot notation so the text round-trips through parseDecimal in any language.
    values[key] = value === null ? '' : String(value)
  }
  return values
}

interface MeasurementFormProps {
  /** The entry being edited; null creates a new one. Key the component by entry id so switching resets the fields. */
  entry: BodyMeasurement | null
  onSaved: (entry: BodyMeasurement, wasEdit: boolean) => void
  onCancel: () => void
}

export default function MeasurementForm({ entry, onSaved, onCancel }: MeasurementFormProps) {
  const { t, i18n } = useTranslation()
  const today = localToday()
  const [date, setDate] = useState(entry?.measuredOn ?? today)
  const [values, setValues] = useState<Values>(() => valuesFrom(entry))
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<unknown>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const translateObject = i18n.t.bind(i18n) as unknown as TranslateObject

  const entryId = entry?.id
  useEffect(() => {
    if (entryId) dateRef.current?.focus()
  }, [entryId])

  const fieldErrors: Partial<Record<MeasurementKey, string>> = {}
  for (const { key, unit } of MEASUREMENT_FIELDS) {
    const text = values[key].trim()
    if (text === '') continue
    const label = t(`measurements.fields.${key}`)
    const parsed = parseDecimal(text)
    if (parsed === null) {
      fieldErrors[key] = t('measurements.form.invalidNumber', { field: label })
      continue
    }
    const problem = checkRange(key, parsed)
    const limits = limitsFor(key)
    if (problem === 'decimals') {
      fieldErrors[key] = t('measurements.form.tooManyDecimals', { field: label, count: limits.decimals })
    } else if (problem) {
      fieldErrors[key] = t('measurements.form.outOfRange', {
        field: label,
        min: formatMeasurement(limits.min),
        max: formatMeasurement(limits.max),
        unit: t(`measurements.units.${unit}`),
      })
    }
  }
  let dateError: string | null = null
  if (!date) dateError = t('measurements.form.dateRequired')
  else if (date < MIN_DATE) dateError = t('measurements.form.dateTooEarly')
  else if (date > today) dateError = t('measurements.form.dateInFuture')
  const noneError = MEASUREMENT_FIELDS.some(({ key }) => values[key].trim() !== '')
    ? null
    : t('measurements.form.atLeastOne')
  const invalid = Object.keys(fieldErrors).length > 0 || dateError !== null || noneError !== null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (invalid) return
    const input = { measuredOn: date } as BodyMeasurementInput
    for (const { key } of MEASUREMENT_FIELDS) {
      // Empty fields go out as null so an edit can clear a value.
      input[key] = parseDecimal(values[key])
    }
    setSaving(true)
    try {
      const saved = entry ? await updateBodyMeasurement(entry.id, input) : await createBodyMeasurement(input)
      if (!entry) {
        setValues(emptyValues())
        setSubmitted(false)
      }
      onSaved(saved, entry !== null)
    } catch (err) {
      setServerError(err)
    } finally {
      setSaving(false)
    }
  }

  function renderField(field: MeasurementField) {
    const id = `measurement-${field.key}`
    const errorId = `${id}-error`
    const error = submitted ? fieldErrors[field.key] : undefined
    const steps = translateObject(`measurements.tips.${field.area}.steps`, { returnObjects: true })
    return (
      <div className="field measurement-field" key={field.key}>
        <div className="measurement-label-row">
          <label htmlFor={id}>
            {t(`measurements.fields.${field.key}`)} ({t(`measurements.units.${field.unit}`)})
          </label>
          <InfoTooltip
            title={t(`measurements.tips.${field.area}.title`)}
            triggerLabel={`${t('measurements.tips.show')}: ${t(`measurements.fields.${field.key}`)}`}
            closeLabel={t('measurements.tips.hide')}
          >
            {Array.isArray(steps) && (
              <ul className="technique-list">
                {steps.map((step) => (
                  <li key={String(step)}>{String(step)}</li>
                ))}
              </ul>
            )}
          </InfoTooltip>
        </div>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t('measurements.form.placeholder')}
          data-testid={id}
          value={values[field.key]}
          disabled={saving}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setValues((current) => ({ ...current, [field.key]: e.target.value }))}
        />
        {error && (
          <p className="error-text measurement-field-error" id={errorId}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <form className="measurement-form card" onSubmit={handleSubmit} noValidate data-testid="measurement-form">
      <h2>{entry ? t('measurements.form.editTitle') : t('measurements.form.title')}</h2>
      <p className="page-subtext">{t('measurements.form.hint')}</p>
      <div className="field">
        <label htmlFor="measurement-date">{t('measurements.fields.date')}</label>
        <input
          id="measurement-date"
          ref={dateRef}
          type="date"
          data-testid="measurement-date"
          value={date}
          min={MIN_DATE}
          max={today}
          disabled={saving}
          aria-invalid={submitted && dateError ? true : undefined}
          aria-describedby={submitted && dateError ? 'measurement-date-error' : undefined}
          onChange={(e) => setDate(e.target.value)}
        />
        {submitted && dateError && (
          <p className="error-text measurement-field-error" id="measurement-date-error">
            {dateError}
          </p>
        )}
      </div>
      {GROUPS.map((group) => (
        <fieldset className="measurement-group" key={group.id}>
          <legend>
            {group.id === 'weight' ? t('measurements.areas.weight') : t(`measurements.form.groups.${group.id}`)}
          </legend>
          <div className="measurement-group-fields">{group.fields.map(renderField)}</div>
        </fieldset>
      ))}
      {submitted && noneError && (
        <p className="error-text" role="alert">
          {noneError}
        </p>
      )}
      {serverError !== null && (
        <p className="error-text" role="alert">
          {translateError(serverError, 'measurements.saveFailed')}
        </p>
      )}
      <div className="measurement-form-actions">
        <button type="submit" className="btn-primary" disabled={saving} data-testid="measurement-submit">
          {saving ? t('common.saving') : entry ? t('measurements.form.save') : t('measurements.form.add')}
        </button>
        {entry && (
          <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
            {t('measurements.form.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
