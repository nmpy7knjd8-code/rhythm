// Records the real audio output of even 16th runs per drum (velocities ramp so samples and layers change every note) and writes WAVs
// for onset analysis (research/dense/onsets.py). Run with align on and off.
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const url = process.argv[2] ?? 'http://localhost:4173/rhythm/', kit = process.env.KIT ?? 'acoustic'
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage(); await p.goto(url, { waitUntil: 'networkidle' })
for (const align of [false, true]) for (const v of ['snare', 'tomFloor', 'kick', 'closedHat', 'pedalHat', 'crash1', 'tomHi']) {
  const wav = await p.evaluate(async ({ v, align, kit }) => {
    window.__pulseAlign.on = align; window.__pulseSetKit(kit); await new Promise(r => setTimeout(r, 2500))
    const e = window.__pulseEngine, vel = '3579357935793579'
    const bar = { id: 'run', name: 'run', steps: 16, stepsPerBeat: 4, ticksPerStep: 3, suggestedBpm: 110, timeSig: '4/4', tracks: { [{ snare: 'back', tomFloor: 'tomLo', kick: 'low', closedHat: 'tick', pedalHat: 'pedal', crash1: 'crash1', tomHi: 'tomHi' }[v]]: vel } }
    e.stop(); e.setFeel(0); e.setSong([bar, bar]); e.setSongBaseBpm?.(110); e.setBpm?.(110); e.jumpSong(0)
    const tctx = e.bus.context.rawContext, dest = tctx.createMediaStreamDestination(); e.bus.connect(dest)
    const ctx = window.__rec ??= new AudioContext(); await ctx.resume()
    const chunks = []; const proc = ctx.createScriptProcessor(4096, 1, 1); const src = ctx.createMediaStreamSource(dest.stream); src.connect(proc); proc.connect(ctx.destination)
    proc.onaudioprocess = ev => chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)))
    await new Promise(r => setTimeout(r, 300)); e.trace = []; await e.start(); await new Promise(r => setTimeout(r, 4600)); e.stop()
    proc.disconnect(); src.disconnect(); e.bus.disconnect(dest)
    const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length }
    return { sr: ctx.sampleRate, data: Array.from(all), firstT: e.trace[0]?.t ?? 0, step: 60 / 110 / 4 }
  }, { v, align, kit })
  writeFileSync(`/workspace/research/dense/run-${kit}-${v}-${align ? 'aligned' : 'raw'}.json`, JSON.stringify(wav))
  console.log(kit, v, align ? 'aligned' : 'raw', wav.data.length)
}
await b.close()
