import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { API, PASSWORD, auth, createMeasurementViaApi, listMeasurementsViaApi, localDate, registerViaApi } from './helpers.js'
import type { ApiUser } from './helpers.js'

async function login(page: Page, user: ApiUser) {
  await page.addInitScript(() => localStorage.setItem('gymtrack.lang', 'en'))
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

/** Logs in and opens the page through the navigation link. */
async function openMeasurements(page: Page, user: ApiUser) {
  await login(page, user)
  await page.getByRole('link', { name: 'Measurements', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Body measurements', level: 1 })).toBeVisible()
}

const entries = (page: Page) => page.getByTestId('measurement-entry')
const field = (page: Page, key: string) => page.getByTestId(`measurement-${key}`)
const latestCard = (page: Page, key: string) => page.locator(`[data-testid="measurement-latest"][data-field="${key}"]`)
const MINUS = '−'

test('the nav link opens the page and a logged entry shows in history and in the latest cards', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-log')
  await openMeasurements(page, user)
  await expect(page).toHaveURL(/\/measurements$/)
  await expect(page.getByText('No measurements yet.')).toBeVisible()
  await expect(page.getByTestId('measurement-date')).toHaveValue(localDate())

  await field(page, 'weightKg').fill('72.5')
  await field(page, 'waistCm').fill('80')
  await page.getByTestId('measurement-submit').click()

  await expect(entries(page)).toHaveCount(1)
  await expect(entries(page).first()).toHaveAttribute('data-date', localDate())
  await expect(entries(page).first().locator('[data-field="weightKg"]')).toContainText('72.5 kg')
  await expect(entries(page).first().locator('[data-field="waistCm"]')).toContainText('80 cm')
  await expect(entries(page).first().locator('[data-field="chestCm"]')).toHaveCount(0)
  // The form is emptied for the next entry.
  await expect(field(page, 'weightKg')).toHaveValue('')
  await expect(page.getByTestId('measurement-latest')).toHaveCount(2)
  await expect(latestCard(page, 'weightKg').getByTestId('measurement-latest-value')).toHaveText('72.5 kg')
  await expect(latestCard(page, 'waistCm').getByTestId('measurement-latest-value')).toHaveText('80 cm')
  await expect(page.getByText('First measurement')).toHaveCount(2)

  const stored = await listMeasurementsViaApi(request, user)
  expect(stored.entries).toHaveLength(1)
  expect(stored.entries[0].weightKg).toBe(72.5)
})

test('the latest card shows the value and the change from the previous entry', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-latest')
  await createMeasurementViaApi(request, user, localDate(3), { weightKg: 80, waistCm: 90 })
  await createMeasurementViaApi(request, user, localDate(0), { weightKg: 78.5 })
  await openMeasurements(page, user)

  const weight = latestCard(page, 'weightKg')
  await expect(weight.getByTestId('measurement-latest-value')).toHaveText('78.5 kg')
  await expect(weight.getByTestId('measurement-latest-change')).toContainText(`${MINUS}1.5 kg`)
  await expect(weight.getByTestId('measurement-latest-change')).toContainText('Down 1.5 kg since')
  // Waist exists only in the older entry: it stays the latest value and has nothing to compare with.
  const waist = latestCard(page, 'waistCm')
  await expect(waist.getByTestId('measurement-latest-value')).toHaveText('90 cm')
  await expect(waist).toContainText('First measurement')
  // Newest entry first in the history.
  await expect(entries(page).nth(0)).toHaveAttribute('data-date', localDate(0))
  await expect(entries(page).nth(1)).toHaveAttribute('data-date', localDate(3))
})

test('editing an entry can change a value and clear another', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-edit')
  const id = await createMeasurementViaApi(request, user, localDate(1), { weightKg: 80, waistCm: 90 })
  await openMeasurements(page, user)

  await entries(page).first().getByTestId('measurement-edit').click()
  await expect(page.getByRole('heading', { name: 'Edit measurement' })).toBeVisible()
  await expect(entries(page).first()).toHaveAttribute('data-editing', '')
  await expect(field(page, 'weightKg')).toHaveValue('80')
  await expect(field(page, 'waistCm')).toHaveValue('90')

  await field(page, 'weightKg').fill('79.5')
  await field(page, 'waistCm').fill('')
  await page.getByTestId('measurement-submit').click()

  await expect(page.getByRole('heading', { name: 'Add measurement' })).toBeVisible()
  await expect(entries(page)).toHaveCount(1)
  await expect(entries(page).first()).not.toHaveAttribute('data-editing', '')
  await expect(entries(page).first().locator('[data-field="weightKg"]')).toContainText('79.5 kg')
  await expect(entries(page).first().locator('[data-field="waistCm"]')).toHaveCount(0)
  await expect(latestCard(page, 'waistCm')).toHaveCount(0)

  const stored = await listMeasurementsViaApi(request, user)
  expect(stored.entries).toHaveLength(1)
  expect(stored.entries[0]).toMatchObject({ id, weightKg: 79.5, waistCm: null })
})

