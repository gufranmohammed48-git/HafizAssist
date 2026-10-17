# Teacher voice timing sources

These timing files support the Teacher voice selector shared by all four entries. V37 activates all five original-source recitation choices: three Murattal and two Mujawwad, representing four reciters. Al-Husary remains the initial voice and existing saved selections are preserved. V12 previously offered only Al-Husary Murattal and Abdul Basit Mujawwad. The files contain timing metadata only. No recitation audio is bundled here.

## Attribution and license

Word alignment data: **Chris Fair, [quran-align](https://github.com/cpfair/quran-align)**, release `release-2016-11-24`, licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. The original license is included as `LICENSE-CC-BY-4.0.txt`.

Source archive: <https://github.com/cpfair/quran-align/releases/download/release-2016-11-24/quran-align-data-2016-11-24.zip>.

Adaptations: removed alignment statistics; indexed records by `surah:ayah`; retained valid original word spans and millisecond boundaries; added source metadata. Malformed, negative, or empty spans are omitted. The original timing boundaries have not been manually reviewed or changed.

## Matching recordings

Each timing file must be used with its corresponding **[EveryAyah](https://everyayah.com/data/)** recording folder. A verse URL has the form `https://everyayah.com/data/FOLDER/SSSAAA.mp3`, where `SSS` is the three-digit surah and `AAA` is the three-digit ayah. Changing recording or bitrate without matching timing data can shift the audio boundaries.

| Voice ID | Recitation | Exact folder / original JSON stem | V37 usage |
| --- | --- | --- | --- |
| `husary-murattal` | Mahmoud Khalil Al-Husary · Murattal | `Husary_64kbps` | Active; initial voice; also active in V12 |
| `minshawi-murattal` | Muhammad Siddiq Al-Minshawi · Murattal | `Minshawy_Murattal_128kbps` | Active; restored from V10 |
| `afasy-murattal` | Mishary Rashid Al-Afasy · Murattal | `Alafasy_128kbps` | Active; restored from V10 |
| `abdulbasit-mujawwad` | Abdul Basit Abdus Samad · Mujawwad | `Abdul_Basit_Mujawwad_128kbps` | Active; also active in V12 |
| `minshawi-mujawwad` | Muhammad Siddiq Al-Minshawi · Mujawwad | `Minshawy_Mujawwad_192kbps` | Active; restored from V10 |

These are source recording sets, not an objective ranking. V10 also offered Al-Husary Mujawwad as full-ayah help because the imported archive had no matching timing file. That choice and whole-ayah fallback are removed in V12.

## Timing schema and limitations

Each JSON has `schema: 1`, `voice`, `source`, `sourceFile`, `audioFolder`, `license`, `wordIndexBasis`, and `verses`. A `verses["1:1"]` array contains spans of the form:

```json
[0, 1, 60, 610]
```

The entries mean `[firstWordIndex, exclusiveEndWordIndex, startMilliseconds, endMilliseconds]`. Word indices are zero-based **Tanzil space-separated words**, which can differ from this app's Quran Foundation word positions. Resolve timing positions independently from Quran Foundation word-audio positions. The merged source positions for 2:181, 8:6, and 13:37 apply to these timings, while 37:130 retains four distinct Tanzil words even though Quran Foundation's source audio combines its last two displayed words.

The source covers all 6,236 ayah records but can omit a word or combine multiple words into one span. Only a span with an exclusive end exactly one greater than the start identifies an isolated word. Repetitions and unusual boundaries may be imperfect. Do not fabricate timings for absent words or treat combined spans as a verified isolated-word clip.

Since V12, playback falls back to the existing Quran.com word reference when a timing is missing, grouped, shorter than 80 ms, has a source word-count mismatch, or exceeds decoded audio bounds. V37 preserves that behavior for all five choices. The fallback is labeled separately and does not claim the selected reciter's identity; it does not play the whole ayah. No missing boundaries were newly aligned or manually reviewed in this batch. Obtaining complete consistent coverage requires alignment against the exact recordings and listening review before publishing reviewed timings or permitted word clips.

V37 adds no recognition model and no QUD source to production. It reuses the already bundled original-source timing JSON files without changing their data. No tests, builds, browser checks, or audio tests were run; changes remain local.

Recitation recordings remain subject to the original reciter/source rights; the timing metadata license does not grant additional rights to those recordings.
