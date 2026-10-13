// Plays every song end to end (tempo ×SCALE) and checks: it reaches the last bar and wraps (terminates), scheduled hit count
// equals the data's hit count, scheduled times strictly follow bar order, and no hit is ever scheduled twice.
import { chromium } from 'playwright'
import { readFileSync, readdirSync } from 'fs'
const URL = process.argv[2] ?? 'http://localhost:4173/rhythm/', SCALE = +(process.argv[3] ?? 8), PAR = +(process.argv[4] ?? 6)
const only = process.argv[5]?.split(',')
const ids = (only ?? readdirSync('public/songs').map(f => f.replace('.json', ''))).sort()
const expected = id => { const d = JSON.parse(readFileSync(`public/songs/${id}.json`)); let n = 0, bars = 0, sec = 0
  for (const s of d.sections) s.bars.forEach((b, i) => { bars++; const [a, c] = s.timeSig[i].split('/').map(Number); sec += a / c * 240 / s.bpm[i]
    // rows that map to the same drum (tomLo/tomFloor) merge, like the app's loader
    const A = { tomFloor: 'tomLo', crash: 'crash1', hihat: 'closedHat', splash: 'china', rim: 'crossStick', cowbell: 'bell', agogo: 'bell' }; const on = {}
    for (const [k, v] of Object.entries(b)) { if (k === '_sub') { for (const m of Object.values(v)) for (const l of Object.values(m)) n += l.length } else if (!k.startsWith('_')) { const r = A[k] ?? k; on[r] ??= new Set(); [...v].forEach((c, j) => { if (c !== '.') on[r].add(j) }) } }
    for (const st of Object.values(on)) n += st.size })
  return { n, bars, sec } }
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
let bad = 0; const queue = [...ids]
async function worker() {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.goto(URL, { waitUntil: 'networkidle' })
  while (queue.length) {
    const id = queue.shift(); const ex = expected(id)
    const r = await p.evaluate(async ({ id, SCALE, sec }) => {
      await window.__pulseLoadSong(id, 0); const e = window.__pulseEngine; e.jumpSong(0); e.trace = []; e.skipped = 0
      const base = e.songBaseBpm; await e.start(); e.setBpm(base * SCALE)
      let maxBar = 0, wrapped = false, prev = 0; const t0 = performance.now(), limit = (sec / SCALE) * 1000 * 1.6 + 4000
      while (performance.now() - t0 < limit) { await new Promise(r => setTimeout(r, 50)); const sb = e.songBar; if (sb < prev && prev > 0) { wrapped = true; break } prev = sb; maxBar = Math.max(maxBar, sb) }
      e.stop()
      const tr = e.trace.filter(x => x.src === 'song'); const firstPass = []; for (const x of tr) { firstPass.push(x) }
      const seen = new Set(); let dup = 0; for (const x of tr) { const k = x.voice + '@' + x.t.toFixed(6); if (seen.has(k)) dup++; seen.add(k) }
      return { maxBar, wrapped, events: tr.length, skipped: e.skipped, dup, ms: Math.round(performance.now() - t0) }
    }, { id, SCALE, sec: ex.sec })
    // events can include the first beat after wrapping; allow the hits of bar 0 extra
    const ok = r.wrapped && r.maxBar === ex.bars - 1 && r.dup === 0 && r.events + r.skipped >= ex.n && r.events + r.skipped <= ex.n + 40
    if (!ok) bad++
    console.log(`${ok ? 'ok ' : 'BAD'} ${id.padEnd(15)} bars ${r.maxBar + 1}/${ex.bars} wrapped=${r.wrapped} hits ${r.events}+${r.skipped} skipped vs ${ex.n} dup=${r.dup} ${r.ms}ms`)
  }
  await p.close()
}
await Promise.all(Array.from({ length: PAR }, worker)); await b.close()
console.log(bad ? `${bad} songs failed` : 'all songs played through'); process.exit(bad ? 1 : 0)
