import numpy as np, soundfile as sf, os
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin'); os.makedirs('nat', exist_ok=True)
def env(a, sr, w=0.005):
    n = int(w * sr); return np.sqrt(np.convolve(a ** 2, np.ones(n) / n, 'same'))
def natural(a, sr):
    """start at the first audible sample; end where the voice has decayed to -40 dB of its peak (not before)."""
    e = env(a, sr); pk = e.max(); idx = np.where(e > pk * 0.01)[0]
    return a[max(0, idx[0] - int(.001 * sr)): idx[-1] + 1]
def middle_word(a, sr):
    """from 'one X two': the segment between the two deepest energy dips around the centre."""
    e = env(a, sr, 0.01); pk = e.max(); quiet = e < pk * 0.03
    runs = []; i = 0
    while i < len(e):
        if quiet[i]:
            j = i
            while j < len(e) and quiet[j]: j += 1
            if j - i > int(0.02 * sr): runs.append((i, j))
            i = j
        else: i += 1
    inner = [r for r in runs if r[0] > 0 and r[1] < len(e)]
    if len(inner) < 2: return None
    # the two gaps with the most speech on either side → the word in between
    best = max(((inner[x], inner[x + 1]) for x in range(len(inner) - 1)), key=lambda g: -abs((g[0][1] + g[1][0]) / 2 - len(e) / 2))
    return natural(a[best[0][1] - int(0.01 * sr): best[1][0] + int(0.01 * sr)], sr)
C = {'and': ['An', 'Uhn', 'N'], 'e': ['Ee'], 'ah': ['Ah'], 'ta': ['Tah']}
for key, texts in C.items():
    for t in texts:
        for sp in (1.3, 1.5):
            a, sr = k.create(t, voice='af_heart', speed=sp, lang='en-us'); x = natural(a, sr)
            sf.write(f'nat/{key}_{t}_{sp}_iso.wav', x, sr); print(f'{key:4} {t:4} {sp} iso  {len(x)/sr*1000:4.0f} ms')
            a, sr = k.create(f'one {t.lower()} two', voice='af_heart', speed=sp, lang='en-us'); x = middle_word(a, sr)
            if x is not None: sf.write(f'nat/{key}_{t}_{sp}_ctx.wav', x, sr); print(f'{key:4} {t:4} {sp} ctx  {len(x)/sr*1000:4.0f} ms')
            else: print(key, t, sp, 'ctx: no clean gaps')
