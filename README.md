# HafizAssist

A browser-based Quran memorization companion. Read a selected passage, recite into your microphone, and follow approximate word-level matching. The model runs locally in a Web Worker using Sherpa ONNX WebAssembly. Audio is neither recorded to disk nor sent to a server.

## Run locally

Requires Node.js 20.11 or newer. There are no npm dependencies to install.

```powershell
node scripts/serve.mjs
```

Open **http://localhost:5173**. Do not open `index.html` directly: microphone capture, modules, and the speech worker require a local server or HTTPS.

1. Use the single search field: `4` opens page 4, `s 2` opens chapter 2, `2:255` opens that verse, and `Yasin` or `يس` opens Ya-Sin. The adjacent dropdown lists each surah number with its English and Arabic names. Page arrows move through all 604 pages.
2. Press **Start reciting** once. It loads the model and continues directly into microphone setup.
3. Allow microphone access. The first model download can take a while; subsequent visits open the saved copy and initialize the engine again without downloading the weights.
4. Recite the selected passage. Green means a phonetic match; amber means a word to review, not a proven mistake.
5. Stop to pause and save a local session summary. Select any word while stopped to restart there. **Reset** clears the current session, not history.

The eye button hides or shows all Quran words, including matched words, without interrupting tracking. Light/dark themes, automatic following, and the last 30 session summaries are implemented. Matching uses the Balanced preset. The microphone stops when the tab is hidden or the page closes.

The live cursor and completed word highlights advance monotonically during recitation. Revised recognition hypotheses cannot rewind them. To revisit earlier words deliberately, stop and select a word, reset, or choose another passage. When an endpoint hypothesis falls behind the displayed cursor, its older audio is not carried into the next verse.

## Offline use

Open the page once while the local server is running (or visit an HTTPS deployment while connected). The service worker saves the complete application, all Quran data, the font, token table, audio worklet, and Sherpa JS/WASM runtime. Load the model once with **Start reciting**, or select the downloaded INT8 file when prompted.

Wait until the status beneath the recorder says **Ready offline**. After that, reopen the same URL in the same browser/profile to read and recite without an internet connection. A loaded model alone is not enough: the app/runtime files must also finish caching. No recording needs to be made to prepare offline use.

If storage is blocked, full, cleared, or later evicted by the browser, offline assets may need to be saved again. Offline readiness is checked at startup, after model loading, and when returning to the page. The page distinguishes a saved app from a missing model instead of claiming full offline readiness prematurely.

