"""Bundle Quran Foundation colours without changing the app's Quran text.

This is a data importer, not a recitation evaluator. It accepts an already
downloaded API response, strips markup, and transfers annotations only where
the complete ayah's Arabic letter sequence agrees with the local reference.
Every emitted range covers complete Arabic letter-and-mark clusters.
"""

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


RULES = {
    "ham_wasl", "laam_shamsiyah", "slnt", "madda_normal",
    "madda_permissible", "madda_obligatory", "madda_necessary", "ghunnah",
    "ikhafa", "ikhafa_shafawi", "idgham_ghunnah", "idgham_wo_ghunnah",
    "idgham_shafawi", "idgham_mutajanisayn", "idgham_mutaqaribayn",
    "iqlab", "qalaqah",
}
SOURCE_URL = "https://api.quran.com/api/v4/quran/verses/uthmani_tajweed"


class TaggedText(HTMLParser):
    """Read text and supported annotation labels; never keep HTML."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.characters = []
        self.tags = []
        self.unknown_rules = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        ignored = tag == "span" and "end" in classes
        rule = next((name for name in classes if name in RULES), None)
        if tag == "tajweed" and not rule:
            self.unknown_rules.update(classes)
        self.tags.append((tag, rule, ignored))

    def handle_endtag(self, tag):
        for index in range(len(self.tags) - 1, -1, -1):
            if self.tags[index][0] == tag:
                del self.tags[index:]
                break

    def handle_data(self, data):
        if any(ignored for _, _, ignored in self.tags):
            return
        rule = next((rule for _, rule, _ in reversed(self.tags) if rule), None)
        self.characters.extend((character, rule) for character in data)


def letter_key(character):
    # Compatibility forms and precomposed hamza/marks have the same base.
    # Alif-wasl is explicitly equivalent to alif; no other letters are dropped.
    if character == "ٱ":
        character = "ا"
    return "".join(
        part for part in unicodedata.normalize("NFKD", character)
        if unicodedata.category(part).startswith("L") and part != "ـ"
    )


def clusters(characters):
    result = []
    previous = None
    for offset, (character, rule) in enumerate(characters):
        category = unicodedata.category(character)
        if character.isspace():
            previous = None
            continue
        modifier = category.startswith("M") or category == "Cf" or character == "ـ"
        if modifier and previous is not None:
            previous["end"] = offset + 1
            previous["text"] += character
            previous["annotations"].append((character, rule))
            if rule:
                previous["labels"].append(rule)
            continue
        if not category.startswith("L") or character == "ـ":
            # Nonletters are kept in display text, but are not letter anchors.
            # Quran stop marks are usually combining marks handled above.
            previous = None
            continue
        previous = {
            "start": offset, "end": offset + 1, "text": character,
            "base": letter_key(character), "labels": [rule] if rule else [],
            "annotations": [(character, rule)],
        }
        result.append(previous)
    return result


def chosen_rule(cluster):
    labels = cluster["labels"]
    # A labelled vowel/elongation marker colours its complete glyph cluster.
    # Madd takes precedence if a cluster has multiple source labels; otherwise
    # the last supplied nonempty label wins. We do not invent new rule labels.
    return next((rule for rule in reversed(labels) if rule.startswith("madda_")),
                labels[-1] if labels else None)


def representation_text(text):
    return unicodedata.normalize("NFKD", "".join(
        character for character in text
        if character != "ـ" and unicodedata.category(character) != "Cf"
    ))


def map_ayah(reference, tagged):
    source_clusters = clusters(tagged.characters)
    local_clusters = clusters([(character, None) for character in reference])
    pairs = []
    source_index = 0
    local_index = 0
    equivalences = Counter()
    while local_index < len(local_clusters):
        local = local_clusters[local_index]
        if source_index >= len(source_clusters):
            return None
        source = source_clusters[source_index]
        if source["base"] != local["base"]:
            # The Tajweed edition uses dotless beh as this superscript-alif
            # carrier. Accept only the exact dotless-yeh carrier counterpart.
            if (source["base"] == "ٮ" and local["base"] == "ى"
                    and "ٰ" in source["text"] and "ٰ" in local["text"]):
                equivalences["dotless-yeh"] += 1
            # These editions spell the same hamza-on-yeh with different
            # seats: QF uses dotless yeh + hamza below; our text uses ئ
            # (or its decomposed yeh + hamza above). Require both explicit
            # hamza marks, never a general dotless-yeh/yeh equivalence.
            elif (source["base"] == "ى" and local["base"] == "ي"
                    and "\u0655" in source["text"]
                    and "\u0654" in unicodedata.normalize("NFKD", local["text"])):
                equivalences["hamza-on-yeh-seat"] += 1
            else:
                return None
        source_index += 1
        # The QF edition writes U+0672 at certain tagged Madd places
        # where the local edition writes U+0670 on the preceding letter.
        # This narrowly defined representation is mapped only when that exact
        # superscript alif is present in the corresponding local cluster.
        if source_index < len(source_clusters):
            following = source_clusters[source_index]
            following_rule = chosen_rule(following) or ""
            exact_untagged = (not following["labels"] and representation_text(
                source["text"] + following["text"].replace("ٲ", "ٰ")
            ) == representation_text(local["text"]))
            if ("ٰ" in local["text"] and following["base"] == "ٲ"
                    and source["end"] == following["start"]
                    and (following_rule.startswith("madda_") or exact_untagged)):
                source = {**source,
                          "text": source["text"] + following["text"],
                          "labels": source["labels"] + following["labels"]}
                source_index += 1
                equivalences["madd-superscript-alif" if following_rule else "untagged-superscript-alif"] += 1
        # Some QF words place tagged Fatha + tatweel + superscript alif on
        # the consonant, while our edition writes the same elongation on an
        # immediately following dotless-yeh carrier. Require the explicit
        # source sequence, an annotated superscript alif, exactly matching
        # preceding consonant/marks, and an otherwise bare local ىٰ cluster.
        if local_index + 1 < len(local_clusters):
            carrier = local_clusters[local_index + 1]
            madd = next((rule for character, rule in reversed(source["annotations"])
                         if character == "ٰ" and rule and rule.startswith("madda_")), None)
            bare_carrier = (madd and re.search("َـ+ٰ", source["text"])
                            and "َ" in local["text"] and "ٰ" not in local["text"]
                            and local["end"] == carrier["start"]
                            and representation_text(carrier["text"]) == "ىٰ"
                            and representation_text(source["text"].replace("ٰ", ""))
                            == representation_text(local["text"]))
            if bare_carrier:
                consonant = {**source, "labels": [rule for rule in source["labels"]
                                                     if not rule.startswith("madda_")]}
                pairs.append((consonant, local))
                pairs.append(({"text": carrier["text"], "labels": [madd]}, carrier))
                equivalences["bare-madd-to-yeh-carrier"] += 1
                local_index += 2
                continue
        pairs.append((source, local))
        local_index += 1
    if source_index != len(source_clusters):
        return None
    mode = "canonical-clusters" if all(
        unicodedata.normalize("NFKD", source["text"]) ==
        unicodedata.normalize("NFKD", local["text"])
        for source, local in pairs
    ) else "same-base-letter-clusters"
    if equivalences:
        mode = "+".join(sorted(equivalences))
    coloured = [
        (local["start"], local["end"], chosen_rule(source))
        for source, local in pairs
    ]
    words = []
    for token in re.finditer(r"\S+", reference):
        runs = []
        for start, end, rule in coloured:
            if rule is None or not token.start() <= start < token.end():
                continue
            if end > token.end():
                raise ValueError("A mapped cluster crosses a word boundary")
            start -= token.start()
            end -= token.start()
            if runs and runs[-1]["end"] == start and runs[-1]["rule"] == rule:
                runs[-1]["end"] = end
            else:
                runs.append({"start": start, "end": end, "rule": rule})
        words.append({"text": token.group(), "runs": runs})
    return {"words": words}, mode, equivalences


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Downloaded API JSON response")
    parser.add_argument("--reference", type=Path, default=Path("public/data/quran.json"))
    parser.add_argument("--output", type=Path, default=Path("public/data/tajweed-colors.json"))
    parser.add_argument("--downloaded-at", help="ISO timestamp of the API download")
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    reference_bytes = args.reference.read_bytes()
    source = json.loads(source_bytes.decode("utf-8-sig"))
    reference = json.loads(reference_bytes.decode("utf-8-sig"))["verses"]
    verses = {}
    skipped = []
    modes = Counter()
    rule_counts = Counter()
    unknown_rules = set()
    mapped_words = coloured_words = 0
    equivalence_counts = Counter()
    equivalence_ayahs = Counter()
    for verse in source["verses"]:
        key = verse["verse_key"]
        local = reference.get(key)
        if not local:
            skipped.append({"key": key, "reason": "No local reference ayah"})
            continue
        if any(ord(character) > 0xFFFF for character in local["aya_text"]):
            skipped.append({"key": key, "reason": "Non-BMP text needs UTF-16 offsets"})
            continue
        tagged = TaggedText()
        tagged.feed(verse["text_uthmani_tajweed"])
        tagged.close()
        unknown_rules.update(tagged.unknown_rules)
        mapped = map_ayah(local["aya_text"], tagged)
        if mapped is None:
            skipped.append({"key": key, "reason": "Arabic letter clusters differ"})
            continue
        data, mode, equivalences = mapped
        verses[key] = data
        modes[mode] += 1
        equivalence_counts.update(equivalences)
        equivalence_ayahs.update(equivalences.keys())
        mapped_words += len(data["words"])
        for word in data["words"]:
            coloured_words += bool(word["runs"])
            rule_counts.update(run["rule"] for run in word["runs"])
    downloaded_at = args.downloaded_at or datetime.fromtimestamp(
        args.source.stat().st_mtime, timezone.utc
    ).isoformat().replace("+00:00", "Z")
    output = {
        "schema": 1,
        "source": {
            "provider": "Quran Foundation", "url": SOURCE_URL,
            "downloadedAt": downloaded_at,
            "rawSha256": hashlib.sha256(source_bytes).hexdigest(),
            "referenceSha256": hashlib.sha256(reference_bytes).hexdigest(),
            "mapping": "Complete-ayah Arabic base-letter agreement, preserving local text",
            "representationEquivalences": [
                "QF Madd-tagged U+0672 maps only to an explicit local U+0670 on the corresponding contiguous preceding letter",
                "QF U+066E and local U+0649 are equivalent carriers only when both explicitly carry U+0670",
                "Untagged QF U+0672 maps to local U+0670 only when the complete corresponding letter/mark cluster matches after the explicit representation change; no rule is added",
                "QF tagged Fatha + tatweel + superscript alif maps to an immediate local bare U+0649 + U+0670 carrier after the same consonant/marks; Madd colour transfers to the carrier",
                "QF U+0649 with explicit U+0655 maps only to local U+064A with explicit U+0654 after NFKD (normally U+0626); existing source labels transfer to the whole local cluster without changing its text",
            ],
            "clusterPolicy": "Whole letter/mark clusters; Madd labels take priority, then last source label",
            "offsetUnit": "Unicode code points (this bundle contains BMP text only)",
        },
        "coverage": {
            "sourceVerses": len(source["verses"]), "mappedVerses": len(verses),
            "skippedVerses": len(skipped), "mappedWords": mapped_words,
            "colouredWords": coloured_words, "mappingModes": dict(modes),
            "superscriptAlifEquivalences": equivalence_counts["madd-superscript-alif"],
            "dotlessYehEquivalences": equivalence_counts["dotless-yeh"],
            "untaggedSuperscriptAlifEquivalences": equivalence_counts["untagged-superscript-alif"],
            "bareMaddCarrierEquivalences": equivalence_counts["bare-madd-to-yeh-carrier"],
            "hamzaOnYehSeatEquivalences": equivalence_counts["hamza-on-yeh-seat"],
            "representationModes": {name: {"occurrences": count, "ayahs": equivalence_ayahs[name]}
                                    for name, count in sorted(equivalence_counts.items())},
            "rules": dict(sorted(rule_counts.items())),
            "unknownRules": sorted(unknown_rules), "skipped": skipped,
        },
        "verses": verses,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    summary = {key: value for key, value in output["coverage"].items() if key != "skipped"}
    summary["skippedExamples"] = skipped[:12]
    print(json.dumps({"output": str(args.output), "rawSha256": output["source"]["rawSha256"],
                      "coverage": summary}, ensure_ascii=True))


if __name__ == "__main__":
    main()
