import numpy as np, soundfile as sf, os
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin'); os.makedirs('soft', exist_ok=True)
C = {'and': [('An.', 0), ('An', 0), ('En.', 0), ('Un.', 0), ('ən', 1), ('ˈæn', 1), ('ɛn', 1)],
     'e': [('Ee.', 0), ('E.', 0), ('ˈi', 1)], 'ah': [('Ah.', 0), ('Uh.', 0), ('ˈɑ', 1), ('ə', 1)], 'ta': [('Ta.', 0), ('Tah.', 0), ('tə', 1), ('ˈtɑ', 1)]}
def trim(a, sr):
    e = np.abs(a); idx = np.where(e > e.max() * 0.05)[0]; return a[max(0, idx[0] - int(.001*sr)): idx[-1] + int(.01*sr)]
for key, cands in C.items():
    for n, (t, ph) in enumerate(cands):
        try: a, sr = k.create(t, voice='af_heart', speed=1.2, lang='en-us', is_phonemes=bool(ph))
        except Exception as ex: print(key, t, 'ERR', ex); continue
        a = trim(a, sr); L = len(a) / sr
        tail = a[-int(.06*sr):]; sp = np.abs(np.fft.rfft(tail * np.hanning(len(tail)))); f = np.fft.rfftfreq(len(tail), 1/sr)
        cen = (sp * f).sum() / sp.sum(); hf = (sp[f > 3000] ** 2).sum() / (sp ** 2).sum()
        sf.write(f'soft/{key}_{n}.wav', a, sr); print(f'{key:4} {n} {t!r:8} {L*1000:4.0f} ms  tail centroid {cen:5.0f} Hz  tail >3k {hf*100:4.1f}%')
