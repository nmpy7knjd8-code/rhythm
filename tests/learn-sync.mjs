// Learn it highlight vs audio: when the amber cell moves, how far is that from when the note is heard?
// on screen = commit time + one frame; heard = scheduled hit time (feel included) + outputLatency + baseLatency, all on the audio-context clock.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const LIMIT = +(process.argv[3] ?? 15), SECS = +(process.env.SECS ?? 5)
const only = process.env.ONLY?.split(',')
const cases = [
  ['billiejean', 'full'], ['billiejean', 'start'], ['purdie', 'full'], ['purdie', 'start'], ['sugar', 'full'],
  ['cometogether', 'full'], ['yyz', 'full'], ['schism', 'start'], ['rosetta', 'full'], ['billiejean', 'loop'], ['purdie', 'loop'],
]
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const d = p.locator('[role=dialog]')
let bad = 0
for (const [id, mode] of cases.filter(([id, m]) => !only || only.includes(id + ':' + m))) {
  await p.evaluate(async id => { window.__pulseEngine.stop(); await window.__pulseLoadSong(id, 1) }, id); await p.waitForTimeout(400)
  if (await d.getAttribute('aria-hidden') !== 'false') await p.locator('[aria-label="Browse rhythms"]').click()
  await d.getByRole('button', { name: 'Learn it', exact: true }).click()
  await d.locator('[aria-label="Sections"] button').nth(Math.min(2, await d.locator('[aria-label="Sections"] button').count() - 1)).click()
  await p.waitForTimeout(200)
  await d.getByRole('button', { name: mode === 'start' ? /^Start \d+/ : /^Full \d+/ }).click()
  if (mode === 'loop') { const bars = d.locator('[aria-label$=" bars"] button'); await bars.nth(1).click(); await bars.nth(2).click() }
  await p.waitForTimeout(150)
  await d.locator('button[aria-label="Play"]').first().click()
  const r = await p.evaluate(async SECS => {
    const e = window.__pulseEngine, c = e.rawCtx(), g = () => document.querySelector('[aria-label="Bar notation with the count under each beat"]')
    // commit time from a MutationObserver; it reaches the screen at the next refresh (~one frame later)
    const seen = []; let last = null, stop = false, frames = [], lastTs = 0
    const mo = new MutationObserver(() => { const el = g()?.querySelector('[data-s].bg-amber\\/20'); const s = el ? +el.dataset.s : null
      if (s !== null && s !== last) seen.push({ s, at: c.currentTime }); last = s })
    mo.observe(document.querySelector('[role=dialog]'), { subtree: true, attributes: true, attributeFilter: ['class'], childList: true })
    const fr = ts => { if (stop) return; if (lastTs) frames.push(ts - lastTs); lastTs = ts; requestAnimationFrame(fr) }; requestAnimationFrame(fr)
    await new Promise(r => setTimeout(r, SECS * 1000)); stop = true; mo.disconnect()
    frames.sort((a, b) => a - b); const fd = frames[frames.length >> 1] || 16.7
    const lat = e.latency(), tl = e.timeline.slice() // reported output latency (native context) + the sound route's delay
    const offs = seen.slice(2).map(x => { let best = null; for (const t of tl) if (t.step === x.s && (best === null || Math.abs(x.at - t.t - lat) < Math.abs(x.at - best.t - lat))) best = t; return best ? (x.at - best.t - lat) * 1000 + fd : null }).filter(v => v !== null)
    return { n: offs.length, lat: lat * 1000, offs, loop: e.song.loop, fd }
  }, SECS)
  await d.locator('button[aria-label="Stop"]').first().click().catch(() => {})
  const o = r.offs.slice().sort((a, b) => a - b), med = o[o.length >> 1] ?? NaN, max = Math.max(...o.map(Math.abs))
  const p95 = Math.abs(o[Math.floor(o.length * 0.05)] ?? NaN) > Math.abs(o[Math.floor(o.length * 0.95)] ?? NaN) ? o[Math.floor(o.length * 0.05)] : o[Math.floor(o.length * 0.95)]
  const q = Math.floor(r.offs.length / 4), md = a => a.slice().sort((x, y) => x - y)[a.length >> 1], drift = q ? md(r.offs.slice(-q)) - md(r.offs.slice(0, q)) : 0
  const ok = Math.abs(drift) <= 8 && o.length > 4 && Math.abs(med) <= LIMIT && Math.abs(p95) <= LIMIT + r.fd // one frame of display quantisation is unavoidable
  if (!ok) bad++
  console.log(`${ok ? 'ok' : 'FAIL'} ${id.padEnd(13)} ${mode.padEnd(5)} n=${String(o.length).padStart(3)} median ${med.toFixed(1)} ms · p95 ${p95?.toFixed(1)} · max |${max.toFixed(1)}| · drift ${drift.toFixed(1)} · latency ${r.lat.toFixed(1)} ms${r.loop ? ' · loop ' + r.loop.join('-') : ''}`)
}
await b.close()
if (bad) { console.log('FAILED', bad); process.exit(1) }
console.log('sync ok')
