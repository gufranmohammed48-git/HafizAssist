# Tajweed preview: manual comparison guide · V18

Use `test.html` for these experiments. Production `index.html` and `mobile.html` do not enable the new duration review or testing log. This guide describes trials for the owner to perform; no automated tests, builds, browser checks, or microphone tests were run for this change.

## What the hover means

**Estimated 0.64 s · Reference 4 harakat** means the recognizer estimates a 0.64-second interval for the held sound, while the supplied Quran annotation calls for four counts (harakat). It does not measure four counts or claim the whole word lasted 0.64 seconds. Counts are relative to recitation pace, not fixed seconds. The preview compares estimated milliseconds with a selected speed profile, using approximate CTC token emissions rather than verified acoustic boundaries.

**Within preview range** only means the estimate falls inside that profile's broad thresholds. It is not proof that the recitation or the timing algorithm is correct. **Not assessed** means usable evidence is missing, ambiguous, or excluded; it is not a pass.

## Prepare a controlled trial

1. Open `test.html` and confirm the badge says **V18**. If a cached older version remains, close all app tabs and reopen while connected; do not force an update while reciting.
2. Turn **Teacher off** so reference playback and pause hints do not interrupt the comparisons.
3. In **Settings → Tajweed preview**, choose **Normal** pace. Expand **Testing log**, leave **Record diagnostics** on, and press **Clear log** before the first comparison.
4. Search for one of the verses below. Start the microphone, keep quiet during startup calibration, then read the passage through the target word and the following word where possible.
5. Stop the microphone and hover over the target word. Compare its estimate, status, and any reason with the entries in **Testing log**. Use **Copy log** or **Download log** before reloading.

## Suggested words

| Search | Page | Target | What to compare |
| --- | --- | --- | --- |
| `1:2` | 1 | لِلَّهِ | Natural Madd: ordinary hold, deliberately shortened hold, then a longer hold. |
| `1:2` | 1 | رَبِّ | Shaddah on بّ: ordinary doubling, reduced doubling, then a longer hold. |
| `2:6` | 3 | إِنَّ | Held Noon ghunnah: ordinary nasal hold, shortened hold, then a longer hold. |
| `2:29` | 5 | ثُمَّ | Held Meem ghunnah: ordinary nasal hold, shortened hold, then a longer hold. |
| `1:7` | 1 | ٱلضَّآلِّينَ | Lazim Madd on ا: ordinary elongation, shortened elongation, then a longer hold. The final ي has a separate pause-dependent Madd rule. |

After each attempt, stop recording, export the log, reset practice, and repeat the same passage from the same point. Keep microphone position and selected pace the same. Use separate exports for ordinary, short, and long attempts so it is clear which is which. A deliberately long hold should generally produce a larger estimate than a short one when usable timing is available; wide thresholds can still give both attempts **Within preview range**.

For most words, continue into the next sound or word so recognition can observe the held sound's end. Al-Fatiha's final word may automatically turn to page 2. Its testing events remain in the same tab's log, so export them there. Stopping a stream does not invent a missing acoustic boundary. Ghunnah and shaddah often remain **Not assessed** when the model combines a consonant and its following vowel in one token; the app does not divide that token into guessed durations.

## All seven Madd profiles

These are annotations found in the bundled Quran data, not claims that every trial will yield usable timing.

| Preview rule | Search | Page | Target | Reference | How to read for this check |
| --- | --- | --- | --- | --- | --- |
| Natural Madd | `1:2` | 1 | لِلَّهِ | 2 harakat | Continue into رَبِّ. |
| Separated Madd | `2:4` | 2 | بِمَآ | 4 harakat | Continue into أُنزِلَ. |
| Connected Madd | `2:5` | 2 | أُو۟لَـٰٓئِكَ | 4 harakat | Continue naturally through the word. |
| Connected Madd at Pause | `3:5` | 50 | ٱلسَّمَآءِ | 4 harakat | Stop after this word and allow a final recognition result. |
| Temporary Madd | `1:3` | 1 | ٱلرَّحِيمِ | 4 harakat | Stop after this word and allow a final recognition result. |
| Lazim Madd | `1:7` | 1 | ٱلضَّآلِّينَ | 6 harakat on ا | The final ي has its own pause-dependent annotation. Export the log after the automatic page turn. |
| Leen Madd | `106:3` | 602 | ٱلْبَيْتِ | 4 harakat | Stop here; currently expect **Not assessed**, as explained below. |

Leen has a known mapping limitation in the current preview. Its reference annotations count four harakat, but the matching phoneme runs contain three repeated glide symbols (or six versus five in the opening letters). The conservative span mapper requires these lengths to agree, so the bundled Leen cases are not assessed. The log should show that the annotations cannot be assigned to unique spans. This checks the unavailable explanation, not successful Leen duration correction; changing that mapper is separate work.

## Compare the evidence

The recent rows summarize the estimated seconds, selected pace, and minimum/target/maximum thresholds. Exported JSON also includes recognition timing protocol, tokens, timestamps, matched word location, exclusions, rule details, status reasons, and supported vowel reviews. Look for an unavailable reason before assuming a rule was checked. A recognition mismatch or missing boundary can prevent assessment even when tracking moves forward.

For a separate vowel comparison, read an interior short vowel correctly, reset practice, then change that vowel while preserving the surrounding consonants. Review the word's hover and exported `vowel` event. Detection still depends on the recognizer capturing the changed vowel. A missing word-ending vowel at a pause is intentionally not treated as an interior-vowel omission.

Keep the log exports and label each attempted sound. Send an example where a deliberately short or long hold produces an unexpected status, or where a vowel mistake passes unnoticed, with the verse and what you intended to recite. That lets us distinguish recognition timing, word matching, rule mapping, and threshold problems.

## Log retention

The log starts enabled and stores at most **160 events** and approximately **2 MiB** in local memory. It saves no audio and uploads nothing. Practice reset and page turns retain events; **Clear log** removes only the diagnostics. Reloading or closing the tab clears all entries. Export before refreshing. Older entries are discarded when the limit is reached, so export shortly after a useful example.
