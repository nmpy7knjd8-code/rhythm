import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openSong, pickSection } from './app'
import { hitNext, mockKit } from './kit'

// WCAG 2.2 A/AA plus axe best practices. Serious and critical findings fail; the rest are attached to the report.
async function scan(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  const lines = violations.map(v => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`)
  await test.info().attach(`${name}-axe.txt`, { body: lines.join('\n') || 'no findings', contentType: 'text/plain' })
  expect(lines.filter(line => line.startsWith('serious') || line.startsWith('critical')), name).toEqual([])
}

test('Learn it idle', async ({ page }) => {
  await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await scan(page, 'learn-idle')
})

test('Learn it with steps open', async ({ page }) => {
  const d = await openSong(page, 'schism')
  await pickSection(page, 3)
  await d.getByRole('button', { name: 'Steps', exact: true }).click()
  await expect(d.getByText(/^Step 1 of \d/)).toBeVisible()
  await scan(page, 'learn-steps')
})

test('Learn it playing', async ({ page }) => {
  const d = await openSong(page, 'billiejean')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Play' }).first().click()
  await expect(d.getByRole('button', { name: 'Stop' }).first()).toBeVisible()
  await page.waitForTimeout(800)
  await scan(page, 'learn-playing')
})

test('Learn it on a section without drums', async ({ page }) => {
  const d = await openSong(page, 'schism')
  await pickSection(page, 0)
  await expect(d.getByText('No drums here')).toBeVisible()
  await scan(page, 'learn-silent')
})

test('Learn it with a kit: settings open, playing and judged', async ({ page }) => {
  await mockKit(page)
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Kit', exact: true }).click()
  await d.getByRole('button', { name: 'Play' }).first().click()
  await hitNext(page, -50)
  await expect(d.locator('[data-kit-readout]')).toContainText('Early')
  await d.locator('.overflow-y-auto').first().evaluate(el => el.scrollTo(0, 0)) // tapping Kit scrolled a row under the sticky practice bar, which axe reads as overlap
  await scan(page, 'learn-kit')
})

test('Now playing', async ({ page }) => {
  const d = await openSong(page, 'killing', 'Now playing')
  await d.getByRole('button', { name: 'Play' }).first().click()
  await page.waitForTimeout(800)
  await scan(page, 'nowplaying')
})
