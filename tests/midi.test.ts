import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_MAP, noteOn, sameDrum, scoredVoices } from '../src/midi/map.ts'
import { Scorer, tally, verdictOf, ON_MS, WINDOW_MS } from '../src/midi/score.ts'
import { calibrate } from '../src/midi/calibrate.ts'

test('Nitro Pro default notes (user guide §5.2) map to the right drums', () => {
  const nitro: [number, string][] = [[36, 'low'], [38, 'back'], [40, 'back'], [48, 'tomHi'], [50, 'tomHi'], [45, 'tomMid'], [47, 'tomMid'], [43, 'tomLo'], [58, 'tomLo'],
    [41, 'tomLo'], [39, 'tomLo'], [51, 'ride'], [49, 'crash1'], [57, 'crash2'], [46, 'open'], [23, 'open'], [42, 'tick'], [44, 'pedal'], [21, 'pedal']]
  for (const [n, v] of nitro) assert.equal(DEFAULT_MAP[n], v, `note ${n}`)
  assert.ok(sameDrum('tick', 'open') && sameDrum('back', 'accent') && sameDrum('crash1', 'china') && sameDrum('ride', 'rideBell'))
  assert.ok(!sameDrum('tomHi', 'tomMid') && !sameDrum('tick', 'pedal'))
})

test('only note-ons with velocity count', () => {
  assert.deepEqual(noteOn([0x99, 38, 100]), [38, 100]) // channel 10
  assert.deepEqual(noteOn([0x90, 36, 1]), [36, 1])
  assert.equal(noteOn([0x99, 38, 0]), null) // note-on velocity 0 is a note-off
  assert.equal(noteOn([0x89, 38, 64]), null)
  assert.equal(noteOn([0xb9, 4, 90]), null) // hi-hat pedal controller
  assert.equal(noteOn([0xa9, 49, 127]), null) // aftertouch (choke)
})

test('verdicts: on time within ±30 ms, otherwise early or late', () => {
  assert.equal(verdictOf(0), 'on'); assert.equal(verdictOf(ON_MS), 'on'); assert.equal(verdictOf(-ON_MS), 'on')
  assert.equal(verdictOf(-ON_MS - 1), 'early'); assert.equal(verdictOf(ON_MS + 1), 'late')
})

const note = (id: string, voice: 'back' | 'low' | 'tick' | 'tomHi' | 'tomMid', at: number) => ({ id, voice, at, t: at / 1000, bar: 0, step: 0, frac: 0 })

test('a hit matches the nearest note on the same drum inside its window', () => {
  const s = new Scorer()
  s.add(note('a', 'back', 1000)); s.add(note('b', 'back', 1500))
  const r = s.hit('accent', 1020) // rim shot on the snare: same drum
  assert.equal(r.kind, 'hit'); assert.ok(r.kind === 'hit' && r.note.id === 'a' && r.verdict === 'on' && r.err === 20)
  const e = s.hit('back', 1450)
  assert.ok(e.kind === 'hit' && e.note.id === 'b' && e.verdict === 'early' && e.err === -50)
  assert.equal(s.hit('back', 1600).kind, 'extra') // both notes taken
})

test('wrong drum near a note is flagged and does not use the note up', () => {
  const s = new Scorer()
  s.add(note('a', 'tomHi', 1000))
  const r = s.hit('tomMid', 1010)
  assert.ok(r.kind === 'wrong' && r.want === 'tomHi' && r.voice === 'tomMid')
  assert.equal(s.hit('tomHi', 1060).kind, 'hit')
})

test('windows shrink to half the gap between notes on one drum, and missed notes are swept', () => {
  const s = new Scorer()
  s.add(note('a', 'tick', 1000)); s.add(note('b', 'tick', 1080)) // 80 ms apart: each window ±40
  const r = s.hit('tick', 1045)
  assert.ok(r.kind === 'hit' && r.note.id === 'b' && r.verdict === 'early' && r.err === -35)
  const missed = s.sweep(1000 + WINDOW_MS + 1)
  assert.deepEqual(missed.map(m => m.note.id), ['a'])
  const t = tally(s.results)
  assert.deepEqual([t.on, t.early, t.late, t.miss, t.total], [0, 1, 0, 1, 2])
  assert.equal(t.score, 0.25)
})

test('between() selects results by audio time', () => {
  const s = new Scorer()
  s.add(note('a', 'low', 1000)); s.add(note('b', 'low', 2000))
  s.hit('low', 1000); s.hit('low', 2000)
  assert.deepEqual(s.between(0.5, 1.5).map(r => r.note.id), ['a'])
})

test('calibration: median offset of hits against clicks, first clicks ignored, strays dropped', () => {
  const clicks = Array.from({ length: 24 }, (_, i) => 1000 + i * 600)
  const jitter = (i: number) => [-8, -4, 0, 4, 8][i % 5] // ±8 ms, spread evenly
  const hits = clicks.map((c, i) => c + (i < 4 ? 250 : 180) + jitter(i))
  hits.push(clicks[10] + 290) // a stray double hit
  const c = calibrate(clicks, hits)!
  assert.ok(Math.abs(c.offset - 180) <= 2, `offset ${c.offset}`)
  assert.ok(c.spread <= 10)
  assert.equal(calibrate(clicks, hits.slice(0, 9)), null) // too few after the lead-in
})

test('scored voices follow the Learn it filter: solo, else the muted voices you fill in, else all; within hands or feet', () => {
  assert.equal(scoredVoices('all', [], []).size, 16)
  assert.deepEqual([...scoredVoices('all', ['back'], [])], ['back'])
  assert.deepEqual([...scoredVoices('all', ['back'], ['low'])], ['low'])
  assert.deepEqual([...scoredVoices('feet', [], [])].sort(), ['low', 'pedal'])
  assert.ok(!scoredVoices('hands', [], []).has('low') && scoredVoices('hands', [], []).has('tick'))
  assert.equal(scoredVoices('feet', [], ['back']).size, 0)
})

test('a roll stroke in the same step never overwrites the main note’s mark', async () => {
  const { marks, putMark, clearMarks } = await import('../src/midi/marks.ts')
  const n = (frac: number) => ({ id: String(frac), voice: 'back' as const, at: 0, t: 0, bar: 3, step: 4, frac })
  clearMarks()
  putMark(n(0), 'on'); putMark(n(0.5), 'miss')
  assert.equal(marks.get().get(3)!.get('4:back')!.m, 'on')
  clearMarks(3)
  putMark(n(0.5), 'late'); assert.equal(marks.get().get(3)!.get('4:back')!.m, 'late') // an off-grid-only cell still shows its mark
  putMark(n(0), 'early'); assert.equal(marks.get().get(3)!.get('4:back')!.m, 'early') // the main note takes over
})
