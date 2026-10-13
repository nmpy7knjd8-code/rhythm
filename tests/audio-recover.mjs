// Simulates iOS audio interruptions: suspended context, and an 'interrupted' context whose resume() never resolves.
import { chromium } from 'playwright'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(url + '?v=' + Date.now(), { waitUntil: 'networkidle' })
await p.evaluate(async () => { await window.__pulseLoadSong('yyz', 0) }); await p.waitForTimeout(400); await p.click('button[aria-label="Play"]'); await p.waitForTimeout(2500)
const st = () => p.evaluate(() => ({ ctx: window.__pulseEngine && (window.Tone?.getContext?.().rawContext.state), bar: window.__pulseEngine.songBar, playing: window.__pulseEngine.playing }))
const ctxState = () => p.evaluate(() => window.__pulseCtx?.state)
await p.evaluate(() => { window.__pulseCtx = window.__pulseEngine.ctx ?? null })
// 1) suspend (like an interruption), then tap the page
await p.evaluate(async () => { const c = window.__pulseEngine.rawCtx(); await c.suspend() })
const b1 = await st(); await p.waitForTimeout(1000); const b1b = await st()
await p.mouse.click(380, 830); await p.waitForTimeout(2500); const a1 = await st()
console.log('suspend', JSON.stringify({ frozen: [b1.bar, b1b.bar], afterTap: a1, state: await p.evaluate(() => window.__pulseEngine.rawCtx().state) }))
// 2) 'interrupted' with a resume() that never resolves the first time; stop + play must not hang
await p.evaluate(async () => { const c = window.__pulseEngine.rawCtx(); await c.suspend(); const real = c.resume.bind(c); let n = 0
  Object.defineProperty(c, 'state', { configurable: true, get: () => n < 1 ? 'interrupted' : Object.getPrototypeOf(c).__lookupGetter__('state').call(c) })
  c.resume = () => { if (n++ < 1) return new Promise(() => {}); delete c.state; return real() } })
await p.click('button[aria-label="Stop"]'); const t0 = Date.now(); await p.click('button[aria-label="Play"]')
await p.waitForSelector('button[aria-label="Stop"]', { timeout: 5000 }); const playMs = Date.now() - t0
await p.mouse.click(380, 830); await p.waitForTimeout(2500); const a2 = await st()
console.log('interrupted', JSON.stringify({ playButtonMs: playMs, after: a2, state: await p.evaluate(() => window.__pulseEngine.rawCtx().state) }))
const x = await st(); await p.waitForTimeout(2000); const y = await st(); console.log("advancing", x.bar, "->", y.bar, await p.evaluate(() => ({ tr: window.__pulseEngine.trState?.(), t: window.__pulseEngine.rawCtx().currentTime, ev: window.__pulseEngine.eventId })))
for (let i = 0; i < 3; i++) { console.log(JSON.stringify(await p.evaluate(() => ({ tr: window.__pulseEngine.trState(), t: window.__pulseEngine.rawCtx().currentTime, song: !!window.__pulseEngine.song, bar: window.__pulseEngine.songBar, tick: window.__pulseEngine.songTick, last: window.__pulseEngine.lastTime })))); await p.waitForTimeout(700) }
console.log("hang-guard", JSON.stringify(await p.evaluate(async () => { const e = window.__pulseEngine, c = e.rawCtx(); await c.suspend(); const real = c.resume; c.resume = () => new Promise(() => {}); const t0 = performance.now(); const ok = await e.wake(); const ms = Math.round(performance.now() - t0); c.resume = real; await e.wake(); return { resolvedMs: ms, ok, finalState: c.state } })))
await b.close()
