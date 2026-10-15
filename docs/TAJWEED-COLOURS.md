# Tajweed colours · V23

Optional Tajweed letter colouring is available on `test.html` and its separate `test2.html` audio-trial copy. The Tajweed icon sits immediately below Teacher in the main controls. It starts **off** whenever the page loads; press it once to show annotated colours and again to return to plain text. Teacher can be on or off independently.

The colouring is a reference for the written rules. It does not grade the learner's sounds, change the reading pointer, add mistakes, or request Teacher audio. The V18 Madd/ghunnah timing experiment and its testing log are unchanged; we will return to recitation testing separately.

## Colour key

| Colour group | Source annotations |
| --- | --- |
| Red | Natural, necessary, obligatory, and permissible Madd |
| Green | Ghunnah |
| Purple | Idgham, including annotated Noon/Meem assimilation and related consonant assimilation |
| Teal | Ikhfa and iqlab |
| Blue | Qalqalah |
| Grey | Silent letters, hamzat al-wasl, and the assimilated lam of the sun letters |

The palette adapts to the light and dark themes. These are this app's visual groups; they do not claim to reproduce a publisher's printed colour convention. Rule classification is retained from the source. Not every Tajweed rule or pronunciation choice has a tag in that source, and plain text does not imply that no rule applies.

The exact source classes are `ghunnah`, `ham_wasl`, `idgham_ghunnah`, `idgham_mutajanisayn`, `idgham_mutaqaribayn`, `idgham_shafawi`, `idgham_wo_ghunnah`, `ikhafa`, `ikhafa_shafawi`, `iqlab`, `laam_shamsiyah`, `madda_necessary`, `madda_normal`, `madda_obligatory`, `madda_permissible`, `qalaqah`, and `slnt`.

## Existing page behavior

Letter spans use the same Quran font, font size, and shaping as the surrounding words. The existing Quran text, layout, word boundaries, hover references, and click-to-hear behavior remain intact. With colours enabled, matched and review words use their tracking backgrounds or underlines so the reference colours and tracking indicators can coexist. Show/hide also conceals coloured child spans when practicing from memory.

Colour loading is separate from Quran loading: missing or unavailable annotations leave the Quran readable in plain text. The importer accepts only complete-ayah letter agreement with specific edition equivalences. Any unresolved differences in future source imports will remain plain rather than assigning colours to a guessed letter.

The V20 bundled import maps **all 6,236 verses**, covering **77,433 words**, of which **49,795** have colour annotations. The 13 verses previously skipped in V19 are now mapped: `10:15`, `16:90`, `20:130`, `24:11`, `28:30`, `30:8`, `30:16`, `35:43`, `42:51`, `52:21`, `70:38`, `74:52`, and `80:37`. These counts describe the generated data, not browser or recitation test results. Mapping every verse does not mean every letter is coloured or that the source annotates every Tajweed rule.

This experiment is not enabled in `index.html` or `mobile.html`. Their visible versions are synchronized at V23 while production behavior stays at the current checkpoint.

## Source and transformation

The annotations come from [Quran Foundation's Uthmani Tajweed endpoint](https://api.quran.com/api/v4/quran/verses/uthmani_tajweed), documented in its [content API reference](https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/quran-verses-uthmani-tajweed/) and [GitHub documentation source](https://github.com/quran/qf-api-docs/blob/main/docs/content_apis_versioned/quran-verses-uthmani-tajweed.api.mdx).

The response retrieved on 2026-10-11 has SHA-256 `280608b003fac23a75ae3ea30f922c820acc30ed7bc67f583ad32acee7b0b6f3`. This identifies the imported source response; it is not a claim that the provider authenticates this checksum.

`scripts/import-tajweed-colors.py` parses tagged source text and maps rule spans onto exact positions in this app's existing words. It never modifies `aya_text`. Conservative aliases accommodate recognized spelling and mark differences between text editions; unresolved mappings remain plain. V20 accepts QF dotless yeh with explicit hamza below (`ىٕ`) against local yeh with explicit hamza above (`ئ`, or its decomposed spelling), while requiring the remaining complete ayah to agree. This is not a general yeh/dotless-yeh substitution. The 13 affected ayahs already had source annotations; only their edition mapping changed. The compact output is bundled at `public/data/tajweed-colors.json`, and `src/tajweed-colors.js` loads and applies the annotations. The existing alignment phonemes and recitation logic do not use this colouring data.

The data is attributed to Quran Foundation/Quran.com. Its content terms are separate from the app's code license; see [the third-party notice](../licenses/NOTICE.md) and [Quran Foundation's developer terms](https://api-docs.quran.com/legal/developer-terms/).

## Offline use and updates

The annotation file and colour module are included in the current V23 service-worker shell. Once the app finishes saving its offline files, colouring can work without a runtime API call or another model download. Browser storage eviction or cleared site data can remove the saved copy.

The badge identifies the code actually loaded. If an older version is visible, visit while connected, then close every app tab and reopen so the waiting update can activate. An update is not forced during recitation.

Changes remain local. Tests, builds, browser checks, and microphone sessions were not run for V20.
