/** Tone wraps the AudioContext (standardized-audio-context); the wrapper has no outputLatency and no getOutputTimestamp,
 *  and its baseLatency is a snapshot. Read the browser's own context underneath. */
export const nativeOf = (c: AudioContext): AudioContext => (c as unknown as { _nativeAudioContext?: AudioContext })._nativeAudioContext ?? c

/** Seconds from scheduling a sound to it leaving the output device, as far as the browser reports it.
 *  Safari reports no output latency (0), and no browser knows a Bluetooth link's delay: that is the calibrated route delay. */
export function reportedLatency(c: AudioContext): number {
  const n = nativeOf(c)
  return (n.outputLatency || 0) + (n.baseLatency || 0)
}

/** Context time of what the output device is playing now, `delay` (s, the route's unreported delay) included. */
export const heardTime = (c: AudioContext, delay = 0) => c.currentTime - reportedLatency(c) - delay
