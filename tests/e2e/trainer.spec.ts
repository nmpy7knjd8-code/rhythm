import { expect, test } from '@playwright/test'
import { openSong, pickSection, transport } from './app'

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
  await transport(page, 'Play').click()
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
  await transport(page, 'Play').click()
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

test('with I play, you play, the trainer climbs only after a heard bar and its played bar', async ({ page }) => {
  const d = await openSong(page, 'chopsuey') // section 0: a one-bar loop, so a pair is two laps
  await pickSection(page, 0)
  await d.getByLabel('From').selectOption('80')
  await d.getByLabel('To').selectOption('85')
  await d.getByLabel('Climb').selectOption('5')
  await d.getByLabel('Loops').selectOption('1')
  await d.getByRole('button', { name: 'Speed trainer' }).click()
  await d.getByRole('button', { name: 'I play, you play' }).click()
  // sample the turn line and the tempo together, every animation frame
  await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]')!, tb = dlg.querySelector('[role=toolbar]')!
    const log: string[] = []; (window as unknown as { __turns: string[] }).__turns = log
    const tick = () => {
      const turn = [...dlg.querySelectorAll('[aria-live=polite]')].map(e => e.textContent).find(t => t === 'Listen' || t?.startsWith('Your turn')) ?? '-'
      const s = `${turn === 'Listen' ? 'L' : turn === '-' ? '-' : 'Y'}${tb.textContent!.match(/(\d+)%/)![1]}`
      if (log[log.length - 1] !== s) log.push(s)
      requestAnimationFrame(tick)
    }
    tick()
  })
  await transport(page, 'Play').click()
  await expect(d.getByRole('toolbar', { name: 'Practice' })).toContainText('85%', { timeout: 15_000 })
  const log = await page.evaluate(() => (window as unknown as { __turns: string[] }).__turns.filter(s => s[0] !== '-'))
  // heard and played at 80%, then the climb lands on a heard bar: never a played bar at a new tempo straight after its heard bar
  expect(log.slice(0, 3)).toEqual(['L80', 'Y80', 'L85'])
})
