import { expect, test } from '@playwright/test'
import { openSong, pickSection, sheet, transport } from './app'

const bar = (page: import('@playwright/test').Page) => sheet(page).getByRole('toolbar', { name: 'Practice' })
const notation = (page: import('@playwright/test').Page) => sheet(page).getByRole('img', { name: 'Bar notation with the count under each beat' })

test('the practice bar sits above the notation and stays in reach while scrolling', async ({ page }) => {
  await openSong(page, 'backinblack')
  await pickSection(page, 1)
  const tb = bar(page)
  for (const name of ['Slower', 'Faster', 'Steps', 'Loop']) await expect(tb.getByRole('button', { name, exact: true })).toBeVisible()
  expect((await tb.boundingBox())!.y).toBeLessThan((await notation(page).boundingBox())!.y)
  const scroller = sheet(page).locator('.overflow-y-auto').first()
  const top = (await scroller.boundingBox())!.y
  await scroller.evaluate(el => el.scrollTo(0, 900))
  await expect.poll(async () => Math.round((await tb.boundingBox())!.y - top)).toBeLessThanOrEqual(1)
  // Play lives in the sheet header, above the scroller: still visible and above the stuck bar
  await expect(transport(page, 'Play')).toBeInViewport()
  expect((await transport(page, 'Play').boundingBox())!.y).toBeLessThan(top)
  await expect(tb.getByRole('button', { name: 'Play' })).toHaveCount(0)
})

test('the bar controls change tempo in 5% steps, open steps and toggle the loop', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  const tb = bar(page)
  await tb.getByRole('button', { name: 'Slower' }).click()
  await expect(tb).toContainText('95%')
  await expect(d.getByLabel('Practice tempo')).toHaveValue('95')
  await tb.getByRole('button', { name: 'Steps' }).click()
  await expect(d.getByText(/^Step 1 of \d/)).toBeVisible()
  const loop = tb.getByRole('button', { name: 'Loop' })
  await expect(loop).toHaveAttribute('aria-pressed', 'true') // picking a section loops it
  await loop.click()
  await expect(loop).toHaveAttribute('aria-pressed', 'false')
})

test('summary and kit are collapsed until asked for', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await expect(d.getByText('The kit lights what you hear.')).toHaveCount(0)
  await d.getByText('About this section').click()
  await expect(d.getByText('The kit lights what you hear.')).toBeVisible()
  await expect(d.getByText(/^Verse 1 is in 4\/4/)).toBeVisible()
})

test('every Learn it control is at least 44 px square', async ({ page }) => {
  const d = await openSong(page, 'killing')
  await pickSection(page, 1)
  await bar(page).getByRole('button', { name: 'Steps' }).click()
  await bar(page).getByRole('button', { name: 'Slower' }).click() // shows Reset-style extras where they exist
  const small: string[] = []
  for (const b of await d.locator('.overflow-y-auto').first().getByRole('button').all()) {
    const box = await b.boundingBox()
    if (box && (box.height < 44 || box.width < 44)) small.push(`${(await b.getAttribute('aria-label')) ?? (await b.textContent())} ${Math.round(box.width)}x${Math.round(box.height)}`)
  }
  expect(small).toEqual([])
})

test('the count-in does not move the page', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Count-in', exact: true }).click()
  await bar(page).getByRole('button', { name: 'Steps' }).click()
  const card = d.getByText(/^Step 1 of \d/)
  const before = [(await notation(page).boundingBox())!.y, (await card.boundingBox())!.y]
  await transport(page, 'Play').click()
  const flash = d.locator('[aria-live=polite]').filter({ hasText: /^\d$/ })
  await expect(flash).toBeVisible()
  const badge = (await flash.boundingBox())!
  expect(badge.width * badge.height).toBeLessThan(50 * 50) // a corner badge, not a cover over the first bar
  expect([(await notation(page).boundingBox())!.y, (await card.boundingBox())!.y]).toEqual(before)
})
