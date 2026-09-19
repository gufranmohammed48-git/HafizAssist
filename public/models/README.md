# Local model assets

Place `zipformer_p_arabic_v3.int8.onnx` here for automatic local loading. The matching `tokens.txt` is included. Obtain the model from https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3 under its terms.

The ONNX model is ignored by Git and omitted from the static build. Without it, the browser offers a local file picker and caches the user-selected model on that device when storage is available.
