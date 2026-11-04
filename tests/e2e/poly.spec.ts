import { expect, test, type Page } from '@playwright/test'

type Eng = { songPos(a?: number): { step: number } | null; practiceVoices: Set<string> | null; countWords: Map<number, string[]> | null; delay: number; latency(): number; heardNow(): number; rawCtx(): AudioContext }
const eng = <T>(page: Page, f: (e: Eng) => T) => page.evaluate(f as never) as Promise<T>

async function open(page: Page, name: string) {
  await page.goto('./#/poly', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'All 40' }).click()
  const item = page.locator('li.card').filter({ has: page.getByRole('button', { name: new RegExp(`^${name}`) }) })
  await item.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  return item
}

test('the page lists all 40 and featured first', async ({ page }) => {
  await page.goto('./#/poly', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Polyrhythms', level: 1 })).toBeVisible()
  await expect(page.locator('li.card')).toHaveCount(7)
  await page.getByRole('button', { name: 'All 40' }).click()
  await expect(page.locator('li.card')).toHaveCount(40)
  await expect(page.getByRole('link', { name: 'Poly', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('3 against 2 plays, and the lit notes follow the heard step', async ({ page }) => {
  const item = await open(page, '3 against 2')
  await item.getByRole('button', { name: 'Play 3 against 2' }).click()
  await expect(page.locator('body')).toContainText('Polyrhythm · cowbell over kick')
  await page.waitForFunction(() => (window as unknown as { __pulseEngine: Eng }).__pulseEngine.songPos() !== null)
  // each frame: the lit cowbell note is the last one at or before the heard step (6 steps: notes on 0, 2, 4; kick on 0, 3)
  const r = await page.evaluate(async () => {
    const e = (window as unknown as { __pulseEngine: Eng }).__pulseEngine
    let ok = 0, n = 0
    for (let i = 0; i < 90; i++) {
      await new Promise(r => requestAnimationFrame(r))
      const s = e.songPos(1.5 / 60)?.step; if (s === undefined) continue
      const lit = (row: string) => { const d = [...document.querySelectorAll(`[data-row=${row}] > span[data-on]`)] as HTMLElement[]; return d.length ? parseFloat(d[0].style.left) : null }
      const c = lit('cross'), k = lit('pulse'); n++
      if (c !== null && Math.abs(c - Math.floor(s / 2) * 2 / 6 * 100) < 0.5 && k !== null && Math.abs(k - Math.floor(s / 3) * 3 / 6 * 100) < 0.5) ok++
    }
    return { ok, n }
  })
  expect(r.n).toBeGreaterThan(30)
  expect(r.ok / r.n).toBeGreaterThan(0.9)
})

test('count, your layer and the Bluetooth delay reach the engine', async ({ page }) => {
  const item = await open(page, '4 against 3')
  await item.getByRole('button', { name: 'Play 4 against 3' }).click()
  await item.getByLabel('Count').getByRole('button', { name: 'Kick' }).click()
  expect(await eng(page, () => [...(window as unknown as { __pulseEngine: Eng }).__pulseEngine.countWords!.get(0)!].filter(Boolean))).toEqual(['1', '2', '3'])
  await item.getByLabel('You play').getByRole('button', { name: 'Cowbell' }).click()
  expect(await eng(page, () => [...(window as unknown as { __pulseEngine: Eng }).__pulseEngine.practiceVoices!])).toEqual(['low'])
  await expect(item).toContainText('Connect a MIDI kit')
  await item.locator('[data-sound-sync] summary').click()
  await item.getByLabel('Pulse sound').selectOption('bluetooth')
  expect(await eng(page, () => (window as unknown as { __pulseEngine: Eng }).__pulseEngine.delay)).toBeCloseTo(0.2, 6)
  await item.getByRole('button', { name: 'Stop 4 against 3' }).click()
  await expect(item.getByRole('button', { name: 'Play 4 against 3' })).toBeVisible()
})

test('with a song queued, a polyrhythm keeps looping instead of moving on', async ({ page }) => {
  await page.goto('./#/library', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^Add .* to queue$/ }).first().click()
  const item = await open(page, '3 against 2')
  await item.getByRole('button', { name: 'Play 3 against 2' }).click()
  await page.waitForFunction(() => (window as unknown as { __pulseEngine: Eng }).__pulseEngine.songPos() !== null)
  // 3 against 2 is two beats long; 5 s is more than two cycles at any start tempo of 60 BPM or faster
  await page.waitForTimeout(5000)
  await expect(page.locator('body')).toContainText('Polyrhythm · cowbell over kick')
  await expect(item.getByRole('button', { name: 'Stop 3 against 2' })).toBeVisible()
})
