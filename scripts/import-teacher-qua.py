"""Import pinned QUA word timings for the separate test2 Teacher trial.

Consumes downloaded release archives; does not fetch or redistribute audio.
Only complete canonical ayahs with matching reference words are accepted.
Repeated words keep their first published occurrence and its contiguous run.
"""
import argparse
import gzip
import hashlib
import json
import math
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

RELEASE = "v3.2.0"
REVISION = 2
SOURCE = "https://github.com/QUD-Technologies/quranic-universal-audio"
VOICES = {
    "husary-murattal": "mahmoud_khalil_al_husary_mp3quran",
    "abdulbasit-mujawwad": "abdulbasit_abdulsamad_mujawwad_tarteel",
}


def word_key(text):
    # Match published Hafs words across font editions: retain every base
    # letter, treating alif-wasl/alif and the editions' dotted/dotless yeh
    # spellings alike. Superscript waw/yeh are vowel marks in these fonts,
    # not base consonants (17:7 uses a combining small waw in one edition).
    # No word deletion, insertion, or fuzzy alignment.
    text = unicodedata.normalize("NFKD", text.replace("ٱ", "ا"))
    return "".join(c.replace("ى", "ي") for c in text
                   if unicodedata.category(c).startswith("L") and c not in {"ـ", "ۥ", "ۦ", "ۨ"})


