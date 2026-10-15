import glob, os, subprocess, numpy as np, soundfile as sf
out = '/workspace/rhythm/public/count'; os.makedirs(out, exist_ok=True)
rows = []
for f in sorted(glob.glob('raw/af_heart/*.wav')):
    key = os.path.basename(f)[:-4]; a, sr = sf.read(f)
    # start at the first audible sample; end only after the voice has decayed to -40 dB, then fade 25 ms of room tone
    w = int(0.005 * sr); env = np.sqrt(np.convolve(a ** 2, np.ones(w) / w, 'same')); pk = env.max()
    idx = np.where(env > pk * 0.01)[0]; s0, s1 = max(0, idx[0] - int(0.001 * sr)), idx[-1]
    f = int(0.025 * sr); a = np.concatenate([a, np.zeros(f)])[s0: s1 + f].copy()
    a[-f:] *= np.linspace(1, 0, f) ** 2
    a[:int(0.001*sr)] *= np.linspace(0, 1, int(0.001*sr))          # 1 ms fade-in, no click
    tail_db = 20 * np.log10(env[min(s1, len(env) - 1)] / pk + 1e-9)
    rms = np.sqrt(np.mean(a[np.abs(a) > 0.02 * np.abs(a).max()] ** 2)); a *= 0.2 / rms   # same loudness for every word
    a = np.clip(a, -0.98, 0.98)
    sf.write('/tmp/c.wav', a.astype(np.float32), sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/c.wav', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', f'{out}/{key}.mp3'], check=True)
    rows.append((key, len(a) / sr, os.path.getsize(f'{out}/{key}.mp3'), tail_db))
for r in rows: print(f'{r[0]:>5} {r[1]*1000:4.0f} ms {r[2]:5d} B  voice ends at {r[3]:.0f} dB')
print('total', sum(r[2] for r in rows), 'bytes', len(rows), 'clips')
