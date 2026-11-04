import { test } from 'node:test'
import assert from 'node:assert/strict'
import { POLYRHYTHMS, POLY_SOURCES, polyBar, polyCount, engineBpm } from '../src/data/polyrhythms'

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x)
const hits = (s: string) => [...s].flatMap((c, i) => (c === '.' ? [] : [i]))
const ratios = POLYRHYTHMS.filter(p => !p.named)

test('every ratio from 2 to 9 against 2 to 9 in lowest terms, each once, plus the named forms', () => {
  const want: string[] = []
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a !== b && gcd(a, b) === 1) want.push(`${a}:${b}`)
  assert.deepEqual(ratios.map(p => `${p.a}:${p.b}`).sort(), want.sort())
  assert.equal(want.length, 38)
  assert.equal(new Set(POLYRHYTHMS.map(p => p.id)).size, POLYRHYTHMS.length)
  assert.deepEqual(POLYRHYTHMS.filter(p => p.named).map(p => p.id), ['poly-standard-bell', 'poly-horizontal-hemiola'])
  for (const k of ['3:2', '2:3', '4:3', '3:4']) assert.ok(ratios.find(p => `${p.a}:${p.b}` === k)!.featured, k)
})

test('each layer is evenly spaced and the two only meet on the one', () => {
  for (const p of ratios) {
    const c = hits(p.cross), u = hits(p.pulse)
    assert.equal(c.length, p.a, p.id); assert.equal(u.length, p.b, p.id)
    assert.equal(p.cross.length, p.steps); assert.equal(p.pulse.length, p.steps)
    c.forEach((h, i) => assert.equal(h * p.a, i * p.steps, p.id)) // note i sits at i/a of the cycle
    u.forEach((h, i) => assert.equal(h * p.b, i * p.steps, p.id))
    assert.deepEqual(c.filter(h => u.includes(h)), [0], p.id)
  }
})

test('the beat layer plays at the chosen tempo', () => {
  for (const p of POLYRHYTHMS) for (const bpm of [40, 80, 160]) {
    const bar = polyBar(p, bpm)
    assert.ok(Number.isInteger(bar.ticksPerStep) && bar.ticksPerStep! >= 1, p.id)
    // one engine tick = 5 / engine bpm seconds; the cycle holds as many beats as the pulse layer has notes
    const cycleSec = bar.steps * bar.ticksPerStep! * 5 / bar.suggestedBpm!
    assert.ok(Math.abs(cycleSec - hits(p.pulse).length * 60 / bpm) < 1e-9, p.id)
    assert.equal(engineBpm(p, bpm), bar.suggestedBpm)
    assert.ok(bar.suggestedBpm! >= 20 && bar.suggestedBpm! <= 300, `${p.id} engine tempo ${bar.suggestedBpm}`)
    assert.deepEqual(Object.keys(bar.tracks).sort(), ['bell', 'low']) // a separate drum per layer
  }
})

test('the count speaks 1, 2, 3… on each note of the chosen layer', () => {
  const p = ratios.find(x => x.a === 3 && x.b === 2)!
  assert.deepEqual(polyCount(p, 'cross'), ['1', '', '2', '', '3', ''])
  assert.deepEqual(polyCount(p, 'pulse'), ['1', '', '', '2', '', ''])
})

test('examples only where a source names them; unsourced feels are marked general', () => {
  for (const p of POLYRHYTHMS) {
    assert.ok(p.feel && p.about, p.id)
    for (const u of p.uses) assert.ok(POLY_SOURCES[u.source], `${p.id}: ${u.source}`)
    if (p.generic && !['5:4', '4:7', '7:8', '8:7'].includes(`${p.a}:${p.b}`)) assert.equal(p.uses.length, 0, p.id)
    if (!p.generic) assert.ok(p.uses.length > 0, p.id)
  }
})