test('deleting an entry needs a confirmation and Keep leaves it alone', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-delete')
  await createMeasurementViaApi(request, user, localDate(0), { weightKg: 80 })
  await openMeasurements(page, user)

  await entries(page).first().getByTestId('measurement-delete').click()
  await expect(page.getByText('Delete this entry?', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Keep', exact: true }).click()
  await expect(entries(page)).toHaveCount(1)
  expect((await listMeasurementsViaApi(request, user)).entries).toHaveLength(1)

  await entries(page).first().getByTestId('measurement-delete').click()
  await page.getByTestId('measurement-confirm-delete').click()
  await expect(entries(page)).toHaveCount(0)
  await expect(page.getByText('No entries yet.')).toBeVisible()
  await expect(page.getByTestId('measurement-latest')).toHaveCount(0)
  expect((await listMeasurementsViaApi(request, user)).entries).toHaveLength(0)
})

test('invalid input shows field errors and saves nothing', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-invalid')
  await openMeasurements(page, user)
  const submit = page.getByTestId('measurement-submit')

  await submit.click()
  await expect(page.getByText('Enter at least one measurement.')).toBeVisible()

  await field(page, 'weightKg').fill('600')
  await submit.click()
  await expect(page.getByText('Weight must be between 20 and 500 kg.')).toBeVisible()
  await expect(field(page, 'weightKg')).toHaveAttribute('aria-invalid', 'true')

  await field(page, 'weightKg').fill('abc')
  await expect(page.getByText('Weight: enter a number.')).toBeVisible()

  await field(page, 'weightKg').fill('72.555')
  await expect(page.getByText('Weight can have at most 2 decimal places.')).toBeVisible()

  await field(page, 'weightKg').fill('')
  await field(page, 'waistCm').fill('4')
  await expect(page.getByText('Waist must be between 5 and 300 cm.')).toBeVisible()

  await field(page, 'waistCm').fill('80')
  await page.getByTestId('measurement-date').fill(localDate(-1))
  await submit.click()
  await expect(page.getByText('The date cannot be in the future.')).toBeVisible()

  await expect(entries(page)).toHaveCount(0)
  expect((await listMeasurementsViaApi(request, user)).entries).toHaveLength(0)
})

