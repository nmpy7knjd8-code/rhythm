import { expect, test } from '@playwright/test'
import { openSong, pickSection, sheet, transport } from './app'
import { autoPlay, hitNext, mockKit } from './kit'

const notation = (page: import('@playwright/test').Page) => sheet(page).getByRole('img', { name: 'Bar notation with the count under each beat' })
const readout = (page: import('@playwright/test').Page) => sheet(page).locator('[data-kit-readout]')

test('no kit: only a small Connect kit button; connecting asks for MIDI and shows the kit', async ({ page }) => {
  await mockKit(page, { granted: false })
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await expect(readout(page)).toHaveCount(0)
  await expect(d.getByRole('group', { name: 'Kit settings' })).toHaveCount(0)
  await d.getByRole('button', { name: 'Connect kit' }).click()
  const set = d.getByRole('group', { name: 'Kit settings' })
  await expect(set).toContainText('Alesis Nitro Pro')
  await expect(set.getByLabel('Pulse sound')).toHaveValue('aux')
  await expect(set).toContainText('Best: a cable from this device into the kit’s Aux In, headphones in the kit, kit Local on.')
  await expect(readout(page)).toHaveText(/Play along on your kit/)
  await expect(d.getByRole('button', { name: 'Kit', exact: true })).toBeVisible()
})

test('a kit already allowed connects by itself; settings stay closed', async ({ page }) => {
  await mockKit(page)
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await expect(readout(page)).toBeVisible()
  await expect(d.getByRole('group', { name: 'Kit settings' })).toHaveCount(0)
})

test('hits are judged On time, Early, Late or wrong drum against what is heard, and marked on the notes', async ({ page }) => {
  await mockKit(page)
  await openSong(page, 'backinblack')
  await pickSection(page, 1)
  const y = (await notation(page).boundingBox())!.y
  await transport(page, 'Play').click()
  await hitNext(page, 5)
  await expect(readout(page)).toContainText('On time')
  await hitNext(page, -60)
  await expect(readout(page)).toContainText('← Early 60 ms')
  await hitNext(page, 55)
  await expect(readout(page)).toContainText('Late → 55 ms')
  await hitNext(page, 0, { voice: 'tomMid' })
  await expect(readout(page)).toContainText(/Wrong drum: Tom 2, not /)
  await expect(notation(page).locator('[data-mark]').first()).toBeVisible()
  expect((await notation(page).boundingBox())!.y).toBe(y) // nothing moved while playing
  await transport(page, 'Stop').click()
})

test('calibration measures the offset and scoring then allows for it', async ({ page }) => {
  await mockKit(page)
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await d.getByRole('button', { name: 'Kit', exact: true }).click()
  const set = d.getByRole('group', { name: 'Kit settings' })
  await expect(set).toContainText('Not calibrated')
  await set.getByRole('button', { name: 'Calibrate' }).click()
  await page.waitForFunction(() => (window as unknown as { __pulseKit: { calClicks: number[] } }).__pulseKit.calClicks.length === 24)
  // a drummer who hears everything 120 ms late (say Bluetooth), wobbling ±8 ms
  await page.evaluate(() => {
    const w = window as unknown as { __pulseKit: { calClicks: number[] }; __midi: { hit(n: number, at: number): void } }
    w.__pulseKit.calClicks.forEach((c, i) => w.__midi.hit(38, c + 120 + [-8, -4, 0, 4, 8][i % 5]))
  })
  await expect(set).toContainText('24 of 24')
  await expect(set).toContainText('Offset 120 ms', { timeout: 20_000 })
  await transport(page, 'Play').click()
  await hitNext(page, 10) // 130 ms after the note is heard: on time for this drummer
  await expect(readout(page)).toContainText('On time')
  await transport(page, 'Stop').click()
  await page.reload()
  const again = await openSong(page, 'backinblack')
  await again.getByRole('button', { name: 'Kit', exact: true }).click()
  await expect(again.getByRole('group', { name: 'Kit settings' })).toContainText('Offset 120 ms') // saved for this sound route
})

test('a full loop played cleanly scores 100% and is kept as the section best', async ({ page }) => {
  await mockKit(page)
  await openSong(page, 'chopsuey') // section 0: a one-bar loop
  await pickSection(page, 0)
  await transport(page, 'Play').click()
  await autoPlay(page)
  await expect(readout(page)).toContainText('Last loop 100%', { timeout: 15_000 })
  await expect(readout(page)).toContainText('Best 100% at 100%')
  await transport(page, 'Stop').click()
})

test('pads can be set up by hitting each one', async ({ page }) => {
  await mockKit(page)
  const d = await openSong(page, 'backinblack')
  await d.getByRole('button', { name: 'Kit', exact: true }).click()
  const set = d.getByRole('group', { name: 'Kit settings' })
  await set.getByRole('button', { name: 'Set up pads' }).click()
  await expect(set).toContainText('Hit Kick')
  await page.evaluate(() => (window as unknown as { __midi: { hit(n: number): void } }).__midi.hit(60))
  await expect(set).toContainText('Hit Snare')
  await set.getByRole('button', { name: 'Done' }).click()
  await expect(set).toContainText('Your own pad setup.')
  expect(await page.evaluate(() => (window as unknown as { __pulseKit: { get(): { pads: Record<number, string> } } }).__pulseKit.get().pads[60])).toBe('low')
  await set.getByRole('button', { name: 'Reset' }).click()
  await expect(set).toContainText('Nitro Pro’s default notes')
})

test('each note is due when the audio clock says it is heard (output latency included)', async ({ page }) => {
  await mockKit(page)
  await openSong(page, 'backinblack')
  await pickSection(page, 1)
  await transport(page, 'Play').click()
  const gaps = await page.evaluate(async () => {
    const w = window as unknown as { __pulseScorer: { pending: { t: number; at: number }[] }; __pulseEngine: { heardNow(): number } }
    const out: number[] = []
    for (let i = 0; i < 40 && out.length < 20; i++) {
      await new Promise(r => setTimeout(r, 50))
      const n = w.__pulseScorer.pending.at(-1); if (!n) continue
      out.push(n.at - (performance.now() + (n.t - w.__pulseEngine.heardNow()) * 1000))
    }
    return out
  })
  expect(gaps.length).toBeGreaterThan(10)
  for (const g of gaps) expect(Math.abs(g)).toBeLessThan(15)
  await transport(page, 'Stop').click()
})

test('only the voices you are meant to play are scored: muted voices you fill in, solo, or Hands/Feet only', async ({ page }) => {
  await mockKit(page)
  const d = await openSong(page, 'backinblack')
  await pickSection(page, 1)
  const voices = () => page.evaluate(() => { const s = (window as unknown as { __pulseScorer: { pending: { voice: string }[]; results: { note: { voice: string } }[] } }).__pulseScorer; return [...new Set([...s.pending.map(p => p.voice), ...s.results.map(r => r.note.voice)])].sort() })
  await d.getByRole('button', { name: 'Mute Snare' }).click()
  await transport(page, 'Play').click()
  await page.waitForTimeout(2500)
  expect(await voices()).toEqual(['back']) // the drums Pulse still plays are never missed
  await transport(page, 'Stop').click()
  await d.getByRole('button', { name: 'Reset', exact: true }).click() // mutes off
  await d.getByRole('button', { name: 'Feet only' }).click()
  await transport(page, 'Play').click()
  await page.waitForTimeout(2500)
  expect(await voices()).toEqual(['low'])
  await transport(page, 'Stop').click()
})
