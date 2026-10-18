import { expect, test } from '@playwright/test'
import { openSong, pickSection } from './app'

test('the speed trainer starts at From, climbs only after full loops, and stops at To', async ({ page }) => {
  const d = await openSong(page, 'chopsuey') // section 0: a one-bar loop
  await pickSection(page, 0)
  await d.getByLabel('From').selectOption('80')
  await d.getByLabel('To').selectOption('90')
  await d.getByLabel('Climb').selectOption('5')
  await d.getByLabel('Loops').selectOption('1')
  await d.getByRole('button', { name: 'Speed trainer' }).click()
  const tb = d.getByRole('toolbar', { name: 'Practice' })
  await expect(tb).toContainText('80%')
  await tb.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(1200) // inside the first bar: no full loop yet
  await expect(tb).toContainText('80%')
  await expect(tb).toContainText('85%', { timeout: 10_000 })
  await expect(tb).toContainText('90%', { timeout: 10_000 })
  await expect(d.getByText('At 90%.')).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(tb).toContainText('90%') // never past To
})

test('I play, you play: every other bar is the click alone', async ({ page }) => {
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  // observe what the engine schedules: drum strokes and clicks per song bar
  await page.evaluate(() => {
    const e = (window as unknown as { __pulseEngine: Record<string, unknown> & { songBar: number } }).__pulseEngine
    const log: { bar: number; kind: string }[] = []; (window as unknown as { __log: typeof log }).__log = log
    for (const kind of ['play', 'click'] as const) {
      const orig = (e[kind] as (...a: unknown[]) => unknown).bind(e)
      e[kind] = (...a: unknown[]) => { log.push({ bar: e.songBar, kind }); return orig(...a) }
    }
  })
  await d.getByRole('button', { name: 'I play, you play' }).click()
  await expect(d.getByText('I play, you play: press Play')).toBeVisible()
  await d.getByRole('toolbar', { name: 'Practice' }).getByRole('button', { name: 'Play' }).click()
  await expect(d.getByText('Your turn: play this bar')).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(8000)
  const log = await page.evaluate(() => (window as unknown as { __log: { bar: number; kind: string }[] }).__log)
  const order: number[] = []
  for (const x of log) if (order[order.length - 1] !== x.bar) order.push(x.bar)
  const bars = order.slice(0, -1) // the last bar may be cut off
  expect(bars.length).toBeGreaterThanOrEqual(3)
  bars.forEach((bar, i) => {
    const here = log.filter(x => x.bar === bar)
    if (i % 2 === 0) expect(here.some(x => x.kind === 'play'), `bar ${bar} is the part`).toBe(true)
    else { expect(here.some(x => x.kind === 'play'), `bar ${bar} has no drums`).toBe(false); expect(here.some(x => x.kind === 'click'), `bar ${bar} has the click`).toBe(true) }
  })
})
