from kokoro_onnx import Kokoro; import soundfile as sf, os
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin'); os.makedirs('raw/alt', exist_ok=True)
for key, t in [('6', 'Six.'), ('11', 'Eleven.'), ('e', 'Ee.'), ('ah', 'Uh!'), ('ta', 'Ta!'), ('la', 'La!')]:
    a, sr = k.create(t, voice='af_heart', speed=1.15, lang='en-us'); sf.write(f'raw/alt/{key}.wav', a, sr)
