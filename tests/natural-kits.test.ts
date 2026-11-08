import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { KITS } from '../src/data/kits'
import { applyShift, applyTuning, hitGate, hitPlaybackRate, type Tuning } from '../src/engine/pitch'

const kit = (id: string) => {
  const k = KITS.find(x => x.id === id)
  assert.ok(k, id)
  return k
}

test('the default kit is still the Salamander acoustic kit', () => {
  assert.equal(KITS[0].id, 'acoustic')
  assert.equal(KITS.filter(k => k.id === 'acoustic').length, 1)
  assert.ok(KITS.some(k => k.id === 'acoustic-big'))
  assert.ok(KITS.some(k => k.id === 'acoustic-vintage'))
  for (const id of ['rusty', 'pulse-rock', 'virtuosity']) assert.equal(kit(id).naturalPitch, true)
})

test('natural kits ignore Salamander tuning, song pitch and the sample wobble', () => {
  const tuning: Tuning = { low: 36, tomLo: 50, tomMid: 55, tomHi: 60, back: 64 }
  const shift = { low: -2, tomLo: -2, tomHi: -1, tomMid: -1 }
  for (const id of ['rusty', 'pulse-rock', 'virtuosity']) {
    const k = kit(id)
    assert.equal(applyTuning(k, tuning), k)
    assert.equal(applyShift(k, shift), k)
    for (const v of Object.values(k.voices)) assert.equal(v.rate, undefined)
    for (let i = 1; i <= 6; i++) assert.equal(hitPlaybackRate(true, 0.84, 0.9 * 0.94, i), 1)
    assert.equal(hitGate(true, 0.22), 0)
  }
  const acoustic = applyTuning(KITS[0], tuning)
  assert.notEqual(acoustic, KITS[0])
  assert.ok(Math.abs((acoustic.voices.tomHi.rate ?? 1) - 1) > 0.05)
  const wobbles = [1, 2, 3, 4, 5].map(i => hitPlaybackRate(false, 1, 0.86, i))
  assert.ok(wobbles.some(r => Math.abs(r - 1) > 0.05))
  assert.equal(hitGate(false, 0.22), 0.22)
})

test('velocity layers use the upstream thresholds, and the files are the ones shipped', () => {
  const rock = kit('pulse-rock')
  assert.equal(rock.voices.low.layers!.length, 5)
  assert.ok(Math.abs(rock.voices.low.layers![0].vel - 26 / 127) < 1e-6)
  assert.equal(rock.voices.low.layers![0].files.length, 1)
  const rusty = kit('rusty')
  assert.equal(rusty.voices.tomHi.layers!.length, 6)
  assert.equal(rusty.voices.tomMid.layers!.length, 7)
  assert.equal(rusty.voices.tomLo.layers!.length, 8)
  assert.equal(rusty.voices.low.layers!.length, 14)
  assert.equal(rusty.voices.back.layers!.length, 10)
  assert.equal(rusty.voices.tomHi.layers![0].files.length, 4)
  const virt = kit('virtuosity')
  assert.equal(virt.voices.back.layers!.length, 36)
  assert.equal(virt.voices.tomHi.layers!.length, 16)
  assert.equal(virt.voices.tomHi.layers![0].files.length, 1)
  for (const k of [rock, rusty, virt]) {
    const rel = k.voices.low.layers![k.voices.low.layers!.length - 1].files[0]
    assert.ok(fs.existsSync(rel.replace('../', 'public/samples/')), rel)
  }
})

test('two-tom kits share the high tom on the mid slot and label it', () => {
  for (const id of ['pulse-rock', 'virtuosity']) {
    const k = kit(id)
    assert.equal(k.voices.tomMid.sharedFrom, 'tomHi')
    assert.deepEqual(k.voices.tomMid.layers, k.voices.tomHi.layers)
    assert.notDeepEqual(k.voices.tomLo.layers![0].files, k.voices.tomHi.layers![0].files)
    assert.equal(k.voices.tomMid.rate, undefined)
    assert.match(k.blurb, /same/)
    assert.match(k.blurb, /not a pitch/)
  }
})

test('Big Rusty keeps four different toms, and the low-floor variant is the 22 inch drum', () => {
  const k = kit('rusty')
  const first = (voice: 'tomHi' | 'tomMid' | 'tomLo') => k.voices[voice].layers![0].files[0]
  assert.ok(first('tomHi').includes('t14_'))
  assert.ok(first('tomMid').includes('t15_'))
  assert.ok(first('tomLo').includes('t18_'))
  const floor = k.voices.tomLo.alts!.tomFloor2!
  assert.ok(floor[0].files[0].includes('t22_'))
  assert.equal(floor.length, 7)
  assert.notEqual(floor[0].files[0], first('tomLo'))
})

test('Virtuosity leaves china silent and Pulse Rock splash is the recorded splash', () => {
  const virt = kit('virtuosity')
  assert.equal(virt.voices.china.silent, true)
  assert.equal(virt.voices.china.fallback, undefined)
  assert.deepEqual(virt.voices.china.layers, [])
  const rock = kit('pulse-rock')
  assert.ok(rock.voices.crash1.alts!.splash![0].files[0].includes('Splash'))
  assert.equal(rock.voices.china.silent, undefined)
  assert.ok(rock.voices.china.layers!.length > 0)
})

test('Salamander open-hat and crash trims are not copied onto the new kits', () => {
  const acoustic = KITS[0]
  assert.ok(acoustic.voices.open.gain! < 0.35)
  const ratio = acoustic.voices.crash2.gain! / acoustic.voices.crash1.gain!
  assert.ok(Math.abs(ratio - 10 ** (-3 / 20)) < 0.02)
  for (const id of ['rusty', 'pulse-rock', 'virtuosity']) {
    const k = kit(id)
    assert.ok(k.voices.open.gain! > acoustic.voices.open.gain!)
    const own = k.voices.crash2.gain! / k.voices.crash1.gain!
    assert.ok(Math.abs(own - ratio) > 0.02)
  }
})
