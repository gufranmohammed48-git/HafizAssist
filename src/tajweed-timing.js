// Experimental browser adaptation of ReciteQuran's duration profiles and
// peak-to-peak token heuristic at 6c701a69b2600f0bb88ad8eab1d708156a6388ab.
// See licenses/ReciteQuran.txt. A CTC emission is not an acoustic boundary:
// these estimates are review prompts, never confirmed pronunciation grades.
import { normalize } from './alignment.js';

export const TAJWEED_SPEEDS = Object.freeze({
  fast: Object.freeze({ label: 'Fast · Hadr', harakahMs: 120 }),
  normal: Object.freeze({ label: 'Normal · Tadweer', harakahMs: 150 }),
  slow: Object.freeze({ label: 'Slow · Tahqiq', harakahMs: 180 }),
});

// [minimum, target, maximum] milliseconds, copied from the upstream matrix.
const profiles = {
  1: { fast: [75, 240, 600], normal: [150, 300, 700], slow: [180, 360, 850] },
  2: { fast: [75, 240, 800], normal: [450, 600, 1400], slow: [650, 900, 1800] },
  3: { fast: [350, 480, 1200], normal: [450, 600, 1500], slow: [650, 900, 1800] },
  4: { fast: [350, 480, 1800], normal: [450, 600, 2000], slow: [800, 1080, 2500] },
  5: { fast: [120, 240, 1800], normal: [300, 600, 2200], slow: [500, 1080, 2500] },
  6: { fast: [540, 720, 4000], normal: [680, 900, 4000], slow: [850, 1080, 4500] },
  7: { fast: [120, 240, 1800], normal: [300, 600, 2200], slow: [500, 1080, 2500] },
  9: { fast: [190, 240, 650], normal: [200, 250, 850], slow: [240, 300, 1000] },
  10: { fast: [180, 240, 850], normal: [225, 300, 1250], slow: [270, 360, 1600] },
};
const shortVowel = character => 'َُِ'.includes(character);
const consonant = character => /^[\u0621-\u063a\u0641-\u064a]$/u.test(character) && character !== 'ا';
const specialTokens = new Set(['', '<blank>', '<blk>', '<eps>', 'eps']);
const evidence = 'ctc-emission-estimate';

function phoneticGroups(text) {
  const groups = [];
  for (let start = 0; start < text.length;) {
    const base = text[start];
    let runEnd = start + 1;
    while (runEnd < text.length && text[runEnd] === base) runEnd++;
    let end = runEnd;
    while (end < text.length && shortVowel(text[end])) end++;
    groups.push({ start, end, runEnd, base, count: runEnd - start, marks: text.slice(runEnd, end) });
    start = end;
  }
  return groups;
}

// Timing may tolerate different decoded repetition counts, but must not borrow
// an interval from a word with a changed letter, vowel, or missing syllable.
export function matchesTimedWord(word, fragment) {
  const reference = phoneticGroups(normalize(word?.phoneme || ''));
  const observed = phoneticGroups(normalize(fragment || ''));
  return reference.length > 0 && reference.length === observed.length
    && reference.every((group, index) => group.base === observed[index].base
      && group.marks === observed[index].marks);
}

function writtenShaddahLetters(text) {
  const letters = new Set();
  let lastLetter = '';
  for (const character of text || '') {
    if (/^[\u0621-\u063a\u0641-\u064a]$/u.test(character)) lastLetter = character;
    else if (character === 'ّ' && lastLetter) letters.add(lastLetter);
  }
  return letters;
}

