// Learn it grid wraps at beat boundaries: no sideways scroll at 390px, highlight moves across lines.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const shot = process.argv[3]
const songs = process.argv[4]?.split(',') ?? ['billiejean', 'ticks', 'rosetta', 'parabola', 'yyz', 'schism']
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
const fail = []
const check = (n, ok, x = '') => { console.log(`${ok ? 'ok' : 'FAIL'} ${n}${x ? ' · ' + x : ''}`); if (!ok) fail.push(n) }
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const G = '[aria-label="Bar notation with the count under each beat"]'
for (const id of songs) {
  await p.evaluate(async id => { window.__pulseEngine.stop(); await window.__pulseLoadSong(id, 1) }, id)
  await p.waitForTimeout(400)
  const d = p.locator('[role=dialog]')
  if (await d.getAttribute('aria-hidden') !== 'false') await p.locator('[aria-label="Browse rhythms"]').click()
  await d.getByRole('button', { name: 'Learn it', exact: true }).click()
  await p.locator(G).first().waitFor()
  const secs = d.locator('[aria-label="Sections"] button'); const n = await secs.count()
  let worst = 0, lines = 0, meters = new Set()
  for (let i = 0; i < n; i++) {
    await secs.nth(i).click(); await p.waitForTimeout(120)
    const r = await p.evaluate(G => { const g = document.querySelector(G), dl = document.querySelector('[role=dialog]')
      const over = Math.max(g.scrollWidth - g.clientWidth, g.getBoundingClientRect().right - 390, ...[...g.querySelectorAll('*')].map(e => e.getBoundingClientRect().right - 390), dl.scrollWidth - dl.clientWidth)
      return { over, lines: g.children.length, meter: document.querySelector('[role=dialog]').innerText.match(/\b\d+\/\d+\b/)?.[0] } }, G)
    worst = Math.max(worst, r.over); lines = Math.max(lines, r.lines); meters.add(r.meter)
  }
  check(`${id}: no horizontal overflow in ${n} sections`, worst <= 0.5, `max over ${worst.toFixed(1)}px, up to ${lines} lines, ${[...meters].join(' ')}`)
  // play and watch the amber cell land on more than one line
  await secs.nth(0).click(); await p.waitForTimeout(100)
  await d.locator('button[aria-label="Play"]').first().click()
  // sample which line is lit, noting how many lines the bar had at that moment (bars can differ in length)
  const seen = new Set(), seenMulti = new Set(); let multi = 0
  for (let t = 0; t < 40; t++) { await p.waitForTimeout(100)
    const [k, nl] = await p.evaluate(G => { const g = document.querySelector(G); return [[...g.children].findIndex(l => l.querySelector('.bg-amber\\/20')), g.children.length] }, G)
    if (k < 0) continue
    seen.add(k); if (nl > 1) { multi++; seenMulti.add(k) } }
  await d.locator('button[aria-label="Stop"]').first().click().catch(() => p.evaluate(() => window.__pulseEngine.stop()))
  check(`${id}: highlight follows across lines`, multi ? seenMulti.size >= 2 : seen.size >= 1, `multi-line samples ${multi}, lit lines ${[...seenMulti].join(',') || [...seen].join(',')}`)
  if (shot && id === songs[0]) { await secs.nth(0).click(); await p.waitForTimeout(150); await p.locator(G).scrollIntoViewIfNeeded(); await p.screenshot({ path: shot }) }
}
await b.close()
if (fail.length) { console.log('FAILED', fail.join(', ')); process.exit(1) }
console.log('wrap ok')
