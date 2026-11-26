import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { setTargetWeight } from '../api/client'
import { checkRange, parseDecimal } from '../utils/bodyMeasurements'
import { translateError } from '../utils/errors'
import { formatMeasurement } from '../utils/format'

interface TargetWeightProps {
  targetWeightKg: number | null
  /** Newest recorded weight, or null when there is none yet. */
  latestWeightKg: number | null
  onChange: (target: number | null) => void
}

export default function TargetWeight({ targetWeightKg, latestWeightKg, onChange }: TargetWeightProps) {
  const { t } = useTranslation()
  // Plain dot notation so the text round-trips through parseDecimal in any language.
  const [text, setText] = useState(targetWeightKg === null ? '' : String(targetWeightKg))
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [serverError, setServerError] = useState<unknown>(null)

  async function submit(value: number | null) {
    setServerError(null)
    setSaving(true)
    try {
      const stored = await setTargetWeight(value)
      setText(stored === null ? '' : String(stored))
      onChange(stored)
    } catch (err) {
      setServerError(err)
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseDecimal(text)
    if (parsed === null || checkRange('weightKg', parsed) !== null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    void submit(parsed)
  }

  function handleClear() {
    setInvalid(false)
    void submit(null)
  }

  let progress = null
  if (targetWeightKg !== null) {
    if (latestWeightKg === null) {
      progress = t('measurements.target.noWeight')
    } else {
      const diff = Math.round((latestWeightKg - targetWeightKg) * 100) / 100
      progress =
        diff === 0
          ? t('measurements.target.reached')
          : t(diff > 0 ? 'measurements.target.above' : 'measurements.target.below', { value: formatMeasurement(Math.abs(diff)) })
    }
  }

  return (
    <section aria-label={t('measurements.target.title')} data-testid="target-weight">
      <h2>{t('measurements.target.title')}</h2>
      <p className="page-subtext" data-testid="target-weight-current">
        {targetWeightKg === null ? t('measurements.target.none') : t('measurements.target.current', { value: formatMeasurement(targetWeightKg) })}
      </p>
      {progress && (
        <p className="measurement-target-progress" data-testid="target-weight-progress">
          {progress}
        </p>
      )}
      <form className="measurement-target-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="target-weight-input">{t('measurements.target.label')}</label>
          <input
            id="target-weight-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            data-testid="target-weight-input"
            value={text}
            disabled={saving}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? 'target-weight-error' : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          {invalid && (
            <p className="error-text measurement-field-error" id="target-weight-error">
              {t('measurements.target.invalid')}
            </p>
          )}
        </div>
        {serverError !== null && (
          <p className="error-text" role="alert">
            {translateError(serverError, 'measurements.target.saveFailed')}
          </p>
        )}
        <div className="measurement-form-actions">
          <button type="submit" className="btn-primary" disabled={saving} data-testid="target-weight-save">
            {saving ? t('common.saving') : targetWeightKg === null ? t('measurements.target.set') : t('measurements.target.update')}
          </button>
          {targetWeightKg !== null && (
            <button type="button" className="btn-secondary" disabled={saving} data-testid="target-weight-clear" onClick={handleClear}>
              {t('measurements.target.clear')}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
