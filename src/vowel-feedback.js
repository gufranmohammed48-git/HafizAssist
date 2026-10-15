// Post-alignment short-vowel feedback adapted from ReciteQuran's
// ErrorExplainer (same base sound before comparing attached vowels).
// See licenses/ReciteQuran.txt. Recognition evidence is not acoustic grading.
const shortVowel = value => typeof value === 'string' && value.length === 1 && 'َُِ'.includes(value);
const consonant = value => typeof value === 'string'
  && /^[ء-غف-ي]$/u.test(value) && value !== 'ا';

export function reviewAlignedVowels(references, trace, insertions = []) {
  const reference = references.join('');
  const byPosition = new Map(trace.map(step => [step.ref, step]));
  const ranges = [];
  let offset = 0;
  for (const word of references) {
    ranges.push({ start: offset, end: offset + word.length });
    offset += word.length;
  }
  const rangeAt = position => ranges.find(range => position >= range.start && position < range.end);
  const coreAt = position => {
    const letter = reference[position];
    if (!consonant(letter)) return false;
    if (!'وي'.includes(letter)) return true;
    // Normalization maps the model's long ۥ/ۦ into و/ي. Retain consonantal
    // waw/ya as anchors, but never use a repeated/lengthened vowel as one.
    return reference[position - 1] !== letter && reference[position + 1] !== letter
      && reference[position - 1] !== (letter === 'و' ? 'ُ' : 'ِ');
  };
  const exact = step => step && Number.isInteger(step.heardIndex) && step.cost === 0
    && reference[step.ref] === step.heard;
  const changes = [];
  const add = (type, position, expected, detected, letter) => changes.push({
    type, position, expected, detected, letter,
    expectedPhoneme: letter + expected, detectedPhoneme: letter + detected,
  });

  for (const step of trace) {
    const expected = reference[step.ref];
    if (!shortVowel(expected)) continue;
    const range = rangeAt(step.ref);
    const previous = byPosition.get(step.ref - 1);
    // A neighboring mismatch or a merged boundary cannot identify the vowel
    // of this base consonant reliably enough to describe a specific error.
    if (!range || step.ref - 1 < range.start || !exact(previous)
      || !coreAt(previous.ref)) continue;
    const letter = reference[previous.ref];
    if (shortVowel(step.heard) && step.heard !== expected
      && previous.heardIndex === step.heardIndex - 1) {
      add('substitution', step.ref, expected, step.heard, letter);
    } else if (!step.heard) {
      // Absence of a word's final vowel can be valid stopping on sukoon.
      // Require a following consonant in THIS word, actually heard adjacent
      // to the preceding consonant, before describing an interior omission.
      const next = byPosition.get(step.ref + 1);
      if (step.ref + 1 < range.end && exact(next)
        && coreAt(next.ref)
        && next.heardIndex === previous.heardIndex + 1) {
        add('omission', step.ref, expected, '', letter);
      }
    }
  }

  for (const step of insertions) {
    if (!shortVowel(step.heard)) continue;
    const previous = byPosition.get(step.boundary - 1);
    const next = byPosition.get(step.boundary);
    const range = rangeAt(step.boundary - 1);
    // An added vowel needs two exact surrounding consonants. Ignore terminal
    // additions (connected/stopped reference ambiguity) and doubled sounds,
    // whose boundaries belong to the separate Shaddah/Ghunnah review.
    if (!range || step.boundary >= range.end || !exact(previous) || !exact(next)
      || !coreAt(previous.ref) || !coreAt(next.ref)
      || reference[previous.ref] === reference[next.ref]
      || previous.heardIndex !== step.heardIndex - 1
      || next.heardIndex !== step.heardIndex + 1) continue;
    add('addition', previous.ref, '', step.heard, reference[previous.ref]);
  }
  return changes.sort((a, b) => a.position - b.position);
}
