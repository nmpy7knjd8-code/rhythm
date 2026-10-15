import sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
NUM = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
WORDS = {str(i+1): w.capitalize()+'!' for i, w in enumerate(NUM)}
WORDS.update({'e': 'Ee!', 'and': 'And!', 'ah': 'Ah!', 'ta': 'Tah!', 'trip': 'Trip!', 'let': 'Let!', 'la': 'Lah!', 'li': 'Lee!'})
import os
for v in sys.argv[1:]:
    os.makedirs(f'raw/{v}', exist_ok=True)
    for key, text in WORDS.items():
        a, sr = k.create(text, voice=v, speed=1.15, lang='en-us')
        sf.write(f'raw/{v}/{key}.wav', a, sr)
    print(v, 'done', sr)
