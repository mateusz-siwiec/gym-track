import { useTranslation } from 'react-i18next'
import type { Exercise } from '../api/client'
import { exerciseName, exerciseTechnique } from '../utils/exercises'
import InfoTooltip from './InfoTooltip'
import MuscleMap from './MuscleMap'

interface TechniqueTooltipProps {
  exercise: Pick<Exercise, 'slug' | 'name' | 'primaryMuscleGroup' | 'secondaryMuscleGroups'>
}

/**
 * Info button that reveals the form cues for an exercise. Shows the muscle map and, for seeded exercises, the cues;
 * renders nothing when there is neither. Open/close and positioning behaviour lives in InfoTooltip.
 */
export default function TechniqueTooltip({ exercise }: TechniqueTooltipProps) {
  const { t } = useTranslation()
  const cues = exerciseTechnique(exercise)
  if (!cues && !exercise.primaryMuscleGroup) return null

  const name = exerciseName(exercise)
  return (
    <InfoTooltip
      title={name}
      triggerLabel={cues ? t('exercises.techniqueLabel', { name }) : t('exercises.musclesLabel', { name })}
      closeLabel={t('exercises.closeInfo')}
    >
      {exercise.primaryMuscleGroup && (
        <>
          <p className="technique-heading">{t('exercises.musclesHeading')}</p>
          <MuscleMap primary={exercise.primaryMuscleGroup} secondary={exercise.secondaryMuscleGroups} />
        </>
      )}
      {cues && (
        <div className={exercise.primaryMuscleGroup ? 'technique-cues' : undefined}>
          <p className="technique-heading">{t('exercises.techniqueHeading')}</p>
          <ul className="technique-list">
            {cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </div>
      )}
    </InfoTooltip>
  )
}