// Arabic annotation positions cannot be used as phoneme offsets. Match ordered
// Madd runs only when their number and reference lengths agree; never borrow
// another Madd location's rule in a word with two different elongations.
export function timingRules(word) {
  const phoneme = normalize(word?.phoneme || '');
  const groups = phoneticGroups(phoneme);
  const maddRules = (word?.rules || []).filter(rule => rule.id >= 1 && rule.id <= 7);
  const maddGroups = groups.filter(group => {
    if (group.count < 2 || group.marks || !'اوي'.includes(group.base)) return false;
    const preceding = phoneme[group.start - 1];
    return preceding === ({ ا: 'َ', و: 'ُ', ي: 'ِ' })[group.base]
      || (preceding === 'َ' && 'وي'.includes(group.base) && maddRules.some(rule => rule.id === 7));
  });
  const mappedMadd = maddGroups.length === maddRules.length
    && maddGroups.every((group, index) => Number(maddRules[index].beats) === group.count);
  const candidates = maddRules.map((rule, index) => ({
    kind: 'madd', ruleId: rule.id, name: rule.en, arabic: rule.ar,
    referenceCounts: rule.beats, span: mappedMadd ? maddGroups[index] : null,
    reason: mappedMadd ? '' : 'The Madd annotations cannot be assigned to unique phoneme spans.',
  }));
  const written = writtenShaddahLetters(word?.accessible || word?.text || '');
  const reference = word?.reference?.rules || [];
  for (const group of groups) {
    if (group.count < 2 || !consonant(group.base)) continue;
    const confirmed = written.has(group.base) || reference.some(rule =>
      rule.letter === group.base && (rule.name === 'LAM_SHAMSIYAH'
        || rule.name === 'NOON_GHUNNAH' || rule.name === 'MEEM_GHUNNAH'));
    // Normalization merges ikhfa nasal markers with n/m. Written shaddah (or
    // the explicit reference rule) is essential to avoid calling ikhfa shaddah.
    if (!confirmed) continue;
    if ('نم'.includes(group.base)) {
      candidates.push({ kind: 'ghunnah', ruleId: 10,
        name: group.base === 'ن' ? 'Mushaddad Noon · Ghunnah' : 'Mushaddad Meem · Ghunnah',
        arabic: group.base === 'ن' ? 'غنة النون المشددة' : 'غنة الميم المشددة',
        referenceCounts: 2, span: group, reason: '' });
    } else if (group.count === 2 && (!'وي'.includes(group.base) || group.marks)) {
      candidates.push({ kind: 'shaddah', ruleId: 9, name: 'Shaddah', arabic: 'الشدة',
        referenceCounts: 1.5, span: group, reason: '' });
    }
  }
  return candidates.sort((a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity));
}

function profileCounts(ruleId, speed) {
  if (ruleId === 1 || ruleId === 10) return 2;
  if (ruleId === 6) return 6;
  if (ruleId === 9) return 1.5;
  if (ruleId === 2) return { fast: 2, normal: 4, slow: 5 }[speed];
  if (ruleId === 3) return speed === 'slow' ? 5 : 4;
  if (ruleId === 4) return speed === 'slow' ? 6 : 4;
  return { fast: 2, normal: 4, slow: 6 }[speed];
}

function readTokens(tokens, timestamps, heard) {
  if (!Array.isArray(tokens) || !Array.isArray(timestamps) || !tokens.length
    || tokens.length !== timestamps.length) return { reason: 'Usable token timings are unavailable.' };
  if (!tokens.every(token => typeof token === 'string') || !timestamps.every((time, index) =>
    Number.isFinite(time) && time >= 0 && (!index || time >= timestamps[index - 1]))) {
    return { reason: 'Token timestamps are invalid or out of order.' };
  }
  const spans = [];
  let offset = 0;
  for (let index = 0; index < tokens.length; index++) {
    if (specialTokens.has(tokens[index])) continue;
    const text = normalize(tokens[index]);
    if (!text) continue;
    const start = offset; offset += text.length;
    spans.push({ text, start, end: offset, time: timestamps[index] });
  }
  if (spans.map(span => span.text).join('') !== heard) {
    return { reason: 'Decoded tokens do not match this recognition result.' };
  }
  return { spans, reason: '' };
}

/**
 * Review one unmerged, supported word alignment. start/end are offsets in the
 * normalized full ASR transcript, never carried text from a previous segment.
 * The caller must confirm the word alignment and segment protocol beforehand.
 * pauseConfirmed means an endpoint occurred immediately after THIS word; a
 * dataset's ayah-ending annotation alone is not evidence that the user stopped.
 */
