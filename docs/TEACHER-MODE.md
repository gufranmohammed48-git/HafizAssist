# Teacher mode · V9 (restarted series)

Version numbering restarted at V1 on 2026-10-10 at the user's request. V7 promoted the book interface and Teacher audio from `test.html` to the production desktop and mobile entries. V8 added a teacher illustration and connected the main search icon to the voice-search popup. V9 simplifies the Teacher icon to a person, board, and pointer and moves its explanation from settings to the icon. All three entries use shared book scripts and styles; the mobile document keeps its mobile layout and opening-page font fitting. No extra speech model is required. Changes remain local; no tests, builds, browser checks, or microphone tests were run for V9.

Open the app on your local server or deployed site and use the Teacher icon before starting the microphone. Keep quiet while the startup message asks the microphone to adjust to background sound, until the microphone turns red. Startup uses 800 ms of captured audio to learn the lower noise floor and an upper quiet-energy band (80th percentile); those samples are not submitted to recognition or counted as practice. Then recite and pause for five seconds to hear the next unread word once. The learned baseline is preserved after reference playback. Activity requires 160 ms of supported sound in a rolling 320 ms window before refreshing the speech clock, so isolated 20 ms noise crossings do not restart it. Softer held sounds can remain active through fresh local vowel-pattern evidence and energy above the calibrated quiet band, without new recognition tokens or a fixed madd timeout. This is activity handling, not a Madd grade.

Click any Quran word to hear that word's reference recording, even with automatic Teacher off. This leaves the reading position, counts, and review history unchanged. With Teacher enabled, a detected review flag requests its single-word reference audio as soon as it is ready, even while the learner continues reading. It does not wait for a quiet pause. Pause hints and immediate reviews are both controlled by the one Teacher button; the former option checkboxes and “Hear this word” button are removed. The feedback card offers Replay and Dismiss; Replay repeats the shown word. The original [interactive layout mock](teacher-mode-preview.html) remains a visual simulation from the earlier design.

Reference playback resumes listening at the highlighted word after already queued learner results finish. It does not rewind the pointer, hold a separate correction retry position, or regrade the flagged word. The original review stays in history. The learner's speech during Teacher playback is excluded from recognition; continue from the highlighted word when listening resumes. One playback runs at a time, with the latest detected correction retained as the pending target. A pending review more than six words behind the current position is dropped; automatic page turns preserve the last pending review. Recognition can be uncertain, so the label is “Review this word.”

The learner keeps a centered Quran page. The main control rail contains microphone, Teacher, show/hide, voice search, and settings in that order. Desktop placement uses the page's measured left gutter: at least 78 pixels allows a side rail, while less room uses a row above the page. Mobile always uses a normal-flow row of five 44-pixel touch buttons, reserving space for the version badge and leaving the Quran unobstructed. The magnifying-glass button opens **Find a verse** for voice search; settings contains text search, the surah dropdown, reset, and appearance. The show/hide control is no longer in settings. The upper-right Mushaf heading uses Arabic ordinal names, from `الجزء الأول` through `الجزء الثلاثون`, with an accessible English Juz number. Page navigation remains centered above the text. Word details appear beside the hovered word. The separate Teacher feedback card uses the available right gutter, with a compact overlay on narrow screens.

## Controls

| Location | Control | Initial setting |
| --- | --- | --- |
| Main controls | Teacher icon toggle | Off initially; saved locally |
| Teacher enabled | Quiet-time hint | One word after 5 seconds |
| Teacher enabled | Flagged-word reference | Immediate preparation; no quiet pause required |
| Quran text | Click a word | Hear that word with automatic Teacher on or off |
| Main controls | Show/hide | Toggle the Quran script |
| Main controls | Search | Open Find a verse for voice search |
| Main controls | Settings | Text/surah search, reset, and appearance options |
| Feedback card | Replay / Dismiss | Replay the shown word or cancel playback |

The Teacher button uses an original inline SVG resembling the user's teacher reference: a person pointing at a board. Enabled/disabled details and light/dark palettes give the shared illustration four appearances. Its accessible label and pressed state identify the selected mode. Hover help explains that Teacher recites the next word after five seconds of quiet and plays the correct reference word when tracking flags a mistake. The former Teacher settings heading, instructions, and status copy are removed. Teacher and Madd diagnostic/report buttons remain removed from the production interface. Reference rules and available, non-grading Madd evidence remain in word details. The feedback card uses the same Quran font and visible opening/closing animations. It uses the available right gutter, with a compact top overlay when the gutter is too small; it never moves or resizes the Quran page. A quiet pause shows a countdown after the first second. Feedback uses the browser's top layer (or the active dialog as a fallback) so it is visible even with Settings open.

