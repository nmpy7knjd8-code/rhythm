// Now playing step grid vs audio: when the amber step moves, how far is that from when the note is heard?
// on screen = commit time + one frame; heard = timeline time (feel included) + outputLatency + baseLatency, all on the audio-context clock.
// The bar ring in the section strip is checked the same way against the first step of each bar.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const LIMIT = +(process.argv[3] ?? 10), SECS = +(process.env.SECS ?? 15)
const only = process.env.ONLY?.split(',')
const cases = [
  ['billiejean', 'start'], ['yyz', 'start'], ['schism', 'start'], ['thepackage', 'start'],
  ['fearinoculum', 'start'], ['killing', 'start'], ['killing', 'seek'], ['backinblack', 'loop'], ['purdie', 'tempo'],
  ['killing', 'full'],
]
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
const d = p.locator('[role=dialog]')
const stats = a => { const o = a.slice().sort((x, y) => x - y); if (!o.length) return null
  const med = o[o.length >> 1], lo = o[Math.floor(o.length * 0.05)], hi = o[Math.floor(o.length * 0.95)]
  const q = Math.floor(a.length / 4), md = x => x.slice().sort((u, v) => u - v)[x.length >> 1]
  return { n: o.length, med, p95: Math.abs(lo) > Math.abs(hi) ? lo : hi, drift: q ? md(a.slice(-q)) - md(a.slice(0, q)) : 0 } }
let bad = 0
for (const [id, mode] of cases.filter(([id, m]) => !only || only.includes(id + ':' + m) || only.includes(id))) {
  await p.evaluate(async id => { window.__pulseEngine.stop(); await window.__pulseLoadSong(id, 0) }, id); await p.waitForTimeout(400)
  if (await d.getAttribute('aria-hidden') !== 'false') await p.locator('[aria-label="Browse rhythms"]').click()
  await d.getByRole('button', { name: 'Now playing', exact: true }).click(); await p.waitForTimeout(200)
  await d.locator('button[aria-label="Play"]').first().click(); await p.waitForTimeout(600)
  if (mode === 'loop') await d.locator('button[aria-label^="Loop "]').nth(2).click()
  const secs = mode === 'full' ? await p.evaluate(() => { const e = window.__pulseEngine; return e.song.bars.reduce((s, x) => s + (x.steps * (x.ticksPerStep ?? 3) / 48) * 4 * 60 / (x.suggestedBpm ?? e.songBaseBpm), 0) + 2 }) : SECS
  const r = await p.evaluate(async ({ secs, mode }) => {
    const e = window.__pulseEngine, c = e.rawCtx(), dlg = document.querySelector('[role=dialog]')
    const seen = [], rings = []; let last = null, lastRing = null, stop = false, frames = [], lastTs = 0
    const mo = new MutationObserver(() => {
      const cell = dlg.querySelector('.sticky span.bg-amber\\/25'); const s = cell ? [...cell.parentElement.children].indexOf(cell) : null
      if (s !== null && s !== last) seen.push({ s, at: c.currentTime }); last = s
      const ring = dlg.querySelector('[role=slider] > span.ring-amber'), strip = ring?.parentElement, li = ring?.closest('li')
      const n = ring ? li.parentElement && [...li.parentElement.children].indexOf(li) * 10000 + [...strip.children].indexOf(ring) : null
      if (n !== null && n !== lastRing) rings.push({ n, at: c.currentTime }); lastRing = n
    })
    mo.observe(dlg, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true })
    const fr = ts => { if (stop) return; if (lastTs) frames.push(ts - lastTs); lastTs = ts; requestAnimationFrame(fr) }; requestAnimationFrame(fr)
    const tl = []; const keep = setInterval(() => { for (const x of e.timeline) if (!tl.length || x.t > tl[tl.length - 1].t) tl.push({ ...x }) }, 200)
    if (mode === 'seek') setTimeout(() => [...dlg.querySelectorAll('button')].find(x => x.textContent === 'Skip to the good part')?.click(), secs * 400)
    if (mode === 'tempo') setTimeout(() => e.setBpm(e.songBaseBpm * 1.3), secs * 400)
    await new Promise(r => setTimeout(r, secs * 1000)); stop = true; mo.disconnect(); clearInterval(keep)
    for (const x of e.timeline) if (!tl.length || x.t > tl[tl.length - 1].t) tl.push({ ...x })
    frames.sort((a, b) => a - b); const fd = frames[frames.length >> 1] || 16.7
    const lat = (c.outputLatency || 0) + (c.baseLatency || 0)
    const near = (at, ok) => { let best = null; for (const t of tl) if (ok(t) && (best === null || Math.abs(at - t.t - lat) < Math.abs(at - best.t - lat))) best = t; return best }
    const offs = seen.slice(2).map(x => { const t = near(x.at, t => t.step === x.s); return t ? (x.at - t.t - lat) * 1000 + fd : null }).filter(v => v !== null && Math.abs(v) < 400)
    const ringOffs = rings.slice(1).map(x => { const t = near(x.at, t => t.step === 0); return t ? (x.at - t.t - lat) * 1000 + fd : null }).filter(v => v !== null && Math.abs(v) < 400)
    return { lat: lat * 1000, fd, offs, ringOffs, loop: e.song.loop }
  }, { secs, mode })
  await d.locator('button[aria-label="Stop"]').first().click().catch(() => {})
  if (mode === 'loop') await d.locator('button[aria-label^="Loop "][aria-pressed="true"]').first().click().catch(() => {})
  const s = stats(r.offs), g = stats(r.ringOffs)
  const ok = s && s.n > 4 && Math.abs(s.drift) <= 8 && Math.abs(s.med) <= LIMIT && Math.abs(s.p95) <= LIMIT + r.fd && (!g || Math.abs(g.med) <= LIMIT + r.fd)
  if (!ok) bad++
  const f = x => x?.toFixed(1)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(13)} ${mode.padEnd(5)} step n=${String(s?.n ?? 0).padStart(4)} median ${f(s?.med)} ms · p95 ${f(s?.p95)} · drift ${f(s?.drift)} | bar ring n=${g?.n ?? 0} median ${f(g?.med)} | latency ${r.lat.toFixed(1)} ms · frame ${r.fd.toFixed(1)}${r.loop ? ' · loop ' + r.loop.join('-') : ''}`)
}
await b.close()
if (bad) { console.log('FAILED', bad); process.exit(1) }
console.log('sync ok')