test('in Polish a comma decimal is accepted and shown with a comma, and errors are translated', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-pl')
  await openMeasurements(page, user)
  await page.getByRole('button', { name: 'PL', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pomiary ciała', level: 1 })).toBeVisible()

  await field(page, 'weightKg').fill('600')
  await page.getByTestId('measurement-submit').click()
  await expect(page.getByText('Waga musi mieścić się w przedziale od 20 do 500 kg.')).toBeVisible()

  await field(page, 'weightKg').fill('72,5')
  await page.getByTestId('measurement-submit').click()
  await expect(entries(page)).toHaveCount(1)
  await expect(entries(page).first().locator('[data-field="weightKg"]')).toContainText('72,5 kg')
  await expect(latestCard(page, 'weightKg').getByTestId('measurement-latest-value')).toHaveText('72,5 kg')
  expect((await listMeasurementsViaApi(request, user)).entries[0].weightKg).toBe(72.5)
})

test('the chart follows the measurement selector and the time window', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-chart')
  await createMeasurementViaApi(request, user, localDate(40), { weightKg: 82, armLeftCm: 34, armRightCm: 35 })
  await createMeasurementViaApi(request, user, localDate(20), { weightKg: 81 })
  await createMeasurementViaApi(request, user, localDate(0), { weightKg: 80, armLeftCm: 35, armRightCm: 36 })
  await openMeasurements(page, user)

  const chart = page.getByTestId('measurement-chart')
  const body = chart.getByTestId('measurement-chart-body')
  const dots = chart.locator('.recharts-line-dot')
  await expect(body).toHaveAttribute('aria-label', /Weight chart, 30 days\. Latest: Weight 80 kg\./)
  await expect(chart.getByTestId('measurement-window-30')).toHaveAttribute('aria-pressed', 'true')
  await expect(dots).toHaveCount(2)

  await chart.getByTestId('measurement-window-7').click()
  await expect(chart.getByTestId('measurement-window-7')).toHaveAttribute('aria-pressed', 'true')
  await expect(dots).toHaveCount(1)
  await chart.getByTestId('measurement-window-90').click()
  await expect(dots).toHaveCount(3)
  await chart.getByTestId('measurement-window-all').click()
  await expect(body).toHaveAttribute('aria-label', /Weight chart, All\./)
  await expect(dots).toHaveCount(3)

  // A limb draws both sides.
  await chart.getByTestId('measurement-chart-select').selectOption('arm')
  await expect(body).toHaveAttribute('aria-label', /Arm chart, All\. Latest: Left 35 cm, Right 36 cm\./)
  await expect(dots).toHaveCount(4)

  // An area with no data says so.
  await chart.getByTestId('measurement-chart-select').selectOption('waist')
  await expect(chart.getByText('No data in this time range.')).toBeVisible()
  await expect(body).toHaveCount(0)
})

test('a target weight can be set, tracked against the latest weight and cleared', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-target')
  await openMeasurements(page, user)
  const target = page.getByTestId('target-weight')
  const reference = page.locator('.recharts-reference-line')

  await expect(target.getByTestId('target-weight-current')).toHaveText('No target weight set.')
  await expect(target.getByTestId('target-weight-clear')).toHaveCount(0)

  // With a target but no weight yet there is nothing to compare.
  await target.getByTestId('target-weight-input').fill('75')
  await target.getByTestId('target-weight-save').click()
  await expect(target.getByTestId('target-weight-current')).toHaveText('Target: 75 kg')
  await expect(target.getByTestId('target-weight-progress')).toHaveText('Log a weight to see your progress toward the target.')

  await field(page, 'weightKg').fill('80.5')
  await page.getByTestId('measurement-submit').click()
  await expect(entries(page)).toHaveCount(1)
  await expect(target.getByTestId('target-weight-progress')).toHaveText('5.5 kg above target')
  await expect(reference).toHaveCount(1)

  await target.getByTestId('target-weight-input').fill('85')
  await target.getByTestId('target-weight-save').click()
  await expect(target.getByTestId('target-weight-current')).toHaveText('Target: 85 kg')
  await expect(target.getByTestId('target-weight-progress')).toHaveText('4.5 kg below target')

  await target.getByTestId('target-weight-input').fill('80.5')
  await target.getByTestId('target-weight-save').click()
  await expect(target.getByTestId('target-weight-progress')).toHaveText('Target reached')

  await target.getByTestId('target-weight-input').fill('10')
  await target.getByTestId('target-weight-save').click()
  await expect(page.getByText('Enter a target weight from 20 to 500 kg.')).toBeVisible()
  await expect(target.getByTestId('target-weight-current')).toHaveText('Target: 80.5 kg')

  await target.getByTestId('target-weight-input').fill('80.5')
  await target.getByTestId('target-weight-clear').click()
  await expect(target.getByTestId('target-weight-current')).toHaveText('No target weight set.')
  await expect(target.getByTestId('target-weight-progress')).toHaveCount(0)
  await expect(reference).toHaveCount(0)
  expect((await listMeasurementsViaApi(request, user)).targetWeightKg).toBeNull()
})

