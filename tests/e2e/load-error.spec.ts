import { expect, test } from '@playwright/test'
import { sheet } from './app'

test("a song that won't load says so and Retry loads it", async ({ page }) => {
  await page.route('**/songs/*.json*', r => r.fulfill({ status: 503, body: 'down' }))
  await page.goto('./', { waitUntil: 'networkidle' })
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  // the player's browser: play the first song in the list
  await page.getByLabel('Browse rhythms').click()
  const d = sheet(page)
  await d.getByPlaceholder(/^Search/).fill('Back in Black')
  await d.getByRole('button', { name: 'Play Back in Black' }).click()
  // in the open sheet, and in the compact bar once it closes
  await expect(d.getByRole('alert')).toHaveText(/Couldn't load Back in Black\./)
  await d.getByRole('alert').getByRole('button', { name: 'Retry' }).click() // still failing: the message stays, nothing plays
  await expect(d.getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText("Couldn't load this song")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
  await page.unroute('**/songs/*.json*')
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByText("Couldn't load this song")).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Back in Black').first()).toBeVisible()
  expect(errors).toEqual([]) // no unhandled rejections
})

test('playing a groove after a failed song load clears the message', async ({ page }) => {
  await page.route('**/songs/*.json*', r => r.fulfill({ status: 503, body: 'down' }))
  await page.goto('./', { waitUntil: 'networkidle' })
  await page.getByLabel('Browse rhythms').click()
  const d = sheet(page)
  await d.getByPlaceholder(/^Search/).fill('Back in Black')
  await d.getByRole('button', { name: 'Play Back in Black' }).click()
  await expect(d.getByRole('alert')).toBeVisible()
  // a groove from the same browser (not a song): it plays and the old error goes
  await d.getByPlaceholder(/^Search/).fill('Rock backbeat')
  await d.getByRole('button', { name: 'Play Rock backbeat', exact: true }).click()
  await expect(d.getByRole('alert')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText("Couldn't load this song")).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop', exact: true }).first()).toBeVisible()
})

