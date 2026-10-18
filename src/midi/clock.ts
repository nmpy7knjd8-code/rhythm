/** When audio scheduled at context time `t` (s) comes out of the output device, in performance.now ms: from
 *  getOutputTimestamp when it reports a position, else from the context clock minus the reported latencies. */
export function heardAt(ctx: AudioContext, t: number): number {
  const ts = ctx.getOutputTimestamp?.()
  if (ts && ts.contextTime && ts.performanceTime) return ts.performanceTime + (t - ts.contextTime) * 1000
  return performance.now() + (t - (ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0))) * 1000
}
