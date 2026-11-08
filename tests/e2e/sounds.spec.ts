import { expect, test } from '@playwright/test'
import { sheet } from './app'

test('Sound tab keeps Acoustic and offers the three recorded kits', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' })
  await page.getByLabel('Browse rhythms').click()
  const d = sheet(page)
  await d.getByRole('button', { name: 'Sound', exact: true }).click()
  const kit = d.getByLabel('Kit')
  await expect(kit).toHaveValue('acoustic')
  const labels = await kit.locator('option').allTextContents()
  for (const name of ['Acoustic kit', 'Big prog kit', 'Warm vintage kit', 'Big Rusty', 'Pulse Rock', 'Virtuosity']) {
    expect(labels).toContain(name)
  }
  await kit.selectOption('pulse-rock')
  await expect(d.getByText('not a third drum')).toBeVisible()
  await page.screenshot({ path: '/opt/cursor/artifacts/sounds-tab-pulse-rock.png' })
  await kit.selectOption('virtuosity')
  await expect(d.getByText('china notes stay silent')).toBeVisible()
  await kit.selectOption('rusty')
  await expect(d.getByText('22" drum')).toBeVisible()
})

test('a selected kit loads its own samples and plays toms at the recorded rate', async ({ page }) => {
  const urls: string[] = []
  page.on('request', req => { const u = req.url(); if (u.includes('/samples/')) urls.push(u) })
  await page.goto('./', { waitUntil: 'networkidle' })
  await page.getByLabel('Browse rhythms').click()
  const d = sheet(page)
  await d.getByRole('button', { name: 'Sound', exact: true }).click()
  await d.getByLabel('Kit').selectOption('pulse-rock')
  await page.waitForResponse(res => res.url().includes('/samples/pulse-rock/') && res.ok())
  await page.evaluate(async () => {
    const w = window as unknown as { __pulseAlign: { crashChokes: number; lastRate: number }; __pulseLoadSong(id: string, n: number): Promise<void> }
    w.__pulseAlign.crashChokes = 0
    w.__pulseAlign.lastRate = -1
    await w.__pulseLoadSong('airtonight', 0)
  })
  await d.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => {
    const a = (window as unknown as { __pulseAlign: { lastVoice: string; lastRate: number; lastFile: string } }).__pulseAlign
    return a.lastVoice === 'tomHi' && a.lastRate === 1 && a.lastFile.includes('pulse-rock/')
  }, undefined, { timeout: 20000 })
  const choked = await page.evaluate(() => (window as unknown as { __pulseAlign: { crashChokes: number } }).__pulseAlign.crashChokes)
  expect(choked).toBe(0)
  expect(urls.some(u => u.includes('/samples/pulse-rock/'))).toBeTruthy()
  expect(urls.some(u => u.includes('/samples/rusty/') || u.includes('/samples/virtuosity/'))).toBeFalsy()
})

test('the same tom on the acoustic kit still follows the song tuning', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' })
  await page.evaluate(() => (window as unknown as { __pulseSetKit(id: string): void }).__pulseSetKit('acoustic'))
  await page.waitForResponse(res => res.url().includes('/samples/acoustic/') && res.ok())
  await page.evaluate(async () => {
    const w = window as unknown as { __pulseAlign: { lastRate: number }; __pulseLoadSong(id: string, n: number): Promise<void> }
    w.__pulseAlign.lastRate = -1
    await w.__pulseLoadSong('airtonight', 0)
  })
  await page.getByLabel('Browse rhythms').click()
  await sheet(page).getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForFunction(() => {
    const a = (window as unknown as { __pulseAlign: { lastVoice: string; lastRate: number; lastFile: string } }).__pulseAlign
    return a.lastVoice === 'tomHi' && a.lastRate > 0 && a.lastFile.includes('tomHi')
  }, undefined, { timeout: 20000 })
  const rate = await page.evaluate(() => (window as unknown as { __pulseAlign: { lastRate: number } }).__pulseAlign.lastRate)
  expect(Math.abs(rate - 1)).toBeGreaterThan(0.04)
})
