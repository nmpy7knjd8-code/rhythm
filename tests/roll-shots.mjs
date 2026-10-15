// Screenshots of bars whose data has strokes faster than the grid (rolls/tremolos), and a count of slashed cells.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', dir = process.argv[3] ?? '/tmp/rolls'
const shots = [['anesthetize', 'Guitar Solo', 1], ['parabola', 'Chorus', 1], ['schizoid', 'Verse I', 2], ['lateralus', 'Intro', 7], ['50ways', 'Groove · bars 1–8', 1]]
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage()
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const d = p.locator('[role=dialog]'), G = '[aria-label="Bar notation with the count under each beat"]'
let bad = 0
for (const [id, sec, bar] of shots) {
  await p.evaluate(async id => { await window.__pulseLoadSong(id, 1) }, id); await p.waitForTimeout(400)
  if (await d.getAttribute('aria-hidden') !== 'false') await p.locator('[aria-label="Browse rhythms"]').click()
  await d.getByRole('button', { name: 'Learn it', exact: true }).click()
  await d.locator('[aria-label="Sections"] button', { hasText: new RegExp('^' + sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click(); await p.waitForTimeout(200)
  const bb = d.getByRole('button', { name: `Learn bar ${bar}`, exact: false })
  const btn = d.locator(`[aria-label$=" bars"] button`).nth(bar - 1); await btn.click(); await btn.click(); await p.waitForTimeout(300)
  const n = await p.locator(`${G} [aria-label$=" strokes"]`).count()
  const over = await p.evaluate(G => Math.max(...[...document.querySelectorAll(G + ' *')].map(e => e.getBoundingClientRect().right)) - 390, G)
  await p.locator(G).scrollIntoViewIfNeeded(); await p.locator(G).screenshot({ path: `${dir}/${id}.png` })
  const ok = n > 0 && over <= 0.5; if (!ok) bad++
  console.log(`${ok ? 'ok' : 'FAIL'} ${id} ${sec} bar ${bar}: ${n} slashed cells, overflow ${over.toFixed(1)}`)
}
// a plain groove gets none
await p.evaluate(async () => { await window.__pulseLoadSong('billiejean', 1) }); await p.waitForTimeout(400)
await d.locator('[aria-label="Sections"] button').nth(2).click(); await p.waitForTimeout(200)
const none = await p.locator(`${G} [aria-label$=" strokes"]`).count(); console.log(`${none ? 'FAIL' : 'ok'} billiejean verse: ${none} slashed cells`); if (none) bad++
await b.close(); if (bad) process.exit(1)
