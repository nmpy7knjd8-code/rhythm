import { heardTime } from '../engine/clock'

/** When audio scheduled at context time `t` (s) comes out of the output device, in performance.now ms, from the context
 *  clock minus the latency the browser reports. Not getOutputTimestamp: WebKit's performanceTime runs ahead by the
 *  context time, and the same clock as the display keeps scoring and the highlight in step. The route's own delay
 *  (Bluetooth) is the calibrated offset, applied to hits by the scorer. */
export function heardAt(ctx: AudioContext, t: number): number {
  return performance.now() + (t - heardTime(ctx)) * 1000
}
