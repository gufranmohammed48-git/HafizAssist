# Third-party notices

## ReciteQuran

Source: https://github.com/Iam-Muslim/ReciteQuran

Revision inspected: `741d07e9964909696bffad3710f2ae1e4ce3e44d`.

The following assets are included from that repository:

- `assets/model/ordered_quran_phonemes.json` → `public/data/quran.json`.
- `example/assets/fonts/HafsSmart_08.ttf` → `public/data/HafsSmart.ttf`.
- `example/web/sherpa-onnx-asr.js`, `sherpa-onnx-wasm-main-asr.js`, and `sherpa-onnx-wasm-main-asr.wasm` → `public/vendor/`.

Its license is reproduced in `ReciteQuran.txt`. It requires applications using its code/assets/logic to remain completely free to end users, prohibits monetization and financial revenue from the covered work, and passes those restrictions to derivatives. The assembled HafizAssist application must comply with those terms. The original repository MIT license does not override third-party restrictions.

`src/alignment.js` also adapts weighted phonetic costs, free-start dynamic programming, and connected-word sequencing from `lib/tracking/word/dictation_matcher.dart`, `dictation_sequencer.dart`, and `lib/tracking/tracker_config.dart` at the revision above. This is a JavaScript adaptation for word tracking, not the full upstream tajweed engine.

Upstream acknowledgments include Quran-Lab, quran-transcript by Abdullah Aml, and Quranic Universal Aligner by Ahmad Ibrahim.

## Quran-Lab model and tokens

Model: https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3

License: Quran-Lab No-Profit License 1.2, https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3/blob/main/LICENSE

The weights and `tokens.txt` were supplied by the repository owner from their local Hugging Face downloads. Weights are used locally and excluded from Git and the build. The model card requires no charging for the model, access to it, or features powered by it, and requires clear disclosure that automatic feedback may be wrong and is not a replacement for a qualified teacher. Consult the full upstream license for its exact terms before redistributing any model assets.

Automatic tracking can be wrong. Automatic tajweed feedback can be wrong and does not replace a qualified teacher. Model outputs are not authoritative religious rulings.

## Sherpa ONNX

Source: https://github.com/k2-fsa/sherpa-onnx

The JS/WASM distribution in this repository is the compatible build supplied by ReciteQuran. Sherpa ONNX is licensed under Apache 2.0; its license is reproduced in `sherpa-onnx.txt`. The ReciteQuran wrapper's additional terms remain applicable. The WebAssembly runtime incorporates its upstream inference dependencies; retain applicable notices when replacing or rebuilding it.

## Mushaf layout and header artwork

`public/data/mushaf-layout.json` contains page, line, and juz metadata retrieved on 2026-09-19 from the Quran.com API (`https://api.quran.com/api/v4/verses/by_chapter/{chapter}?words=true&word_fields=line_number&per_page=300`). Only layout coordinates are retained; displayed glyphs and speech reference data remain from ReciteQuran. Quran.com source: https://github.com/quran. The metadata is bundled so navigation does not require runtime requests to Quran.com.

Quran.com's combined word positions are expanded at 2:181 position 3, 8:6 position 4, 13:37 position 8, and 37:130 position 3 to match the existing phoneme word boundaries. Both split words retain the original page/line coordinates.

The centered Mushaf styling and `public/assets/bismillah.png` are adapted/copied from the repository owner's local Desktop-HafizAssist project at their request.

## 21st.dev waveform reference

The V6 visibility button's compact shape, selected state, and focus treatment draw on [Toggle Button by jolbol1](https://21st.dev/@jolbol1/components/toggle-button), retrieved through the 21st.dev connector. The eye/eye-off SVGs are drawn inline for this project; no React or remote icon runtime is required.

WaveformPlayer by ruixen.ui: https://21st.dev/@ruixen.ui/components/waveform-player

Retrieved through the 21st.dev connector. The compact forty-bar waveform layout was adapted to vanilla JavaScript/CSS and connected to a live microphone analyser. No remote demo audio or analytics scripts are used.