export function evaluateTiming({ word, heard = '', start, end, tokens, timestamps,
  speed = 'normal', final = false, trailingContext = '', pauseConfirmed = false } = {}) {
  if (!Object.hasOwn(TAJWEED_SPEEDS, speed)) speed = 'normal';
  heard = normalize(heard);
  const rules = timingRules(word);
  const parsed = readTokens(tokens, timestamps, heard);
  let sharedReason = parsed.reason;
  const reference = phoneticGroups(normalize(word?.phoneme || ''));
  const rangeValid = Number.isInteger(start) && Number.isInteger(end)
    && start >= 0 && end > start && end <= heard.length;
  const observed = rangeValid ? phoneticGroups(heard.slice(start, end)) : [];
  // Changes in repetition length are permitted; changed/missing vowels and
  // word skeletons cannot provide independent evidence of a timing mistake.
  const shapeMatches = rangeValid && matchesTimedWord(word, heard.slice(start, end));
  if (!rangeValid) sharedReason = 'This word has no usable transcript interval.';
  else if (!shapeMatches) sharedReason = 'Recognition cannot isolate the expected phoneme span reliably.';
  const assessments = rules.map(rule => {
    const [minMs, targetMs, maxMs] = profiles[rule.ruleId][speed];
    const result = { kind: rule.kind, ruleId: rule.ruleId, name: rule.name, arabic: rule.arabic,
      referenceCounts: rule.referenceCounts, expectedCounts: profileCounts(rule.ruleId, speed),
      allowedCounts: rule.ruleId === 5 || rule.ruleId === 7 ? [2, 4, 6] : null,
      speed, minMs, targetMs, maxMs, estimatedMs: null, estimatedCounts: null,
      status: 'unavailable', reason: sharedReason || rule.reason, span: null, evidence };
    if (result.reason) return result;
    if ([4, 5, 7].includes(rule.ruleId) && !(pauseConfirmed && final && end === heard.length)) {
      result.reason = 'This pause-dependent Madd needs a confirmed stop at this word.';
      return result;
    }
    const groupIndex = reference.findIndex(group => group.start === rule.span.start);
    const observedGroup = observed[groupIndex];
    // Ghunnah/shaddah refer to the held consonant, not its following vowel.
    // A combined syllable token cannot be divided into invented durations.
    const a = start + observedGroup.start;
    const b = start + (rule.kind === 'madd' ? observedGroup.end : observedGroup.runEnd);
    result.span = { start: a, end: b, phoneme: heard.slice(a, b) };
    const first = parsed.spans.findIndex(token => token.start === a);
    const last = parsed.spans.findIndex(token => token.end === b);
    if (first < 0 || last < first) {
      result.reason = rule.kind !== 'madd' && observedGroup.marks
        ? 'A token combines the held consonant and its vowel; separate timings are unavailable.'
        : 'A multi-character token crosses this phoneme boundary; timing was not divided.';
      return result;
    }
    if (first === 0) {
      result.reason = 'The first token has no preceding emission; its onset was not invented.';
      return result;
    }
    // Wait for later articulation instead of using an endpoint's trailing
    // silence as an invented end for a terminal held vowel or consonant.
    if (b === heard.length && !normalize(trailingContext)) {
      result.reason = 'No following sound confirms the end of this held phoneme.';
      return result;
    }
    let previous = parsed.spans[first - 1].time;
    for (let index = first; index <= last; index++) {
      const gap = parsed.spans[index].time - previous;
      if (gap <= 0 || gap > 3.5) {
        result.reason = gap <= 0 ? 'Distinct emission boundaries are unavailable.'
          : 'A long gap could include silence; no duration grade was assigned.';
        return result;
      }
      previous = parsed.spans[index].time;
    }
    // Use whole-token previous-peak -> current-peak intervals, as upstream
    // does, without its guessed first-token onset, pause resets, or clamps.
    const duration = (parsed.spans[last].time - parsed.spans[first - 1].time) * 1000;
    result.estimatedMs = Math.round(duration);
    result.estimatedCounts = Math.round(duration / TAJWEED_SPEEDS[speed].harakahMs * 10) / 10;
    result.status = duration < minMs ? 'underheld' : duration > maxMs ? 'overheld' : 'within-range';
    result.reason = 'Estimated from CTC emissions; the sound’s acoustic boundaries are not measured.';
    return result;
  });
  const available = assessments.filter(assessment => assessment.status !== 'unavailable');
  return { assessments, evidence, speed, availability: available.length
    ? 'Experimental timing estimates are available.'
    : sharedReason || assessments[0]?.reason || 'No supported Madd, mushaddad ghunnah, or shaddah span is annotated.' };
}