## When the teacher speaks

| Situation | Action |
| --- | --- |
| Pointer stops while the learner keeps speaking, without a new review flag | Attempt tracking recovery first. A stalled pointer alone does not trigger immediate audio or prove that the learner forgot a word. |
| Learner is quiet for 5 seconds | Play the next unread word once. Wait for the learner to read from the highlighted pointer. A breath or a sustained madd should not trigger this timer; use speech activity and pending recognition together. |
| Tracking flags a word for review, including a possible vowel error | With Teacher enabled, prepare its single-word reference recording and play as soon as ready, even if the learner continues speaking. Use the neutral label "Review this word"; this does not confirm a mistake. |
| Learner resumes while a pause hint is downloading | Cancel that hint. Continued speech does not cancel an immediate correction. Drop stale pending reviews after more than six words of progress. |
| Another word is flagged while audio is preparing or playing | Keep one active playback and retain the latest pending correction for the next available playback. |
| Prompted word is still difficult | Do not repeat automatically in a loop. Offer Replay word. |

Hints and corrections use human single-word recordings. The clips represent the expected word, not a synthetic version of the learner's mistaken sound. Combined source words play the full recording when two displayed fragments share it. Audio prepares before capture is gated, so a slow download does not mute the learner while waiting. Cancellation or playback failure restores listening, and Replay repeats the shown word.

Prompt once per word in a recording session, and avoid praise after every correct word. Scheduled playback is cancelled on explicit navigation, reset, microphone stop, teacher disable, or hiding the tab. Turning Teacher off clears its pending correction and cancels automatic playback. Dismiss cancels the current prompt. A future graded retry exercise should use a separate retry target and preserve the original error in history; that exercise is not part of V9.

## Audio and model choice

The existing Zipformer model supplies recognition. Teacher reference clips use Quran.com's documented public word-audio CDN, with explicit source word mapping. No second model, runtime metadata API, or client credential is used. The four combined source words split by the phoneme dataset play the full original word; inserted Bismillah uses 1:1 positions 1–4.

