# QUD Teacher timing trial

These files are a local transformation of **QUD Technologies' Qur'anic Universal Audio**, release **v3.2.0**, licensed **CC BY 4.0**. Credit QUD Technologies, retain the source and licence links, and identify modifications when redistributing these timing files.

- Project: https://github.com/QUD-Technologies/quranic-universal-audio
- Release: https://github.com/QUD-Technologies/quranic-universal-audio/releases/tag/v3.2.0
- Licence: https://creativecommons.org/licenses/by/4.0/ (legal text in `LICENSE-CC-BY-4.0.txt`)
- Upstream notice: https://github.com/QUD-Technologies/quranic-universal-audio/blob/main/NOTICE.md

## Exact recordings

| App voice | Published QUA recording | Audio source |
| --- | --- | --- |
| Al-Husary Murattal | `mahmoud_khalil_al_husary_mp3quran` | `https://server13.mp3quran.net/husr/SSS.mp3` |
| Abdul Basit Mujawwad | `abdulbasit_abdulsamad_mujawwad_tarteel` | `https://audio-cdn.tarteel.ai/quran/surah/abdulBasit/mujawwad/mp3/SSS.mp3` |

`SSS` is the three-digit surah number. The exact original URL is retained beside every accepted word. These are full-surah recordings with source-relative timestamps. Do not apply these timestamps to the current EveryAyah verse files or another recording of the same reciter.

No audio is bundled, mirrored, or relicensed. Recordings remain subject to their reciter/producer and original source's terms. The timing licence grants no additional recording rights. The test2 trial seeks streamed recordings with a media element instead of decoding/downloading full chapters into the short-word cache; those selected-voice streams need a connection. Saved Quran.com word references may remain available offline under the existing cache policy.

## Transformation

`scripts/import-teacher-qua.py` checks each downloaded zip against the pinned release manifest, reads canonical complete word/letter rows, and requires agreement with every local word in the ayah. Font-edition differences are normalized conservatively: precomposed marks, alif-wasl, dotted/dotless yeh spellings, and superscript vowel letters. Word positions and displayed text are not rewritten. Accepted source milliseconds are converted to seconds and source chapter offsets are retained if present.

**Transformation revision 2** uses the audible letter ownership intervals for short word/phrase replay. Upstream word intervals are intended for continuous highlighting and can extend into another word's leading sound. For example, Al-Husary 48:8 word 3 has a published word end of 215.160 seconds, but its last owned letter ends at 214.180 seconds and the following word's waw begins there. The importer now retains 214.180 as the replay end and preserves the original bounds in `publishedWordStart` / `publishedWordEnd`. Abdul Basit's corresponding replay end is 271.415 instead of 272.605 seconds.

Every accepted word carries `boundarySource: "owned-letters"` and the original word bounds. Each owned interval must belong to the exact canonical take, have valid text paint ranges for its word occurrence, and not overlap either adjacent word's audible owned interval. Invalid or ambiguous ownership is declined. There is no universal time trimming or guessed word boundary. These guards do not establish human-verified acoustic accuracy; listening checks remain necessary.

First occurrences are selected when a reciter repeats a word inside the canonical ayah. Each clip retains its contiguous-run identity. A pause phrase may join two or three words only when they belong to one recording and one compatible run, without overlap or a gap over 1.5 seconds. Otherwise the words play separately. This prevents stitching across reciter repeats.

Timings under 80 ms or over 45 seconds are declined. Both voices map all **6,236 ayahs**. Out of **77,433 local words**, Al-Husary has **72,855** accepted QUA letter-derived replay intervals and Abdul Basit **72,843**. The importer declined 4,569 / 4,572 ambiguous letter ownership intervals and 9 / 18 short or zero-length original word intervals. It adjusted 5,748 / 5,782 replay intervals relative to published word bounds. Missing or declined QUA intervals use the existing reciter timing source when it can supply an isolated word; otherwise the application uses its labelled Quran.com word reference. The importer never fabricates a missing interval.

Archives and the local Quran-text checksums are retained in `catalog.json`. Timings are split into one small JSON file per surah and voice. Metadata is cached as used; application-shell caching includes the catalogue and adapter. If the transformation changes, increment the revision in both generated data and `src/teacher-qua.js` to invalidate previous cached metadata.

These timestamps are prerecorded reference boundaries. They do not measure the learner's microphone audio or grade Madd, ghunnah, shaddah, or vowels. Individual-word boundary accuracy still needs listening review.
