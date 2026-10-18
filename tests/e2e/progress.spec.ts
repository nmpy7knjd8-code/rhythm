import { expect, test } from '@playwright/test'
import { openSong, pickSection, sheet } from './app'

test('a full loop records the best tempo, and it survives a reload', async ({ page }) => {
  const d = await openSong(page, 'chopsuey') // section 0 is a one-bar intro: a lap takes about 2 s
  await pickSection(page, 0)
  await expect(d.getByText(/^Best here/)).toHaveCount(0)
  const tb = d.getByRole('toolbar', { name: 'Practice' })
  await tb.getByRole('button', { name: 'Slower' }).click()
  await tb.getByRole('button', { name: 'Play' }).click()
  await expect(d.getByText(/^Best here 95%, today$/)).toBeVisible({ timeout: 15_000 })
  await tb.getByRole('button', { name: 'Stop' }).click()
  await page.reload()
  const again = await openSong(page, 'chopsuey')
  await pickSection(page, 0)
  await expect(again.getByText(/^Best here 95%, today$/)).toBeVisible()
})

test('a part played as a step does not count as the full part', async ({ page }) => {
  const d = await openSong(page, 'chopsuey')
  await pickSection(page, 0)
  const tb = d.getByRole('toolbar', { name: 'Practice' })
  await tb.getByRole('button', { name: 'Steps' }).click() // step 1 of 3
  await tb.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(6000)
  await expect(d.getByText(/^Best here/)).toHaveCount(0)
})

test('practice settings survive a reload', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Count-in', exact: true }).click()
  await d.getByRole('button', { name: 'Mute Bass drum' }).click()
  await page.reload()
  const again = await openSong(page, 'backinblack')
  await expect(again.getByRole('button', { name: 'Count-in', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(again.getByRole('button', { name: 'Mute Bass drum' })).toHaveAttribute('aria-pressed', 'true')
  const other = await openSong(page, 'billiejean')
  await expect(other.getByRole('button', { name: 'Count-in', exact: true })).toHaveAttribute('aria-pressed', 'true') // a habit, every song
  await expect(other.getByRole('button', { name: 'Mute Bass drum' })).toHaveAttribute('aria-pressed', 'false') // a choice for that song
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
  await expect(d.getByText(/^Best here 85%, 2 days ago$/)).toBeVisible()
})
