Count clips: Kokoro-82M (kokoro-onnx, Apache-2.0), voice af_heart.
python gen.py af_heart && python fix.py && python soft.py (copy soft/and_1, e_2, ah_2, ta_3 into raw/af_heart) && python proc.py  (model files from github.com/thewh1teagle/kokoro-onnx releases)
