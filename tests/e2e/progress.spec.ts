import { expect, test } from '@playwright/test'
import { openSong, pickSection, sheet, transport } from './app'

const notation = (page: import('@playwright/test').Page) => sheet(page).getByRole('img', { name: 'Bar notation with the count under each beat' })

test('a full loop records the best tempo, and it survives a reload', async ({ page }) => {
  const d = await openSong(page, 'chopsuey') // section 0 is a one-bar intro: a lap takes about 2 s
  await pickSection(page, 0)
  await expect(d.getByText(/^Best/)).toHaveCount(0)
  const tb = d.getByRole('toolbar', { name: 'Practice' })
  await tb.getByRole('button', { name: 'Slower' }).click()
  await transport(page, 'Play').click()
  await expect(d.getByText(/^Best 95%, today$/)).toBeVisible({ timeout: 15_000 })
  await transport(page, 'Stop').click()
  await page.reload()
  const again = await openSong(page, 'chopsuey')
  await pickSection(page, 0)
  await expect(again.getByText(/^Best 95%, today$/)).toBeVisible()
})

test('saving the first best does not move the notation', async ({ page }) => {
  const d = await openSong(page, 'chopsuey')
  await pickSection(page, 0)
  await expect(d.getByText(/^Best/)).toHaveCount(0)
  const before = (await notation(page).boundingBox())!.y
  await transport(page, 'Play').click()
  await expect(d.getByText(/^Best 100%, today$/)).toBeVisible({ timeout: 15_000 })
  expect((await notation(page).boundingBox())!.y).toBe(before)
  await transport(page, 'Stop').click()
})

test('a part played as a step does not count as the full part', async ({ page }) => {
  const d = await openSong(page, 'chopsuey')
  await pickSection(page, 0)
  const tb = d.getByRole('toolbar', { name: 'Practice' })
  await tb.getByRole('button', { name: 'Steps' }).click() // step 1 of 3
  await transport(page, 'Play').click()
  await page.waitForTimeout(6000)
  await expect(d.getByText(/^Best/)).toHaveCount(0)
})

test('practice settings survive a reload; mutes do not', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Count-in', exact: true }).click()
  await d.getByRole('button', { name: 'Mute Bass drum' }).click()
  await page.reload()
  const again = await openSong(page, 'backinblack')
  await expect(again.getByRole('button', { name: 'Count-in', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(again.getByRole('button', { name: 'Mute Bass drum' })).toHaveAttribute('aria-pressed', 'false') // every voice back on
  const other = await openSong(page, 'billiejean')
  await expect(other.getByRole('button', { name: 'Count-in', exact: true })).toHaveAttribute('aria-pressed', 'true') // a habit, every song
})

test('an earlier section is suggested for review and one tap opens it', async ({ page }) => {
  const old = Date.now() - 2 * 86_400_000
  await page.addInitScript(old => localStorage.setItem('pulse.learn.v1', JSON.stringify({ songs: { backinblack: { best: { '1:Verse 1': { pct: 85, at: old, last: old } } } } })), old)
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 2)
  const review = d.getByRole('button', { name: 'Review Verse 1: 85%, 2 days ago' })
  await expect(review).toBeVisible()
  await review.click()
  await expect(sheet(page).getByLabel('Sections').getByRole('button', { pressed: true })).toHaveText('Verse 1')
  await expect(d.getByText(/^Best 85%, 2 days ago$/)).toBeVisible()
})
