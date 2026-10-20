import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heardTime, nativeOf, reportedLatency } from '../src/engine/clock'

const ctx = (o: object) => o as unknown as AudioContext

test("reads the browser's latency under Tone's wrapper, which hides outputLatency", () => {
  const native = ctx({ currentTime: 10, outputLatency: 0.032, baseLatency: 0.01 })
  const wrapper = ctx({ currentTime: 10, baseLatency: 0.01, _nativeAudioContext: native })
  assert.equal(nativeOf(wrapper), native)
  assert.ok(Math.abs(reportedLatency(wrapper) - 0.042) < 1e-9)
  assert.ok(Math.abs(heardTime(wrapper) - 9.958) < 1e-9)
})

test('Safari: no output latency reported, so only the route delay holds the highlight back', () => {
  const safari = ctx({ currentTime: 5, outputLatency: 0, baseLatency: 0.003 })
  assert.ok(Math.abs(heardTime(safari) - 4.997) < 1e-9)
  assert.ok(Math.abs(heardTime(safari, 0.2) - 4.797) < 1e-9) // Bluetooth: 200 ms later
  assert.ok(Math.abs(heardTime(ctx({ currentTime: 5 })) - 5) < 1e-9) // nothing reported at all
})
