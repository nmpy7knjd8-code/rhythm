import glob, os, subprocess, numpy as np, soundfile as sf
out = '/workspace/rhythm/public/count'; os.makedirs(out, exist_ok=True)
rows = []
SOFT = {'and', 'e', 'ah', 'ta'}  # drummer's 'an', 'ee', 'ah', 'tah': short and soft, no hard consonant tail
for f in sorted(glob.glob('raw/af_heart/*.wav')):
    key = os.path.basename(f)[:-4]; a, sr = sf.read(f)
    e = np.abs(a); idx = np.where(e > e.max() * 0.05)[0]
    a = a[max(0, idx[0] - int(0.001 * sr)): idx[-1] + int(0.02 * sr)]
    if key in SOFT: a = a[:int(0.2 * sr)]; n = int(0.05 * sr)        # soft syllables: 200 ms max, long fade
    else: n = int(0.015 * sr)
    a[-n:] *= np.linspace(1, 0, n) ** 2                               # fade the tail
    a[:int(0.001*sr)] *= np.linspace(0, 1, int(0.001*sr))          # 1 ms fade-in, no click
    rms = np.sqrt(np.mean(a[np.abs(a) > 0.02 * np.abs(a).max()] ** 2)); a *= 0.2 / rms   # same loudness for every word
    a = np.clip(a, -0.98, 0.98)
    sf.write('/tmp/c.wav', a.astype(np.float32), sr)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', '/tmp/c.wav', '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', f'{out}/{key}.mp3'], check=True)
    rows.append((key, len(a) / sr, os.path.getsize(f'{out}/{key}.mp3')))
for r in rows: print(f'{r[0]:>5} {r[1]*1000:4.0f} ms {r[2]:5d} B')
print('total', sum(r[2] for r in rows), 'bytes', len(rows), 'clips')