test('the how-to-measure tooltip opens by keyboard and shows its steps in English and Polish', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-tip')
  await openMeasurements(page, user)

  const trigger = page.getByRole('button', { name: 'How to measure: Weight', exact: true })
  await field(page, 'weightKg').focus()
  // Shift+Tab lands on the info button by keyboard, which opens the panel.
  await page.keyboard.press('Shift+Tab')
  await expect(trigger).toBeFocused()
  const panel = page.getByRole('tooltip')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Weighing yourself')
  await expect(panel.locator('li')).toHaveCount(3)
  await expect(panel).toContainText('Weigh yourself at the same time of day, ideally in the morning.')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await page.getByRole('button', { name: 'PL', exact: true }).click()
  const triggerPl = page.getByRole('button', { name: 'Jak mierzyć: Waga', exact: true })
  await field(page, 'weightKg').focus()
  await page.keyboard.press('Shift+Tab')
  await expect(triggerPl).toBeFocused()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Jak się ważyć')
  await expect(panel).toContainText('Waż się o tej samej porze dnia, najlepiej rano.')
  await expect(panel.locator('li')).toHaveCount(3)

  // Left and right limbs get distinct accessible names.
  await expect(page.getByRole('button', { name: 'Jak mierzyć: Ramię lewe', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Jak mierzyć: Ramię prawe', exact: true })).toHaveCount(1)
})

test('a failed load shows the error and Retry loads the page', async ({ page, request }) => {
  const user = await registerViaApi(request, 'meas-retry')
  await createMeasurementViaApi(request, user, localDate(0), { weightKg: 82.5 })
  let failing = true
  await page.route('**/api/body-measurements', async (route) => {
    if (failing && route.request().method() === 'GET') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom', code: 'INTERNAL_ERROR' }) })
      return
    }
    await route.continue()
  })
  await openMeasurements(page, user)

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(entries(page)).toHaveCount(0)
  failing = false
  await page.getByTestId('measurements-retry').click()
  await expect(page.getByTestId('measurements-retry')).toHaveCount(0)
  await expect(entries(page)).toHaveCount(1)
})

test("another user's measurements and target are never visible or reachable", async ({ page, request }) => {
  const owner = await registerViaApi(request, 'meas-owner')
  const id = await createMeasurementViaApi(request, owner, localDate(0), { weightKg: 91.5 })
  const targetResponse = await request.put(`${API}/api/body-measurements/target-weight`, {
    ...auth(owner),
    data: { targetWeightKg: 70 },
  })
  expect(targetResponse.ok()).toBe(true)

  const other = await registerViaApi(request, 'meas-other')
  await openMeasurements(page, other)
  await expect(page.getByText('No measurements yet.')).toBeVisible()
  await expect(entries(page)).toHaveCount(0)
  await expect(page.getByText('91.5')).toHaveCount(0)
  await expect(page.getByTestId('target-weight-current')).toHaveText('No target weight set.')

  expect((await listMeasurementsViaApi(request, other)).entries).toHaveLength(0)
  const put = await request.put(`${API}/api/body-measurements/${id}`, {
    ...auth(other),
    data: { measuredOn: localDate(0), weightKg: 50 },
  })
  expect(put.status()).toBe(404)
  const del = await request.delete(`${API}/api/body-measurements/${id}`, auth(other))
  expect(del.status()).toBe(404)
  const ownerStill = await listMeasurementsViaApi(request, owner)
  expect(ownerStill.entries).toHaveLength(1)
  expect(ownerStill.entries[0].weightKg).toBe(91.5)
  expect(ownerStill.targetWeightKg).toBe(70)
})

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the page does not scroll horizontally with a full entry, a target and an open tooltip', async ({ page, request }) => {
    const user = await registerViaApi(request, 'meas-phone')
    await createMeasurementViaApi(request, user, localDate(2), {
      weightKg: 80.25,
      waistCm: 90.5,
      chestCm: 100,
      hipsCm: 101.5,
      armLeftCm: 35,
      armRightCm: 36,
      thighLeftCm: 60,
      thighRightCm: 61,
      calfLeftCm: 40,
      calfRightCm: 41,
    })
    await createMeasurementViaApi(request, user, localDate(0), { weightKg: 79.75, armLeftCm: 35.5 })
    await login(page, user)
    await page.goto('/measurements')
    await expect(page.getByRole('heading', { name: 'Body measurements', level: 1 })).toBeVisible()
    await expect(entries(page)).toHaveCount(2)

    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(await overflow()).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'How to measure: Weight', exact: true }).click()
    await expect(page.getByRole('tooltip')).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})
