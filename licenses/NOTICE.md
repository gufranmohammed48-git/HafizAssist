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

V16's test-page-only duration and vowel experiments adapt rule targets, speed-dependent thresholds, recognition-timing concepts, and post-match vowel comparisons from `lib/tracking/tajweed/tajweed_rules.dart`, `lib/engine/asr_token_processor.dart`, and `lib/tracking/tajweed/error_explainer.dart`, inspected at commit `6c701a69b2600f0bb88ad8eab1d708156a6388ab`. The JavaScript implementations are in `src/tajweed-timing.js`, `src/vowel-feedback.js`, and the gated application integration. They retain the ReciteQuran license terms reproduced in `ReciteQuran.txt`; the original asset revision above is unchanged. Timing estimates remain recognition evidence rather than verified acoustic boundaries or authoritative Tajweed judgments.

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

## Per-word Tajweed and phoneme reference

`public/data/tajweed-words.json` is imported from the owner's Desktop-HafizAssist `phonemes-data.js` using `scripts/import-tajweed.mjs`. The source file describes itself as generated from `data/phonemes.json`. The original per-word IPA strings and letter/rule annotations are preserved for display; they do not replace the Zipformer alignment phonemes or assess the user's Tajweed. No additional upstream license is asserted by this import.

Amiri Quran font (test.html)
Source: https://github.com/google/fonts/tree/main/ofl/amiriquran
Font: public/data/AmiriQuran-Regular.ttf
License and copyright: AmiriQuran-OFL.txt (SIL Open Font License 1.1).

## Quran Foundation Tajweed colour annotations (V19, test.html)

Source: https://api.quran.com/api/v4/quran/verses/uthmani_tajweed

Documentation: https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/quran-verses-uthmani-tajweed/

Documentation source: https://github.com/quran/qf-api-docs/blob/main/docs/content_apis_versioned/quran-verses-uthmani-tajweed.api.mdx

The public response was retrieved on 2026-10-11; its SHA-256 is `280608b003fac23a75ae3ea30f922c820acc30ed7bc67f583ad32acee7b0b6f3`. `scripts/import-tajweed-colors.py` transforms the source's tagged Quran text into letter spans positioned against this app's existing Quran words. Source edition differences use conservative alias mapping; unresolved mappings are left plain. Displayed Quran text is not replaced or rewritten. The source rule classifications are retained, while the display palette is original to this app and does not assert a publisher's printed colour standard.

Bundled annotations are credited to Quran Foundation/Quran.com. Their content terms are separate from this project's source-code license; no MIT license for this data is asserted. Quran Foundation developer terms: https://api-docs.quran.com/legal/developer-terms/ . Retain this attribution and consult the applicable content terms when redistributing or replacing the data. These annotations describe reference text, not measured pronunciation or authoritative feedback on a learner's recitation.

## Teacher reference audio (V54, test.html)

The book preview plays on-demand word recordings from the public Quran.com CDN (`https://audio.qurancdn.com/wbw/`). No recordings are bundled in this repository or mirrored to R2. Public word-audio paths are documented at https://api-docs.quran.com/docs/sdk/javascript/audio/ and https://api-docs.quran.foundation/docs/sdk/javascript/verses/#word-audio-paths . The source reader is labeled Quran.com word audio; this does not assert a verified reciter identity for every CDN clip.

The optional device cache retains downloaded clips for at most six days of usable access, prunes expired entries on opening/use, and caps retained entries at 200. Replaying cached clips does not renew their saved timestamp. Direct media fallback does not populate this cache. Quran Foundation's developer terms and caching FAQ distinguish audio URL metadata from the recording rights; the Content Sync exception does not cover recording files. Source terms: https://api-docs.quran.com/legal/developer-terms/ and https://api-docs.quran.com/docs/tutorials/faq/#how-long-can-i-cache-or-store-qf-content . A permanent audio pack or recording mirror requires a separate source/rights decision.

The four split-word audio mappings follow the existing Quran.com source positions described above. Both displayed halves play the complete original source word. Inserted chapter Bismillah uses Al-Fatihah 1:1 word positions 1–4. Reference playback is a learning aid, not recognition evidence or an authoritative pronunciation verdict.

## Teacher voice preview (V10–V12, test.html only)

V12's two preview choices, Al-Husary Murattal and Abdul Basit Mujawwad, stream source recordings from EveryAyah (https://everyayah.com/data/status.php) and play isolated word segments. No audio files are bundled or mirrored. Five timing datasets imported for V10 remain in `public/data/teacher-timings/`; only the two active choices load their corresponding files. These files are compact transformations of Chris Fair's Quran Align release dated 2016-11-24, licensed under CC BY 4.0. The attribution, exact recording folders, changes, source links, and license are retained in that directory's `TEACHER-VOICE-SOURCES.md` and `LICENSE-CC-BY-4.0.txt`. The metadata license does not assert ownership or redistribution rights for the recordings.

Only isolated published word spans are used for selected-reciter single-word playback. Missing, grouped, shorter-than-80-ms, inconsistent, or invalid word timings now use an explicitly labeled Quran.com word reference rather than whole-ayah help. That reference's reciter identity is not confirmed and is not represented as the selected reciter. The earlier Al-Husary Mujawwad choice is removed. Timing positions follow Tanzil independently of Quran Foundation word-audio positions, including 37:130's four timing words. No new alignment or complete word pack was produced. Device audio caching retains the six-day limit and at most 200 entries, additionally capped at 128 MiB.

## QUD Technologies Teacher timing trial (test2.html)

The separate test2 page uses QUD Technologies' Qur'anic Universal Audio word timestamps, pinned release v3.2.0: https://github.com/QUD-Technologies/quranic-universal-audio/releases/tag/v3.2.0 . The project's own timing/alignment/catalog/code work is licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Credit QUD Technologies and identify the transformation; source links, archive checksums, modifications, and the licence text are retained in `public/data/teacher-qua/`.

The import selects complete canonical Hafs takes, matches the app's local word positions, converts source milliseconds to seconds, selects the first repeated occurrence per word, and retains compatible-run identities for phrase help. It does not invent missing boundaries or modify the displayed Quran. This trial affects reference playback only, not learner recognition or live Tajweed grading.

Al-Husary Murattal streams the matching MP3Quran chapter recordings (`https://server13.mp3quran.net/husr/`); Abdul Basit Mujawwad streams the matching Tarteel chapter recordings (`https://audio-cdn.tarteel.ai/quran/surah/abdulBasit/mujawwad/mp3/`). No audio is bundled or mirrored. Recordings remain under their respective reciter/producer/source terms and are not covered by QUD's timing licence. Upstream notice: https://github.com/QUD-Technologies/quranic-universal-audio/blob/main/NOTICE.md . Selected-voice chapter streams need a connection and are not added to the short-word device cache.