[Quran Foundation's word-audio documentation](https://api-docs.quran.foundation/docs/sdk/javascript/verses/#word-audio-paths) supplies single-word audio paths resolved against `https://audio.qurancdn.com/`. Its [audio documentation](https://api-docs.quran.com/docs/sdk/javascript/audio/) distinguishes public word media from authenticated API metadata. Recordings are fetched on demand and are not bundled in the repository. Verse/contextual phrase playback remains future work.

Prefer human Quran recordings for pronunciation. Browser speech synthesis can optionally read ordinary instructions, but available voices vary and may use a remote service; it is not a guaranteed offline Quran reciter. [MDN: local versus remote voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)

Before creating permanent audio packs or mirroring recordings to R2, select a recording set whose terms allow that use. Quran Foundation's current [developer terms](https://api-docs.quran.com/legal/developer-terms/) distinguish access to audio URLs from rights to the underlying recordings. Its metadata SDK requires server credentials; do not put those credentials in this static app. A permitted static audio manifest and files on our host would allow playback without adding a runtime API backend.

Map audio using source word IDs, not just the displayed index. The current Mushaf data splits several Quran.com word positions into two phoneme words (documented in `licenses/NOTICE.md`), and opening Bismillah is inserted separately. The audio manifest must explicitly handle those cases and any unavailable clips.

## Listening and feedback cycle

```mermaid
stateDiagram-v2
  [*] --> Listening
  Listening --> Preparing: Five-second quiet hint or detected review flag
  Preparing --> Listening: Learner continues during hint preparation / stale target
  Preparing --> Playing: Audio ready; capture paused; learner queue drained; ASR barrier
  Preparing --> Listening: Audio unavailable / cancelled
  Playing --> YourTurn: Clip ends; short echo tail
  Playing --> Listening: Stop / cancel
  YourTurn --> Listening: Resume at highlighted word
```

Prepare the reference audio while microphone capture continues. Once audio is ready, keep microphone permission/session active but pause captured PCM submission and discard the unfinished capture buffer. Drain already queued learner results before resetting the old recognition segment; those learner results can still advance the pointer and record review flags. A changed reading position cancels a stale pause hint, while an immediate correction can play its historical flagged word. Reference audio plays only after a fresh recognition barrier, with Teacher audio and its echo tail excluded from recognition and counts. After the clip ends, allow a 400 ms echo tail, then resume listening at the highlighted word without rewinding or regrading. Recognition gating is required even with headphones or echo cancellation.

Teacher measures sustained float PCM activity using calibrated quiet-energy bounds, supported by meaningful recognition changes. Startup records the lower noise floor and upper quiet-energy band; reference playback preserves them. The V5 rolling 320 ms activity window requires 160 ms of supported sound before refreshing the speech clock. An isolated noisy frame no longer resets the consecutive-quiet path. Fresh local normalized-autocorrelation evidence detects a repeating vowel-like pattern, with energy above the calibrated quiet band, to support softer long madd even when recognition emits no new tokens. It does not impose a fixed madd timeout or grade duration. Hints require a recent microphone-capture heartbeat; the existing bounded pause/drain barrier still processes queued learner results and checks the current hint target before playback. Five-second quiet hints and immediate single-word corrections remain unchanged. This remains a lightweight activity heuristic; periodic room noise, unusual microphones, and very soft speech can still overlap. V9 runtime behavior has not been verified.

Handle blocked autoplay, missing audio, cancelled downloads, and failed playback by immediately restoring listening. Start/unlock audio playback from the learner's Teacher-mode or microphone click. A hung clip must not leave recognition gated indefinitely; use a bounded playback watchdog and always restore listening in cleanup.

Failed automatic audio is not recorded as a successfully played prompt. One delayed retry is permitted; further failures leave a visible error and Replay word. Turning Teacher off/on clears that retry suppression. A pause hint cancelled because the learner resumed remains eligible at the next quiet pause. A pending correction does not require silence and is retried when no other playback is active, unless stale or explicitly cancelled.

## Troubleshooting playback

Teacher and Madd report buttons remain removed from the production interface. A failed reference recording still produces a visible playback message and offers Replay. If an older version remains visible after deployment, close all app tabs and reopen while connected so the waiting offline update can activate. No update is forced during recitation.

## Offline behavior

Audio is cached separately from the speech model and app shell. Teacher mode prefetches at most three upcoming word clips. Successfully downloaded clips are usable for up to six days, with at most 200 retained entries; replay does not renew their saved timestamp. Expired entries are pruned on opening/use. See the source [caching FAQ](https://api-docs.quran.com/docs/tutorials/faq/#how-long-can-i-cache-or-store-qf-content). The Content Sync exception covers audio metadata, not recording files.

Readable CDN downloads are decoded through WebAudio. If a readable fetch or decoding fails, the app attempts direct media streaming; that fallback is online only and is not stored by the clip cache. If no saved clip is available offline, the app shows the word and the audio problem, then restores listening. Downloading the recognition model does not save the entire teacher audio catalog.

## Remaining work

1. Select a recording source with explicit permission for permanent offline packs or an R2 mirror.
2. Add per-surah download management and contextual phrase playback from that source.
3. Add a separate correction retry exercise and trustworthy evidence for successful retries.

## Historical releases

Earlier control names and diagnostic instructions below describe those releases, not the current production interface.

V53 includes source-level fixes for stalls: stable endings can release the vowel wait, vowel differences can be marked for review without blocking the pointer, token-time anchors can survive earlier transcript revisions, and supported recovery can look farther ahead. It does not force words to pass on a timer or claim recognition can never fail. No tests, builds, browser checks, or microphone tests were run.

V54 adds real reference playback with capture pause/discard, an ASR session barrier, a 400 ms echo tail, cancellation, and bounded download/playback timeouts. No tests, builds, browser checks, or microphone tests were run for V54.

V55 adds the PCM activity helper, bounded backlog scheduling with drain-before-reset, explicit on/off controls, countdown, top-layer feedback, and bounded failed-audio retries. No tests, builds, browser checks, or microphone tests were run for V55.

V56 adds three-word pause hints with complete replay and restores the popup beside the hovered word. All hint clips share one recognition gate and echo tail; correction and manual Hear this word playback remain single-word prompts. No tests, builds, browser checks, or microphone tests were run for V56.

Restarted V1 makes PCM activity authoritative for the pause clock. Recognition only confirms recent audible activity when new sounds extend the hypothesis; final/settled results and old-prefix revisions cannot restart the clock. Late cursor advances and stale correction targets do not block a new pause hint. Capture resumes without resetting activity when a prompt was cancelled before playback. Clips prepare concurrently, and a failed preparation cancels its remaining downloads. No tests, builds, browser checks, or microphone tests were run for restarted V1.

Restarted V2 returns five-second pause hints to one word and adds **Read flagged words immediately**. Detected review flags request single-word playback without waiting for quiet or cancelling because the learner continues. Audio prepares before capture is gated; queued learner results drain before the ASR barrier. Playback resumes at the highlighted word without rewinding or regrading. One active playback, latest-pending correction handling, stale-target pruning, cancellation, and the separate offline audio cache remain in place. No tests, builds, browser checks, or microphone tests were run for restarted V2.

Restarted V3 adds 800 ms of quiet startup calibration when Teacher is enabled on the book preview, before the microphone turns red, and preserves the PCM ambient baseline after reference playback. Hints use a fresh capture heartbeat instead of acknowledgment age or the six-chunk queue gate; the bounded pause/drain barrier and current-cursor checks remain. Immediate single-word corrections and five-second, one-word pause hints are preserved. Sustained-madd activity handling is unchanged, with no forced voice timeout. Settings adds **Copy Teacher report** for diagnostics without audio. These changes address suspected causes; no runtime verification or confirmed root cause is claimed. No tests, builds, browser checks, or microphone tests were run for restarted V3.

Restarted V4 changes calibrated activity release to depend only on the ambient baseline, allowing a held sound above the room-noise release threshold to remain active without new recognition tokens. A steady drop can be relearned as room noise only when near the calibrated ambient level, and unconfirmed flat-run expiry is limited to the uncalibrated fallback. Five-second, one-word quiet hints, immediate flagged-word corrections, and the bounded playback gate remain unchanged. This does not grade madd duration or add a forced voice timeout after calibration. Runtime behavior has not been verified. No tests, builds, browser checks, or microphone tests were run for restarted V4.

Restarted V5 calibrates an upper quiet-energy band (80th percentile) alongside the lower noise floor. A rolling 320 ms window requires 160 ms of supported sound before refreshing the speech clock, preventing isolated 20 ms noise crossings from restarting the quiet timer. Fresh local normalized-autocorrelation vowel-pattern evidence with energy above the quiet band supports softer held madd without new recognition tokens or a fixed madd timeout. Five-second, single-word quiet hints and immediate flagged-word corrections remain unchanged. **Copy Teacher report** adds activity metrics and roughly six seconds of chunk summaries, with no audio. The V4 pause snapshot exposed the consecutive-quiet reset path; V5 runtime behavior has not been verified. No tests, builds, browser checks, or microphone tests were run for restarted V5.

Restarted V6 removes the two explanatory messages beneath Madd hover evidence to keep the popup compact. No tests, builds, browser checks, or microphone tests were run.

Restarted V7 promotes the shared book interface to desktop and mobile production entries, adds the single Teacher icon toggle, and plays reference audio when a Quran word is clicked. Teacher and Madd debug buttons, the manual audio button, and Teacher option checkboxes are removed from the interface. The centered book, tracking history, playback recognition gate, and offline caches remain in place. No tests, builds, browser checks, or microphone tests were run; changes remain local for the owner to push and deploy.

Restarted V8 replaces the speaker toggle icon with an original inline teacher illustration holding a book and pointing at a board. Enabled/disabled and light/dark styling provide four appearances. The main search icon opens the voice-based Find a verse popup; text and surah search remain in settings. No tests, builds, browser checks, or microphone tests were run; changes remain local.

Restarted V9 simplifies the Teacher icon to a person, board, and pointer. Animated hover help replaces the Teacher settings heading, instructions, and status text. Desktop controls use the page's available gutter instead of a fixed screen-width breakpoint; mobile keeps five 44-pixel controls above the page. The production desktop and mobile entries share these changes with `test.html`. No tests, builds, browser checks, or microphone tests were run; changes remain local for the owner to push and deploy.