def public_url(url):
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.netloc and not (
        parsed.username or parsed.password or parsed.fragment)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def owned_letter_spans(row):
    """Return only unambiguous audible ownership intervals from the same take.

    Published word intervals serve continuous highlighting and may contain the
    next word's leading sound. Letter ownership supplies replay boundaries only
    when its text ranges and adjacent audible intervals are unambiguous.
    """
    key, start, end, canonical, silence, words, text, tokens = row
    text_words = list(re.finditer(r"\S+", text))
    if len(text_words) != len(words) or not isinstance(tokens, list):
        return [None] * len(words)
    audible = defaultdict(list)
    invalid = set()
    for token in tokens:
        if not isinstance(token, list) or len(token) != 5:
            return [None] * len(words)
        occurrence, token_start, token_end, owns, paint = token
        if (not isinstance(occurrence, int) or isinstance(occurrence, bool)
                or not 0 <= occurrence < len(words)):
            return [None] * len(words)
        text_word = text_words[occurrence]
        if (not isinstance(owns, bool) or not isinstance(paint, list) or not paint
                or not all(isinstance(v, (int, float)) and not isinstance(v, bool)
                           and math.isfinite(v) for v in (token_start, token_end))
                or not start <= token_start < token_end <= end
                or any(not isinstance(pair, list) or len(pair) != 2
                       or not all(isinstance(v, int) and not isinstance(v, bool) for v in pair)
                       or not text_word.start() <= pair[0] < pair[1] <= text_word.end()
                       for pair in paint)):
            invalid.add(occurrence)
            continue
        if owns:
            audible[occurrence].append((token_start, token_end))
    spans = {i: (min(s for s, e in intervals), max(e for s, e in intervals))
             for i, intervals in audible.items() if i not in invalid}
    result = []
    for occurrence in range(len(words)):
        span = spans.get(occurrence)
        previous = spans.get(occurrence - 1)
        following = spans.get(occurrence + 1)
        if (not span or not 80 <= span[1] - span[0] <= 45000
                or occurrence > 0 and not previous
                or occurrence + 1 < len(words) and not following
                or previous and previous[1] > span[0]
                or following and span[1] > following[0]):
            result.append(None)
        else:
            result.append(span)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--reference", type=Path, default=Path("public/data/quran.json"))
    parser.add_argument("--output", type=Path, default=Path("public/data/teacher-qua"))
    args = parser.parse_args()
    manifest = json.loads((args.source_dir / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("release_version") != RELEASE or manifest.get("schema_version") != 3:
        raise ValueError("Use the pinned QUA v3.2.0 schema-3 release")
    reference_bytes = args.reference.read_bytes()
    reference = json.loads(reference_bytes)["verses"]
    catalog = {"schema": 1, "provider": "QUA", "release": RELEASE, "revision": REVISION,
               "source": SOURCE, "license": "CC-BY-4.0",
               "referenceSha256": hashlib.sha256(reference_bytes).hexdigest(),
               "transformation": "Canonical complete Hafs ayahs; exact base-word agreement across font editions; first repeated occurrence with contiguous-run identity; audible letter ownership boundaries with strict adjacent nonoverlap and text-range validation; ambiguous ownership declined; original word bounds retained as provenance; exact original recording URLs retained",
               "voices": {}}
    for voice, slug in VOICES.items():
        archive_bytes = (args.source_dir / (slug + ".zip")).read_bytes()
        item = manifest["recitations"][slug]
        digest = hashlib.sha256(archive_bytes).hexdigest()
        if digest != item["sha256"]:
            raise ValueError("Archive checksum does not match release manifest: " + slug)
        with zipfile.ZipFile(args.source_dir / (slug + ".zip")) as archive:
            source_catalog = json.loads(archive.read("catalog.json"))
            words = json.loads(gzip.decompress(archive.read("word_timestamps.json.gz")))
            letters = json.loads(gzip.decompress(archive.read("letter_timestamps.json.gz")))
        if words["_meta"].get("units") != "ms" or source_catalog.get("riwayah") != "hafs_an_asim":
            raise ValueError("Expected Hafs millisecond word timings")
        source_letters = {(r[0], r[1], r[2]): r for r in letters["rows"] if r[3]}
        del letters
        canonical = defaultdict(list)
        for row in words["rows"]:
            if row[3]:
                canonical[row[0]].append(row)
        surahs = defaultdict(dict)
        skipped = []
        stats = Counter()
        audio = source_catalog["audio"]
        for key, local in reference.items():
            rows = canonical.get(key, [])
            if len(rows) != 1:
                skipped.append({"key": key, "reason": "No unique complete canonical take"})
                continue
            row = rows[0]
            local_words = local["aya_text"].split()
            positions = row[5]
            letter_row = source_letters.get((key, row[1], row[2]))
            text_words = letter_row[6].split() if letter_row else []
            if not letter_row or letter_row[5] != positions:
                skipped.append({"key": key, "reason": "Word/letter canonical take differs"})
                continue
            if len(local_words) != len(local["aya_phonemes_list"]):
                skipped.append({"key": key, "reason": "Local word/phoneme count differs"})
                continue
            # Published letter text may include the reciter's repeats. It is
            # either canonical text or one text word per audible occurrence.
            if len(text_words) == len(positions):
                pairs = [(p[0], t) for p, t in zip(positions, text_words)]
            elif len(text_words) == len(local_words):
                pairs = list(enumerate(text_words, 1))
            else:
                skipped.append({"key": key, "reason": "Source text/occurrences differ"})
                continue
            if (set(p[0] for p in positions) != set(range(1, len(local_words) + 1)) or
                any(not isinstance(index, int) or index < 1 or index > len(local_words) or
                    word_key(text) != word_key(local_words[index - 1]) for index, text in pairs)):
                skipped.append({"key": key, "reason": "Complete-ayah reference words differ"})
                continue
            surah = int(key.split(":")[0])
            url = audio["chapter_urls"].get(str(surah))
            if not isinstance(url, str) or not public_url(url):
                skipped.append({"key": key, "reason": "No matching public recording"})
                continue
            offset = audio.get("chapter_offsets_ms", {}).get(str(surah), 0)
            selected = {}
            seen = set()
            owned_spans = owned_letter_spans(letter_row)
            run = 0
            previous_index = 0
            previous_end = row[1]
            for occurrence, (index, start, end) in enumerate(positions):
                if index != previous_index + 1 or start - previous_end > 1500:
                    run += 1
                take = f"{key}:{row[1]}:{run}"
                previous_index, previous_end = index, end
                # A later repeat must not substitute for an ambiguous first
                # occurrence, which could stitch different recitation takes.
                if index in seen:
                    stats["repeatedOccurrences"] += 1
                    continue
                seen.add(index)
                if (not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (start, end))
                        or start < row[1] or end > row[2] or end - start < 80 or end - start > 45000):
                    stats["declinedWordBounds"] += 1
                    continue
                owned = owned_spans[occurrence]
                if owned is None:
                    stats["declinedAmbiguousLetterOwnership"] += 1
                    continue
                replay_start, replay_end = owned
                word = {"position": index, "start": (replay_start + offset) / 1000,
                        "end": (replay_end + offset) / 1000, "url": url, "take": take,
                        "boundarySource": "owned-letters",
                        "publishedWordStart": (start + offset) / 1000,
                        "publishedWordEnd": (end + offset) / 1000}
                if (replay_start, replay_end) != (start, end):
                    stats["adjustedLetterBoundaries"] += 1
                selected[index] = word
            surahs[surah][key] = {"wordCount": len(local_words), "words": list(selected.values())}
            stats["mappedVerses"] += 1
            stats["mappedWords"] += len(selected)
        for surah in range(1, 115):
            write_json(args.output / slug / f"{surah}.json",
                       {"schema": 1, "provider": "QUA", "release": RELEASE, "revision": REVISION,
                        "voice": voice, "verses": surahs[surah]})
        catalog["voices"][voice] = {
            "slug": slug, "name": source_catalog["name_en"], "style": source_catalog["style"],
            "source": item["zip_url"], "archiveSha256": digest,
            "audioCategory": source_catalog["audio_category"], "audioSource": source_catalog["channel"],
            "scriptSha256": words["_meta"].get("script_sha256"),
            "timingPath": "./{slug}/{surah}.json", "coverage": dict(stats), "skipped": skipped}
        print(json.dumps({"voice": voice, "coverage": dict(stats), "skippedCount": len(skipped),
                          "skippedExamples": skipped[:15]}, ensure_ascii=True), flush=True)
    write_json(args.output / "catalog.json", catalog)


if __name__ == "__main__":
    main()