Updates are downloaded in the background and activated after all HafizAssist tabs are closed, avoiding a runtime change mid-recitation. Close all its tabs and reopen when the update message appears. Developers must bump `VERSION` in `public/sw.js` whenever shipping changes to cached files. Service worker behavior follows the [MDN lifecycle documentation](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Your downloaded model

The following files were copied from `C:\Users\gufra\Downloads`:

| File | Local destination | Size |
| --- | --- | --- |
| `zipformer_p_arabic_v3.int8.onnx` | `public/models/zipformer_p_arabic_v3.int8.onnx` | 72,705,392 bytes |
| `tokens.txt` | `public/models/tokens.txt` | 2,346 bytes |

These are the file types specified for the [Quran-Lab model's streaming Sherpa interface](https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3). Its token table uses blank ID 250. The downloaded INT8 v3 file has SHA-256 `6a5ddafa9c5e5c01260d30264031b341785bdc152e9ef1d569b41c8c278508eb`; this records the local file's identity, not an independently authenticated upstream checksum.

The unquantized 262,977,606-byte ONNX download is not needed here. The v3.1 INT8 download uses the same interface according to the model card, but this initial implementation defaults to v3, matching the reference application. Recognition quality has not been compared between versions.

The Quran phoneme reference, HafsSmart display font, and browser runtime are already included. You do not need an OpenAI key, paid API, Python inference server, or additional model downloads to run the local version.

Model weights are ignored by Git and excluded from the static build. On a machine or deployment without the local model, the page asks the user to select their downloaded INT8 model. The selected file stays on their device. When browser storage is available, the model is cached for future sessions; clearing site data removes that cache and the local history.

## Publish later

For the Workers deployment flow shown in the build log, use build command `node scripts/build.mjs` and deploy command `npx wrangler deploy --assets=./dist`. The added `wrangler.jsonc` scopes assets to `dist`; its Worker name must match your existing Cloudflare Worker. Do not deploy the repository root. See [Cloudflare deployment instructions](docs/CLOUDFLARE-DEPLOY.md).

For **Cloudflare Pages** Git integration, use framework preset **None**, build command `node scripts/build.mjs`, and output directory `dist` (repository root as the root directory). Use Node.js 20.11 or newer.

V2 supports automatic model downloads: set the Pages build environment variable `MODEL_URL` to your full public HTTPS R2 object URL, then redeploy. Alternatively, set `modelUrl` in `public/model-config.json`; the environment variable takes precedence at build time. See [the R2 setup guide](docs/R2-SETUP.md) and [dashboard CORS template](docs/r2-cors.json). V3 configures https://model.hafizassist.com/zipformer_p_arabic_v3.int8.onnx in public/model-config.json. Upload the file at the bucket root and configure CORS for the website origin. A pre-existing MODEL_URL build variable overrides this setting, so remove it or use the same URL. The object/download has not been tested. Model weights remain ignored by Git and excluded from the build. Cloudflare Pages' [25 MiB single-asset limit](https://developers.cloudflare.com/pages/platform/limits/) prevents serving this 72.7 MB model as one Pages asset. No bucket has been created or deployed by this implementation.

```powershell
node scripts/build.mjs
```

Publish the resulting `dist` directory with any HTTPS static host. The relative asset paths support a project subdirectory, such as GitHub Pages. Serve `.wasm` as `application/wasm`. No server API or special cross-origin isolation headers are required by the bundled single-thread runtime. Do not include a previously added ONNX file in your deployment output. The build intentionally does not distribute model weights; users select their own downloaded model.

Nothing has been committed, pushed, or deployed by this implementation.

## Visible application version

The far-right header badge starts at **V1**. Every subsequent delivered change increments that number, including nonvisual fixes. `index.html` and the matching offline cache version in `public/sw.js` must be updated together; the repository rule is in `AGENTS.md`.

The current release is **V10**, remembering the consumed transcript boundary so completed words are not rematched against newly spoken words. The existing search, bilingual surah dropdown, Arabic-Indic ayah numbers, red recording mic, and word counters remain available. Correct counts matched words; Mistakes counts words flagged for review by approximate tracking. The eye toggle and readable, tracked chapter-opening Bismillah remain available. Al-Fatihah retains its first verse, and At-Tawbah has no added Bismillah. The decorative image appears only in the site header. The badge identifies the application actually loaded, including an offline copy. It does not claim to show the newest available server version. If an older version is still visible after deployment, close every HafizAssist tab and reopen while connected so the waiting offline update can activate. An initial visit may be needed to download the update before closing all tabs and reopening. Builds append a model-configuration hash to the internal service-worker cache version to handle URL configuration updates safely.

## Architecture

- `src/app.js`: passage selection, Quran rendering, capture lifecycle, history, UI state.
- `src/alignment.js`: weighted semi-global phoneme alignment, free-start recovery past extra speech, connected-word matching, revised partial hypotheses, and supported lookahead before marking skipped words.
- `public/audio-worklet.js`: continuous microphone resampling to 16 kHz mono PCM in 320 ms chunks.
- `public/recognizer-worker.js`: model loading/cache, speech segments, Sherpa inference, bounded processing backlog.
- `public/data/quran.json`: canonical per-word phonemes and HafsSmart glyph text for all 114 surahs.
- `public/data/mushaf-layout.json`: bundled Quran.com page/line metadata for all 6,236 verses. Each verse key maps to `[juz, [[page, line], ...]]`, including its ending ayah marker. Four combined Quran.com words are split to match the existing phoneme dataset; see the attribution notice.
- `public/assets/bismillah.png`: header artwork copied from the owner's Desktop-HafizAssist project.
- `public/vendor`: the reference project's compatible Sherpa JS/WASM bundle.
- `public/sw.js` and `src/offline.js`: versioned offline application cache and readiness messages; the model cache is preserved across application upgrades.

The tracker preserves repeated phonetic symbols and gives elongation/gemination differences a reduced matching cost. It does **not** grade madd duration, tajweed, pronunciation correctness, or memorization accuracy. Green is an approximate alignment result. Weighted costs and sequence handling are adapted from the reference project's approach, not a complete port of its engine. Unmatched phonemes are carried across automatic recognition endpoints; starting a new microphone session clears that carry. Longer mistakes, repeated phrases, a start far from the chosen word, background speech, or difficult microphones may still cause tracking to stall or drift. Stop and select the correct word to resume. The model author also documents limitations on children’s recitation and tajweed distinctions.

Automatic tracking can be wrong. Automatic tajweed feedback can be wrong and does not replace a qualified teacher.

## Design and attribution

The microphone panel adapts the forty-bar layout of [WaveformPlayer by ruixen.ui on 21st.dev](https://21st.dev/@ruixen.ui/components/waveform-player). Here the bars are driven by actual microphone levels instead of playback or random decorative data. The surrounding green-and-ivory interface is original to this project.

Quran data, HafsSmart font, and the compatible browser runtime were sourced from [Iam-Muslim/ReciteQuran](https://github.com/Iam-Muslim/ReciteQuran), inspected at commit `741d07e9964909696bffad3710f2ae1e4ce3e44d`. See [licenses/NOTICE.md](licenses/NOTICE.md) for source links and usage restrictions. The complete assembled site is subject to the included components' restrictions, despite the original project code's MIT license.

## Current verification status

V5's requested cache check ran the actual worker model loader with the real 72,705,392-byte local model, mocked Cache Storage, and a fresh worker context representing refresh. The initial load downloaded and saved once; the fresh context reused that cache with all network access disabled, making no new request and no cache rewrite. This checks loader logic, not a real browser's storage persistence or eviction policy. No builds, browser tests, microphone sessions, or recognition accuracy tests were run. Real-device recitation is still needed before claiming the tracking is working reliably.

V6 was implemented without running tests, builds, browser checks, or microphone sessions, following the project instructions.

V7: tests and builds were not run, following the project instructions.

## Recitation debug (V8)

The collapsible section at the bottom collects the latest 300 events in memory, even while closed. When tracking sticks, press **Mark stuck word**, stop reciting, and press **Copy debug report** before refreshing. Paste that report into the development conversation. If clipboard access fails, the full report is selected in the text area for manual copying. The regular live preview shows only the last 12 events; the copied report includes the complete retained log.

Reports include app/browser/model details, microphone sample rate and processing settings (no device IDs), expected words and phonemes, raw and normalized recognition text, endpoint/carry state, candidate and visible cursor positions, rejection scores/reasons, no-rewind decisions, audio RMS/peak levels, worker processing time, matching time, and queued audio. No audio samples are stored or uploaded. Clear log erases retained events; refresh discards the in-memory log.

Matching thresholds and cursor behavior are unchanged in V8. The cause of the reported stalls is not confirmed. No tests, builds, browser checks, or microphone sessions were run.

## Repeated-word matching (V9)

The supplied V8 report showed the visible cursor waiting at Rabbana (2:129), while the cumulative matcher had fallen back to an already completed word in 2:128. The transcript included the later Rabbana and subsequent words, with no audio processing backlog. The matcher previously searched the whole transcript for the lowest-error occurrence, allowing a later clean repetition to replace an earlier adequate match and consume speech needed for the next verse.

V9 keeps the first supported occurrence and refines its score/end within that same overlapping span. It retains the existing acceptance thresholds, sound-support checks, and forward-only visible cursor. Debug reports now include the selected transcript span for each recent alignment. No tests, builds, or microphone sessions were run; live recitation still needs user confirmation.

## Consumed transcript boundary (V10)

The complete V9 report for min (2:133) showed a candidate falling from visible word 102 back to word 91. The earlier word am (index 90) was reassigned to transcript positions 274–276, consuming the beginning of min despite prior progress. V9 occurrence selection alone did not prevent this cumulative replay problem.

V10 remembers the transcript boundary whenever the visible cursor advances. Subsequent hypotheses align from the current word using only unconsumed phonemes. If the consumed prefix changes, a unique nearby 24-character suffix can relocate that boundary within 64 characters; ambiguous or missing anchors fall back to the existing guarded alignment. Endpoints, new recordings, resets, and manual word selection clear the anchor. Debug reports include inputStart, inputOffset, boundaryReused, and anchorFallback; alignment spans are relative to inputOffset. The forward-only cursor and acceptance thresholds remain in place. No tests, builds, or microphone sessions were run.
