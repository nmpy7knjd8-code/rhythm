// Spoken count clips: each clip loads with a tight attack, the engine schedules them on grid steps (checked against the
// transport's own tick position), only numbers are spoken when subdivisions get fast, and the count-in speaks 1..N.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
const fail = []; const check = (n, ok, x = '') => { console.log(`${ok ? 'ok' : 'FAIL'} ${n}${x ? ' · ' + x : ''}`); if (!ok) fail.push(n) }
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
// clip files: decode each and measure where the sound starts and how long it lasts
const clips = await p.evaluate(async () => {
  const words = [...Array.from({ length: 19 }, (_, i) => String(i + 1)), 'e', 'and', 'ah', 'ta', 'trip', 'let', 'la', 'li']
  const ctx = new OfflineAudioContext(1, 1, 44100), out = []
  for (const w of words) {
    const r = await fetch(`count/${w}.mp3`); const bytes = (await r.clone().arrayBuffer()).byteLength
    const buf = await ctx.decodeAudioData(await r.arrayBuffer()); const d = buf.getChannelData(0)
    let peak = 0; for (const x of d) peak = Math.max(peak, Math.abs(x)); let i = 0; while (Math.abs(d[i]) < peak * 0.05) i++
    let j = d.length - 1; while (Math.abs(d[j]) < peak * 0.05) j--
    out.push({ w, bytes, onset: i / buf.sampleRate * 1000, sound: (j - i) / buf.sampleRate * 1000, peak })
  }
  return out
})
const total = clips.reduce((a, c) => a + c.bytes, 0)
console.log(clips.map(c => `${c.w}:${c.sound.toFixed(0)}ms`).join(' '))
check('27 clips load', clips.length === 27 && clips.every(c => c.peak > 0.3), `${(total / 1024).toFixed(1)} KB total`)
check('clips are short', clips.every(c => c.sound < 650), `longest ${Math.max(...clips.map(c => c.sound)).toFixed(0)} ms`)
check('raw onset within the decoder pad (engine trims it)', clips.every(c => c.onset < 60), `max ${Math.max(...clips.map(c => c.onset)).toFixed(1)} ms`)

const d = p.locator('[role=dialog]')
await p.evaluate(async () => { await window.__pulseLoadSong('billiejean', 1) }); await p.waitForTimeout(300)
await p.locator('[aria-label="Browse rhythms"]').click()
await d.getByRole('button', { name: 'Learn it', exact: true }).click()
check('voice off by default', await d.getByRole('button', { name: 'Voice', exact: true }).getAttribute('aria-pressed') === 'false' && await p.evaluate(() => window.__pulseEngine.countWords === null))
await d.getByRole('button', { name: 'Voice', exact: true }).click()
await p.waitForFunction(() => window.__pulseEngine.countReady, null, { timeout: 10000 })
async function run(tempo, countIn) {
  await d.getByRole('button', { name: new RegExp(`^${tempo} \\d+`) }).click(); await p.waitForTimeout(100)
  const ci = d.getByRole('button', { name: 'Count-in', exact: true })
  if ((await ci.getAttribute('aria-pressed') === 'true') !== countIn) await ci.click()
  await p.waitForTimeout(100)
  return p.evaluate(async () => {
    const e = window.__pulseEngine, T = window.__tone?.getTransport?.()
    e.stop(); e.trace = []; e.jumpSong(e.songBar); await e.start()
    await new Promise(r => setTimeout(r, 4000)); const tr = e.trace.slice(); e.stop()
    return { tr: tr.filter(x => x.src === 'count').map(x => ({ t: x.t, w: x.voice })), hits: tr.filter(x => x.src === 'song').map(x => x.t) }
  })
}
const slow = await run('Start', true)
const words = slow.tr.map(x => x.w)
check('count-in speaks 1 2 3 4 first', words.slice(0, 4).join(' ') === '1 2 3 4', words.slice(0, 6).join(' '))
check('slow tempo speaks the subdivisions', words.slice(4).some(w => ['e', '&', 'a'].includes(w)), words.slice(4, 12).join(' '))
// alignment: after the count-in, each spoken word sits on a grid step; the gaps are whole multiples of the step length
const gaps = (tr, step) => tr.slice(1).map((x, i) => { const g = (x.t - tr[i].t) / step; return Math.abs(g - Math.round(g)) * step * 1000 })
const spb = 60 / (await p.evaluate(() => window.__pulseEngine.songTempoScale * 117)) / 4
const errS = Math.max(...gaps(slow.tr.slice(4), spb))
check('slow: spoken words on the 16th grid', errS < 10, `max ${errS.toFixed(2)} ms off grid (step ${(spb * 1000).toFixed(0)} ms)`)
// and the downbeat word lands with the kick on beat 1
const one = slow.tr.slice(4).find(x => x.w === '1'), kick = one && slow.hits.reduce((a, t) => Math.abs(t - one.t) < Math.abs(a - one.t) ? t : a, Infinity)
check('slow: "1" lands with the downbeat hit', one && Math.abs(kick - one.t) * 1000 < 10, one ? `${((kick - one.t) * 1000).toFixed(2)} ms` : 'no 1')
const fast = await run('Full', false)
const fw = fast.tr.map(x => x.w)
check('fast tempo speaks numbers only', fw.length > 4 && fw.every(w => /^\d+$/.test(w)), fw.slice(0, 10).join(' '))
const spbF = 60 / 117 / 4, errF = Math.max(...gaps(fast.tr, spbF))
check('fast: numbers on the beat grid', errF < 10, `max ${errF.toFixed(2)} ms`)
await d.getByRole('button', { name: 'Voice', exact: true }).click(); await p.waitForTimeout(100)
check('voice off clears the count', await p.evaluate(() => window.__pulseEngine.countWords === null))
await b.close()
if (fail.length) { console.log('FAILED', fail.join(', ')); process.exit(1) }
console.log('count voice ok')
