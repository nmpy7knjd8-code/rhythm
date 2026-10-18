import assert from 'node:assert/strict'
import { test } from 'node:test'

// a minimal localStorage, like the browser's
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: k => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)) }, removeItem: k => { store.delete(k) },
  clear: () => store.clear(), key: () => null, get length() { return store.size },
}
const { ago, bests, forgetPractice, recallPractice, recordLoop, reviewPick, savePractice, sectionKey } = await import('../src/learn/memory.ts')

const DAY = 86_400_000
const base = { countIn: true, click: false, voice: true, limb: 'hands' as const, muted: ['low' as const], solo: [], stepOn: true, step: 2, trainer: true, every: 8 as const, loops: 3, pin: 12 }

test('habits carry to every song, song choices stay with the song, the sitting ends when the song is loaded again', () => {
  store.clear()
  savePractice('a', base)
  assert.deepEqual(recallPractice('a'), base)
  forgetPractice('a') // loading the song again
  const again = recallPractice('a')
  assert.equal(again.limb, 'hands'); assert.deepEqual(again.muted, ['low']); assert.equal(again.step, 2)
  assert.equal(again.trainer, undefined); assert.equal(again.pin, undefined); assert.equal(again.loops, undefined)
  const other = recallPractice('b')
  assert.equal(other.countIn, true); assert.equal(other.every, 8); assert.equal(other.limb, undefined)
})

test('the best tempo only goes up; every full loop updates when you last played it', () => {
  store.clear()
  const k = sectionKey(1, 'Verse 1'), t0 = new Date(2026, 9, 10, 12).getTime()
  recordLoop('a', k, 80, t0)
  recordLoop('a', k, 70, t0 + DAY)
  assert.deepEqual(bests('a')[k], { pct: 80, at: t0, last: t0 + DAY })
  recordLoop('a', k, 85, t0 + 2 * DAY)
  assert.deepEqual(bests('a')[k], { pct: 85, at: t0 + 2 * DAY, last: t0 + 2 * DAY })
  assert.deepEqual(bests('b'), {})
})

test('ago counts calendar days', () => {
  const now = new Date(2026, 9, 18, 0, 30).getTime()
  assert.equal(ago(now - 10 * 60_000, now), 'today')
  assert.equal(ago(new Date(2026, 9, 17, 23, 50).getTime(), now), 'yesterday')
  assert.equal(ago(new Date(2026, 9, 16, 9).getTime(), now), '2 days ago')
})

test('review picks the section practised longest ago, never today or the one open', () => {
  const now = new Date(2026, 9, 18, 18).getTime()
  const r = { '0:Intro': { pct: 100, at: 0, last: now - 3 * DAY }, '1:Verse': { pct: 85, at: 0, last: now - 2 * DAY }, '2:Chorus': { pct: 90, at: 0, last: now - 60_000 } }
  const keys = ['0:Intro', '1:Verse', '2:Chorus', '3:Bridge']
  assert.equal(reviewPick(r, keys, '2:Chorus', now), '0:Intro')
  assert.equal(reviewPick(r, keys, '0:Intro', now), '1:Verse')
  assert.equal(reviewPick({ '2:Chorus': r['2:Chorus'] }, keys, '0:Intro', now), null)
})

test('broken storage is ignored, not fatal', () => {
  store.clear(); store.set('pulse.learn.v1', '{not json')
  assert.deepEqual(recallPractice('a'), {})
  recordLoop('a', '0:Intro', 60)
  assert.equal(bests('a')['0:Intro'].pct, 60)
})
