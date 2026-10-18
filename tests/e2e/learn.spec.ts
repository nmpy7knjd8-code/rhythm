import { expect, test } from '@playwright/test'
import { openSong, pickSection } from './app'

test('a section without drums says so and moves on to the next drum section', async ({ page }) => {
  const d = await openSong(page, 'schism')
  await pickSection(page, 0)
  await expect(d.getByText('No drums here')).toBeVisible()
  await expect(d.getByRole('button', { name: 'Steps', exact: true })).toHaveCount(0)
  const go = d.getByRole('button', { name: /^Go to / })
  const next = (await go.textContent())!.replace('Go to ', '')
  await go.click()
  await expect(d.getByLabel('Sections').getByRole('button', { pressed: true })).toHaveText(next)
  await expect(d.getByText('No drums here')).toHaveCount(0)
  await expect(d.getByRole('img', { name: 'Bar notation with the count under each beat' })).toBeVisible()
})

test('section names drop tab rehearsal marks', async ({ page }) => {
  const d = await openSong(page, 'yyz')
  const names = await d.getByLabel('Sections').getByRole('button').allTextContents()
  expect(names.some(n => n.startsWith('['))).toBe(false)
  expect(names).toContain('Section I')
})

test('repeated beats get numbered step titles', async ({ page }) => {
  const d = await openSong(page, 'cometogether')
  const pills = await d.getByLabel('Sections').getByRole('button').allTextContents()
  await pickSection(page, pills.indexOf('Chorus'))
  await d.getByRole('button', { name: 'Steps', exact: true }).click()
  const titles: string[] = []
  const next = d.getByRole('button', { name: 'Next', exact: true })
  for (;;) {
    titles.push((await d.locator('.card .text-\\[16px\\]').first().textContent())!)
    if (await next.isDisabled()) break
    await next.click()
  }
  expect(new Set(titles).size).toBe(titles.length)
  expect(titles.at(-1)).toBe('The full part')
})
