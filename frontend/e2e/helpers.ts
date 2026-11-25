import type { APIRequestContext } from '@playwright/test'

export const API = 'http://localhost:8080'
export const PASSWORD = 'Passw0rd-e2e!'

export interface ApiUser {
  email: string
  token: string
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

export async function registerViaApi(request: APIRequestContext, prefix: string): Promise<ApiUser> {
  const email = uniqueEmail(prefix)
  const response = await request.post(`${API}/api/auth/register`, { data: { email, password: PASSWORD } })
  if (response.status() !== 201) {
    throw new Error(`register failed: ${response.status()}`)
  }
  const body = await response.json()
  return { email, token: body.token }
}

export function auth(user: ApiUser) {
  return { headers: { Authorization: `Bearer ${user.token}` } }
}

export async function exerciseId(request: APIRequestContext, user: ApiUser, name: string): Promise<string> {
  const response = await request.get(`${API}/api/exercises`, auth(user))
  const exercises: { id: string; name: string }[] = await response.json()
  const match = exercises.find((exercise) => exercise.name === name)
  if (!match) {
    throw new Error(`exercise not found: ${name}`)
  }
  return match.id
}

export interface ExerciseSettings {
  measure?: 'REPS' | 'DURATION'
  weightMode?: 'REQUIRED' | 'OPTIONAL' | 'NONE'
}

/** Creates a custom exercise with the given measure and weight mode and returns its id. */
export async function createExerciseViaApi(
  request: APIRequestContext,
  user: ApiUser,
  name: string,
  settings: ExerciseSettings = {},
): Promise<string> {
  const response = await request.post(`${API}/api/exercises`, {
    ...auth(user),
    data: { name, primaryMuscleGroup: 'ABS', secondaryMuscleGroups: [], ...settings },
  })
  if (response.status() !== 201) {
    throw new Error(`create exercise failed: ${response.status()}`)
  }
  return (await response.json()).id
}

export async function exerciseIdByGroup(request: APIRequestContext, user: ApiUser, group: string): Promise<string> {
  const response = await request.get(`${API}/api/exercises`, auth(user))
  // Prefer a weight-required exercise: specs log weighted sets, which weight-free (NONE) exercises reject.
  const exercises: { id: string; primaryMuscleGroup: string; weightMode: string }[] = await response.json()
  const inGroup = exercises.filter((exercise) => exercise.primaryMuscleGroup === group)
  const match = inGroup.find((exercise) => exercise.weightMode === 'REQUIRED') ?? inGroup[0]
  if (!match) {
    throw new Error(`no exercise for group: ${group}`)
  }
  return match.id
}

/** The calendar date `daysAgo` days before today in the browser's local time, as YYYY-MM-DD (matches the app's own "today"). */
export function localDate(daysAgo = 0): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export interface MeasurementValues {
  weightKg?: number
  waistCm?: number
  chestCm?: number
  hipsCm?: number
  armLeftCm?: number
  armRightCm?: number
  thighLeftCm?: number
  thighRightCm?: number
  calfLeftCm?: number
  calfRightCm?: number
}

/** Creates a body measurement entry (omitted fields stay empty) and returns its id. */
export async function createMeasurementViaApi(
  request: APIRequestContext,
  user: ApiUser,
  measuredOn: string,
  values: MeasurementValues,
): Promise<string> {
  const response = await request.post(`${API}/api/body-measurements`, {
    ...auth(user),
    data: { measuredOn, ...values },
  })
  if (response.status() !== 201) {
    throw new Error(`create measurement failed: ${response.status()}`)
  }
  return (await response.json()).id
}

export async function listMeasurementsViaApi(
  request: APIRequestContext,
  user: ApiUser,
): Promise<{
  targetWeightKg: number | null
  entries: { id: string; measuredOn: string; weightKg: number | null; waistCm: number | null }[]
}> {
  const response = await request.get(`${API}/api/body-measurements`, auth(user))
  return response.json()
}
