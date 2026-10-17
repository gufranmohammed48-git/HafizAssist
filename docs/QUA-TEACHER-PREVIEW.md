# QUD Teacher audio trial · V33

Open [test2.html](http://localhost:5173/test2.html) with the local project server running. This separate page copies the working `test.html` preview and opts into QUD Technologies' Quranic Universal Audio word timings with `data-teacher-timings="qua"`.

V33 changes only `mobile.html` behavior: its bottom page/surah footer is removed, and a confirmed horizontal swipe stops the microphone and Teacher playback, waits for recognition to finish, and turns the page with the microphone left off. Partial, cancelled, and vertical gestures do not stop recording; loading, startup, an existing stop operation, open panels, page limits, and a changed source page remain guarded. Spare-height spacing reclaims the removed footer's room. This trial's layout and audio behavior are unchanged; all loaded badges and the offline shell version are synchronized. No tests, builds, browser checks, or microphone tests were run for V33; historical results below do not validate these mobile changes. Changes remain local.

V32 distributes spare visible screen height evenly between lines on ordinary 15-text-line pages of `mobile.html`, retaining a uniform font fitted to the available width and the original words on each line. The footer is compact, spacing responds to screen and browser-bar changes, and short screens retain normal scrolling. Opening pages, surah-heading pages, and shorter passages keep their natural layout. Desktop and both test-page layouts and audio behavior remain unchanged; loaded badges and the offline shell version are synchronized. No tests, builds, browser checks, or microphone tests were run for V32. Historical results below do not validate this layout change.

V31 makes all Quran text lines, including chapter-opening Bismillah, use the same fitted font size per mobile.html page. The smallest fit needed to preserve printed lines is recalculated with font-size or viewport changes. Desktop and test-page fitting are unchanged; the loaded badges and offline shell version are synchronized. No tests, builds, browser checks, or microphone tests were run for V31.

V30 changes chapter-opening Bismillah sizing only on mobile.html and synchronizes the loaded badges and offline shell version. This audio trial retains its existing behavior. No tests, builds, browser checks, or microphone tests were run for V30.

V29 changes swipe handling only on mobile.html and synchronizes the loaded badges and offline shell version. This audio trial retains its existing behavior and five-second pause interval. No tests, builds, browser checks, or microphone tests were run for V29; historical results below do not validate this release.

V28 changes Teacher's quiet-pause assistance from three to five seconds on all four entries and updates the help text. Both test pages retain up to three words for pause hints, while production entries retain one; immediate single-word correction and retry behavior are unchanged. No tests, builds, browser checks, or microphone tests were run for V28. Historical results below do not validate this delay change.

V27 changes microphone-start text alignment and page swipes only on `mobile.html`; this trial's layout, audio source, and V26 correction behavior remain unchanged apart from its synchronized badge. No tests, builds, browser checks, or microphone tests were run for V27. V24 results below remain historical and do not validate V26 or V27.

V26 retains transformation **revision 2** of QUA v3.2.0, introduced in V24. Replay uses strictly validated audible letter ownership intervals with their matching recordings. Ambiguous intervals use the existing selected-reciter timing and then the labelled Quran.com word reference if needed. This trial does not upgrade the learner model or live Madd/ghunnah grading.

## Voices and comparison

The Teacher panel retains two voices: **Mahmoud Khalil Al-Husary · Murattal** and **Abdul Basit Abdus Samad · Mujawwad**. The selected QUD timing datasets map all 6,236 ayahs for each voice to this app's words. Mapping coverage does not establish independent timing accuracy or complete word-isolation quality. Click a Quran word to hear its reference; enable Teacher for automatic single-word review playback and up to three words after the five-second quiet interval. Mistakes and individual word clicks remain single-word.

Compare the same word or pause hint on `test.html` and `test2.html` using the same voice. Listen for a clipped beginning or ending, an extra neighboring word, and whether a three-word hint starts at the highlighted pointer. Production `index.html`, `mobile.html`, and the working `test.html` retain their prior Teacher timing source and pause-hint lengths. Blank hidden text and corrected-word retry were shared on all four entries in V25; V26 holds a flagged word before later highlights. The version badges remain synchronized. QUD audio remains exclusive to `test2.html`.

## Why the original comparison was insufficient

The owner's listening check found an extra **wa** after `إِنَّا أَرْسَلْنَاكَ شَاهِدًا`, the three-word hint at **48:8**. Both 48:8 and the separately reported 49:8 were inspected. The source third-word boundary extends into the following word's waw:

| Voice | Published third-word end | Last owned letter / next waw onset | Extension into following waw |
| --- | ---: | ---: | ---: |
| Al-Husary | 215.160 s | 214.180 s | 980 ms |
| Abdul Basit | 272.605 s | 271.415 s | 1,190 ms |

This source discrepancy exists independently of a player's stopping delay. At **49:8**, the third-word end agrees with the letter interval: 290.770 s for Al-Husary and 395.435 s for Abdul Basit. QUA's [duration explanation](https://github.com/QUD-Technologies/quranic-universal-audio/blob/main/docs/qul_timestamp_comparison.md#4-duration) describes word intervals intended for continuous highlighting rather than speech-only replay. V23's automated checks established that playback followed the supplied endpoints, not that those endpoints excluded neighboring sounds. The previous coverage-based preference for QUA is withdrawn; neither source has established Quran-wide audible accuracy.

## Revision 2 replay intervals

The importer derives complete replay start/end times from audible owned letters only when they belong to the exact canonical take, have valid text paint ranges, and do not overlap either neighboring word's owned sounds. It retains `publishedWordStart`, `publishedWordEnd`, and `boundarySource: "owned-letters"` as provenance. No fixed amount is trimmed from every clip. Displayed text, local word positions, first canonical occurrences, exact recording URLs, and compatible-run identities are preserved. Ambiguous or unavailable QUA ownership is declined for the runtime's previous-source fallback; different sources are never joined into one guessed phrase.

Both imports map all **6,236 ayahs**, with **77,433 local word positions** per voice:

| Voice | Accepted QUA letter-derived replay intervals | Adjusted from published word bounds | Declined QUA positions, using existing fallback |
| --- | ---: | ---: | ---: |
| Al-Husary | 72,855 | 5,748 | 4,578 |
| Abdul Basit | 72,843 | 5,782 | 4,590 |

Declines include 4,569 / 4,572 ambiguous ownership intervals plus 9 / 18 short or zero-length source word intervals. Lower acceptance is intentional: uncertain QUA boundaries use the previous selected-reciter timing when usable, then the labelled Quran.com word reference. The long final Madd at **1:7, word 9** retains its complete original interval for both voices. These guards do not establish human-verified acoustic accuracy for every accepted word.

## Shared hidden text and corrected-word retry · V26

`data-hidden-text="blank"` removes hidden-word placeholder lines and leaves verse markers visible. `data-teacher-retry="word"` enables correction retry. With Teacher on, V26 holds the first newly flagged word before committing later word states or highlights, gates capture before correction audio prepares, and discards queued learner recognition while its acknowledgements drain and the segment resets. Teacher reads the expected word; after the recording and echo tail finish, fresh learner speech must match that word before continuing to its next word. The retry cannot jump to a saved later frontier. Teacher audio and old-session results cannot satisfy it. Its mistake mark and count remain; a successful retry does not erase the error or count it twice. Audio failure or cancellation releases the waiting state after the recognition barrier so the learner can retry, while Teacher off, reset, and navigation clear the target. Manual word playback and quiet-time hints retain the reading position. Introduced only on `test2.html` in V24, both flags became shared on `index.html`, `mobile.html`, `test.html`, and `test2.html` in V25. This does not add the deferred immediate-help trigger for a wrong word that stalls tracking without a review flag. No tests, builds, browser checks, or microphone tests were run for V26.

## Requested checks · historical V24 results

The checks below were requested and run for V24's timing-boundary and test2 retry work. No tests, builds, browser checks, or microphone tests were run for V25's enablement on the other three entry pages or V26's immediate correction hold. These historical results do not validate V26's changed retry behavior.

Both archive SHA-256 checks and complete-ayah text agreement passed. An independent audit verified all **145,698 accepted intervals** against raw owned-letter tokens, original word-bound provenance, recording URLs, and adjacent nonoverlap. Actual-module integration checked **154,866 local word lookups** and **129,978 three-word windows**. Every accepted word resolved correctly, unavailable intervals were declined, and valid phrase runs/order/gaps were enforced. Al-Husary resolved 52,776 phrase windows and declined 12,213; Abdul Basit resolved 50,874 and declined 14,115. All 229 metadata assets are below Cloudflare's 25 MiB limit; the largest is 1,404,743 bytes. Concurrent downloads and revision-2 cache identity passed.

Browser playback checks use real recordings. Automatic pause/review checks use a simulated reading state with the same capture-pause/resume interface; they never request or capture microphone audio. They check three words after three seconds of quiet, one word for a review, balanced recognition gating, and unchanged cursor/highlights/counts. Live learner recognition and pronunciation accuracy are outside this audio-source comparison.

The historical V23 six-scenario playback pass followed published source endpoints; it did not verify acoustic isolation and missed the owner's extra-waw example. V24's five real-playback scenarios passed: three-word hints at 48:8 and 49:8 in both voices, and the original Al-Husary word-timing fallback at 4:113, word 6. The four streamed hints began at their supplied starts and stopped 4–12 ms after their new endpoints; the fallback used its exact original WebAudio slice. Recognition capture gates balanced, and the simulated reading state/counts stayed unchanged during hints.

Sixteen prerecorded reference clips were decoded locally and fed to the same phoneme model without a microphone: original/revised intervals at 48:8, 49:8, 56:43, and 1:7 for each voice. Two seconds of identical trailing silence allowed the model's streaming context to finish. At 48:8, the original crops produced sounds from the following waw (and part of the next syllable in Al-Husary); revised crops did not. At 56:43, the following meem appeared in the original and disappeared in the revision. The 49:8 control transcriptions stayed the same. Al-Fatiha's final Madd bounds were unchanged; recognition of those clips, especially Abdul Basit, was not a complete accurate transcription and is not a pronunciation grade. Phoneme recognition supports the boundary audit but is not an independent human listening verdict. Live microphone behavior and a full listening review of every Quran word remain outside the automated comparison.

Eight retry-helper checks and eight integration scenarios using the actual app/Teacher/worker-handler source passed. They cover queued result draining, new-session barriers, rejection of Teacher/old-session audio, wrong vowel retries, original error history, continuing through fresh leftover speech, correction at the last page word, and turning Teacher off. Capture controls were simulated. The interface check confirmed all 29 hidden Al-Fatiha words have no placeholder/background while all seven Arabic verse numbers remain visible; the page reported no console errors. Source syntax checks and the static build passed. Reproducible scripts, full results, and the V24 screenshot are saved in the local trial artifact folder.

Start further listening comparisons with the **48:8** three-word hint, the **49:8** control, the first word at **56:43**, and the long final word at **1:7**. Listen for complete starts/ends, a neighboring sound, and hints beginning at the highlighted word. Keep uncertain examples for review before choosing a production source. The original source remains available on other pages. Evidence and reproducible harnesses are stored outside the repository in the owner's `qua-v21-trial` artifact folder.

## Offline and updates

The preview entry and adapter/catalog join the versioned offline app shell. The 228 per-surah timing shards are bundled with the site and cached as they are used; they are not all precached during shell installation. Selected QUD reference recordings stream from their exact external recording sources and require an internet connection; the trial does not promise offline selected-reciter audio or bundle the recordings. The prior app/model cache and existing saved word-audio fallback behavior are retained. The complete Quran audio is not bundled. Close every app tab and reopen while connected if an older badge remains visible. No update or reload is forced during recitation.

## Source and attribution

QUD Technologies' [Quranic Universal Audio](https://github.com/QUD-Technologies/quranic-universal-audio) publishes unified word and letter timing metadata. Its [notice](https://github.com/QUD-Technologies/quranic-universal-audio/blob/main/NOTICE.md) and [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/) require attribution, a licence link, and notice of modifications. The app identifies its modified, letter-derived replay intervals; recordings retain their separate source terms. See the bundled catalogue and `SOURCES.md` for the pinned dataset, transformation, and exact recording sources.

V24 introduced the strict replay-boundary revision, blank hidden text, and corrected-word retry trial. V25 enabled the latter two behaviors on all four pages while keeping QUD audio on `test2.html` only. V26 holds the first flagged word before later highlights and releases correction waiting after a fresh recognition barrier. No runtime update or reload is forced during recitation. This implementation and the historical V24 checks remain local for the owner to review and upload; V25's shared enablement and V26's immediate hold were not tested. A rollback must use a new visible version rather than restoring an old badge over changed code. No push or deployment was performed.
