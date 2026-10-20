import { expect, test, type Page } from '@playwright/test'
import { openSong, pickSection, sheet } from './app'

const sync = (page: Page) => sheet(page).locator('[data-sound-sync]')
const engine = (page: Page) => page.evaluate(() => {
  const e = (window as unknown as { __pulseEngine: { latency(): number; heardNow(): number; rawCtx(): AudioContext } }).__pulseEngine
  return { latency: e.latency(), lag: e.rawCtx().currentTime - e.heardNow() }
})

test('Bluetooth starts the highlight 200 ms later, in Now playing and Learn it alike', async ({ page }) => {
  await openSong(page, 'backinblack', 'Now playing')
  await expect(sync(page).locator('summary')).toContainText('Cable · 0 ms')
  const cable = await engine(page)
  expect(cable.lag).toBeCloseTo(cable.latency, 6) // what the browser reports, nothing more
  await sync(page).locator('summary').click()
  await sync(page).getByLabel('Pulse sound').selectOption('bluetooth')
  await expect(sync(page).locator('summary')).toContainText('Bluetooth · 200 ms')
  expect((await engine(page)).latency - cable.latency).toBeCloseTo(0.2, 6)
  await sheet(page).getByRole('button', { name: 'Learn it', exact: true }).click()
  await pickSection(page, 1)
  await expect(sync(page).locator('summary')).toContainText('Bluetooth · 200 ms') // one setting, shared
  await sync(page).locator('summary').click()
  await sync(page).getByRole('button', { name: 'Highlight later' }).click()
  await expect(sync(page).locator('[data-sound-delay]')).toHaveText('210 ms')
  expect((await engine(page)).latency - cable.latency).toBeCloseTo(0.21, 6)
})

test('tapping along to the clicks measures the delay and keeps it for that route', async ({ page }) => {
  await openSong(page, 'backinblack', 'Now playing')
  await sync(page).locator('summary').click()
  await sync(page).getByLabel('Pulse sound').selectOption('bluetooth')
  await sync(page).getByRole('button', { name: 'Tap along' }).click()
  await page.waitForFunction(() => (window as unknown as { __pulseKit: { calClicks: number[] } }).__pulseKit.calClicks.length === 20)
  // someone who hears each click 180 ms late taps with it
  await page.evaluate(() => {
    const clicks = (window as unknown as { __pulseKit: { calClicks: number[] } }).__pulseKit.calClicks
    const pad = () => [...document.querySelectorAll('[data-sound-sync] button')].find(b => b.textContent?.startsWith('Tap here'))!
    for (const c of clicks) setTimeout(() => pad().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), c + 180 - performance.now())
  })
  await expect(sync(page)).toContainText('20 of 20', { timeout: 25_000 })
  const shown = sync(page).locator('[data-sound-delay]')
  await expect(shown).toBeVisible({ timeout: 5000 })
  const ms = parseInt((await shown.textContent())!)
  expect(Math.abs(ms - 180)).toBeLessThanOrEqual(15)
  await page.reload()
  await openSong(page, 'backinblack', 'Now playing')
  await expect(sync(page).locator('summary')).toContainText(`Bluetooth · ${ms} ms`)
  await sync(page).locator('summary').click()
  await sync(page).getByLabel('Pulse sound').selectOption('aux')
  await expect(sync(page).locator('summary')).toContainText('Cable · 0 ms') // each route keeps its own
})

test("Now playing's Sync chip opens the panel; in Learn it the panel is the first folded section", async ({ page }) => {
  await openSong(page, 'backinblack', 'Now playing')
  await sheet(page).getByRole('button', { name: 'Sync with the sound: 0 ms' }).click()
  await expect(sync(page).getByLabel('Pulse sound')).toBeInViewport()
  await sheet(page).getByRole('button', { name: 'Learn it', exact: true }).click()
  await pickSection(page, 1)
  // ahead of the lesson's folded panels (About this section, Common mistakes, How to practice)
  const order = await sheet(page).locator('details').evaluateAll(ds => ds.map(d => d.hasAttribute('data-sound-sync') ? 'sync' : d.querySelector('summary')!.textContent!.trim()))
  expect(order.indexOf('sync')).toBeGreaterThanOrEqual(0)
  expect(order.indexOf('sync')).toBeLessThan(order.findIndex(t => t.startsWith('About this section')))
})
