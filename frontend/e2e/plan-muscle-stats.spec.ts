import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { API, PASSWORD, auth, exerciseIdByGroup, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

type PlanSpec = [group: string, sets: number][]

async function createPlan(request: APIRequestContext, user: ApiUser, name: string, spec: PlanSpec): Promise<string> {
  const entries = []
  for (const [group, sets] of spec) {
    entries.push({ exerciseId: await exerciseIdByGroup(request, user, group), sets, reps: 8 })
  }
  const response = await request.post(`${API}/api/training-plans`, { ...auth(user), data: { name, entries } })
  expect(response.status()).toBe(201)
  return (await response.json()).id
}

async function exerciseNameByGroup(request: APIRequestContext, user: ApiUser, group: string): Promise<string> {
  const id = await exerciseIdByGroup(request, user, group)
  const response = await request.get(`${API}/api/exercises`, auth(user))
  const exercises: { id: string; name: string }[] = await response.json()
  return exercises.find((exercise) => exercise.id === id)!.name
}

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

const parent = (scope: Page | Locator, key: string) => scope.locator(`[data-parent="${key}"]`)
const child = (scope: Page | Locator, group: string) => scope.locator(`[data-group="${group}"]`)

// Test plan risk R11: the planned set counts per muscle group must match what the plan contains.
test('the plan editor shows planned sets per muscle group and updates when the sets field changes', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'planmuscles-editor')
  const planId = await createPlan(request, user, 'Push pull', [['MID_CHEST', 3], ['LATS', 2]])
  const chestName = await exerciseNameByGroup(request, user, 'MID_CHEST')
  await login(page, user)
  await page.goto(`/plans/${planId}`)

  const panel = page.locator('.plan-muscle-stats')
  await expect(panel.getByRole('heading', { name: 'Muscles worked' })).toBeVisible()
  await expect(panel.getByText('5 planned sets in total')).toBeVisible()
  await expect(parent(panel, 'CHEST')).toContainText('3')
  await expect(parent(panel, 'BACK')).toContainText('2')
  await expect(parent(panel, 'CORE')).toContainText('0')

  // Sub-groups stay hidden until the parent is expanded.
  await expect(child(panel, 'MID_CHEST')).toBeHidden()
  await parent(panel, 'CHEST').getByRole('button').click()
  await expect(child(panel, 'MID_CHEST')).toContainText('3')

  await page.getByLabel(`Sets for ${chestName}`).fill('5')
  await expect(panel.getByText('7 planned sets in total')).toBeVisible()
  await expect(parent(panel, 'CHEST')).toContainText('5')
  await expect(child(panel, 'MID_CHEST')).toContainText('5')
})

test("a plans list row expands to that plan's muscle counts and the secondary checkbox adds secondary sets", async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'planmuscles-row')
  await createPlan(request, user, 'Upper A', [['MID_CHEST', 3], ['SIDE_DELTS', 2]])
  await login(page, user)
  await page.goto('/plans')

  const row = page.locator('.plan-item', { hasText: 'Upper A' })
  const toggle = row.getByRole('button', { name: 'Show muscles' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(row.getByRole('button', { name: 'Hide muscles' })).toHaveAttribute('aria-expanded', 'true')

  const stats = row.locator('.plan-muscle-stats')
  await expect(stats.getByText('5 planned sets in total')).toBeVisible()
  await expect(parent(stats, 'CHEST')).toContainText('3')
  await expect(parent(stats, 'SHOULDERS')).toContainText('2')
  await expect(parent(stats, 'LEGS')).toContainText('0')

  await expect(stats).not.toContainText('(+')
  await stats.getByLabel('Include secondary muscles').check()
  await expect(stats.locator('.muscle-secondary-count').first()).toContainText('(+')

  await row.getByRole('button', { name: 'Hide muscles' }).click()
  await expect(stats).toHaveCount(0)
})

test('ticking two plans shows the combined sums and both names, one tick shows the hint', async ({
  page,
  request,
}) => {
  const user = await registerViaApi(request, 'planmuscles-combined')
  await createPlan(request, user, 'Day one', [['MID_CHEST', 3], ['LATS', 2]])
  await createPlan(request, user, 'Day two', [['MID_CHEST', 2], ['SIDE_DELTS', 4]])
  await login(page, user)
  await page.goto('/plans')

  await expect(page.locator('.plan-combined')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Select Day one for combined muscles' }).check()
  await expect(page.getByText('Select 2 or more plans to see their combined muscle breakdown.')).toBeVisible()
  await expect(page.locator('.plan-combined')).toHaveCount(0)

  await page.getByRole('checkbox', { name: 'Select Day two for combined muscles' }).check()
  await expect(page.getByText('Select 2 or more plans')).toHaveCount(0)

  const combined = page.locator('.plan-combined')
  await expect(combined.getByRole('heading', { name: 'Combined muscles worked' })).toBeVisible()
  await expect(combined).toContainText('Included plans:')
  await expect(combined).toContainText('Day one')
  await expect(combined).toContainText('Day two')
  await expect(combined.getByText('11 planned sets in total')).toBeVisible()
  await expect(parent(combined, 'CHEST')).toContainText('5')
  await expect(parent(combined, 'BACK')).toContainText('2')
  await expect(parent(combined, 'SHOULDERS')).toContainText('4')

  await combined.getByLabel('Include secondary muscles').check()
  await expect(combined.locator('.muscle-secondary-count').first()).toContainText('(+')

  await page.getByRole('checkbox', { name: 'Select Day two for combined muscles' }).uncheck()
  await expect(page.locator('.plan-combined')).toHaveCount(0)
  await expect(page.getByText('Select 2 or more plans to see their combined muscle breakdown.')).toBeVisible()
})

test('on a phone the checkbox, name and actions of a plans row stay on one line', async ({ page, request }) => {
  const user = await registerViaApi(request, 'planmuscles-phone')
  await createPlan(request, user, 'Phone plan', [['MID_CHEST', 3]])
  await page.setViewportSize({ width: 390, height: 800 })
  await login(page, user)
  await page.goto('/plans')

  const row = page.locator('.plan-item', { hasText: 'Phone plan' })
  await expect(row).toBeVisible()
  const boxes = await Promise.all([
    row.getByRole('checkbox').boundingBox(),
    row.locator('.plan-item-info').boundingBox(),
    row.getByRole('button', { name: 'Show muscles' }).boundingBox(),
    row.getByRole('link', { name: 'Edit' }).boundingBox(),
    row.getByRole('button', { name: 'Delete' }).boundingBox(),
  ])
  // Compare vertical centres: the name block is two lines tall, the buttons one. A wrapped row would differ by far more.
  const tops = boxes.map((box) => box!.y + box!.height / 2)
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(25)
  const last = boxes[4]!
  expect(last.x + last.width).toBeLessThanOrEqual(390)
})

test('plans of another user never appear in the plans list', async ({ page, request }) => {
  const other = await registerViaApi(request, 'planmuscles-other')
  await createPlan(request, other, 'Secret plan', [['MID_CHEST', 3]])
  const user = await registerViaApi(request, 'planmuscles-own')
  await createPlan(request, user, 'Own plan', [['LATS', 1]])
  await login(page, user)
  await page.goto('/plans')

  await expect(page.locator('.plan-item', { hasText: 'Own plan' })).toBeVisible()
  await expect(page.getByText('Secret plan')).toHaveCount(0)
})
