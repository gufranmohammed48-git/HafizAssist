// Weighted semi-global alignment adapted from ReciteQuran's matching approach.
// See licenses/ReciteQuran.txt. Matching locates speech; it does not grade tajweed.
export function normalize(text) {
  // Preserve repeated phonemes on BOTH sides of word boundaries.
  return text.replace(/[\s\u200e\u200f\u0640\u0686\u06dc\u0619\u06ea]/gu, '')
    .replace(/[أإآٲ]/gu, 'ء').replace(/۾/gu, 'م').replace(/ں/gu, 'ن')
    .replace(/ۥ/gu, 'و').replace(/ۦ/gu, 'ي');
}
const vowel = c => 'اوي'.includes(c);
// Map a previously consumed boundary into the latest cumulative hypothesis.
// Never search the entire transcript for a repeated phrase: ambiguous or
// substantially revised anchors must fall back to normal guarded alignment.
export function locateTranscriptBoundary(anchor, heard) {
  if (!anchor || anchor.offset > anchor.heard.length) return null;
  const prefix = anchor.heard.slice(0, anchor.offset);
  if (heard.startsWith(prefix)) return anchor.offset;
  const tail = prefix.slice(-24);
  if (tail.length < 8) return null;
  const candidates = [];
  let position = heard.indexOf(tail, Math.max(0, anchor.offset - tail.length - 64));
  while (position !== -1 && position + tail.length <= anchor.offset + 64) {
    candidates.push(position + tail.length);
    position = heard.indexOf(tail, position + 1);
  }
  return candidates.length === 1 ? candidates[0] : null;
}
const shortVowel = c => 'َُِ'.includes(c);
const pairs = ['اَ', 'وُ', 'يِ', 'تط', 'جز', 'خغ', 'دض', 'ذز', 'ذظ', 'سص', 'قك'];
const presets = {
  balanced: { limit: .30, short: .25, medium: .28, confusion: .25, insertion: .75, deletion: 1, skip: 2 },
  gentle: { limit: .40, short: .30, medium: .35, confusion: .15, insertion: .5, deletion: .8, skip: 3 },
  strict: { limit: .25, short: .20, medium: .23, confusion: .35, insertion: 1, deletion: 1, skip: 1 },
};
function substitution(a, b, config) {
  if (a === b || (a === 'ة' && 'هت'.includes(b)) || (b === 'ة' && 'هت'.includes(a))) return 0;
  return pairs.some(pair => pair === a + b || pair === b + a) ? config.confusion : 1;
}
function deletion(text, index, config) {
  return text[index] === 'ء' || (index > 0 && text[index] === text[index - 1]) ? config.confusion : config.deletion;
}
function insertion(text, index, config) {
  return index > 0 && text[index] === text[index - 1] && vowel(text[index]) ? config.confusion : config.insertion;
}
function effectiveLength(text) {
  let count = 0;
  for (let i = 0; i < text.length; i++) if (!(i && text[i] === text[i - 1] && vowel(text[i]))) count++;
  return Math.max(1, count);
}
function matchWords(references, heard, config, final, diagnostic) {
  const reference = references.join('');
  const n = reference.length, m = heard.length;
  if (!n || !m) return null;
  const effective = effectiveLength(reference);
  const limit = effective <= 3 ? config.short : effective <= 7 ? config.medium : config.limit;
  if (diagnostic) Object.assign(diagnostic, { limit, bestScore: null, rejected: { score: 0, unfinishedTail: 0, insufficientSupport: 0 } });
  const stride = n + 1;
  const costs = new Float32Array((m + 1) * stride);
  const back = new Uint8Array(costs.length);
  // First column remains zero: skip leading noise/isti'adhah/repetitions freely.
  for (let j = 1; j <= n; j++) { costs[j] = costs[j - 1] + deletion(reference, j - 1, config); back[j] = 1; }
  for (let i = 1; i <= m; i++) {
    const row = i * stride, prev = row - stride;
    for (let j = 1; j <= n; j++) {
      const sub = costs[prev + j - 1] + substitution(heard[i - 1], reference[j - 1], config);
      const del = costs[row + j - 1] + deletion(reference, j - 1, config);
      const ins = costs[prev + j] + insertion(heard, i - 1, config);
      if (sub < del && sub <= ins) { costs[row + j] = sub; back[row + j] = 0; }
      else if (del <= ins) { costs[row + j] = del; back[row + j] = 1; }
      else { costs[row + j] = ins; back[row + j] = 2; }
    }
  }
  let best = null;
  for (let end = 1; end <= m; end++) {
    const score = costs[end * stride + n] / effective;
    if (diagnostic) {
      if (diagnostic.bestScore === null || score < diagnostic.bestScore) diagnostic.bestScore = score;
      if (score > limit) diagnostic.rejected.score++;
    }
    if (score > limit || (best && score >= best.score - 1e-6)) continue;
    let i = end, j = n, missingTail = false, reachedSound = false;
    const trace = [];
    while (j > 0) {
      const op = back[i * stride + j];
      if (op === 1 || i === 0) {
        const repeated = j > 1 && reference[j - 1] === reference[j - 2];
        if (!reachedSound && !repeated && !shortVowel(reference[j - 1])) missingTail = true;
        trace.push({ ref: j - 1, cost: deletion(reference, j - 1, config), supported: false }); j--;
      } else if (op === 0) {
        const cost = substitution(heard[i - 1], reference[j - 1], config);
        if (!reachedSound && cost > config.confusion && !shortVowel(reference[j - 1])) missingTail = true;
        trace.push({ ref: j - 1, cost, supported: cost <= config.confusion });
        reachedSound = true; i--; j--;
      } else { i--; }
    }
    // Wait for missing core sounds, not for every word at the live frontier.
    if (!final && missingTail && end >= m - 1) { if (diagnostic) diagnostic.rejected.unfinishedTail++; continue; }
    let boundary = 0, valid = true;
    for (const word of references) {
      const part = trace.filter(step => step.ref >= boundary && step.ref < boundary + word.length);
      if (part.filter(step => step.supported).length < Math.max(1, Math.ceil(effectiveLength(word) * .5))) valid = false;
      // A merge must have evidence for the core of BOTH words.
      if (references.length > 1) {
        const allowance = Math.min(2, Math.floor(word.length / 3));
        const core = part.filter(step => step.ref >= boundary + (boundary ? allowance : 0)
          && step.ref < boundary + word.length - (boundary + word.length < n ? allowance : 0));
        if (core.reduce((sum, step) => sum + step.cost, 0) / Math.max(1, core.length) > config.limit) valid = false;
      }
      boundary += word.length;
    }
    if (!valid) { if (diagnostic) diagnostic.rejected.insufficientSupport++; continue; }
    // Prefer the first supported occurrence, then refine its end/score only
    // within the same overlapping span. A later, cleaner repetition must not
    // steal audio from a subsequent verse (e.g. Rabbana in 2:128 and 2:129).
    // Keep the existing score, tail, and sound-support requirements above.
    if (best && i >= best.consumed) {
      if (diagnostic) diagnostic.laterOccurrenceIgnored = { start: i, end, score };
      break;
    }
    best = { score, consumed: end, start: i, merged: references.length };
    if (score === 0) break; // Earliest exact occurrence wins over repetitions.
  }
  return best;
}
export function alignSegment(words, start, transcript, sensitivity, final = false) {
  const config = presets[sensitivity] || presets.balanced;
  const heard = normalize(transcript);
  let offset = 0, cursor = start;
  const results = [];
  const alignments = [];
  let attempts = [];
  const probe = (references, remaining, kind, index) => {
    const diagnostic = { kind, index, references };
    const candidate = matchWords(references, remaining, config, final, diagnostic);
    diagnostic.accepted = candidate;
    attempts.push(diagnostic);
    return candidate;
  };
  while (cursor < words.length && offset < heard.length) {
    attempts = [];
    const remaining = heard.slice(offset);
    let match = null, skipped = 0;
    for (let merge = 1; merge <= 2 && cursor + merge <= words.length; merge++) {
      match = probe(words.slice(cursor, cursor + merge).map(w => w.phoneme), remaining, 'current-or-merge', cursor);
      if (match) break;
    }
    if (!match) {
      for (let ahead = 1; ahead <= config.skip && cursor + ahead < words.length; ahead++) {
        const target = words[cursor + ahead].phoneme;
        const candidate = probe([target], remaining, 'lookahead', cursor + ahead);
        if (!candidate) continue;
        // Recover only from a strong long word or two neighboring matches.
        let supported = effectiveLength(target) >= 5 && candidate.score <= .15;
        const next = words[cursor + ahead + 1];
        if (!supported && next) {
          const following = probe([next.phoneme], remaining.slice(candidate.consumed), 'lookahead-support', cursor + ahead + 1);
          supported = following && following.start <= 3 && following.score <= .2;
        }
        if (supported) { match = candidate; skipped = ahead; break; }
      }
    }
    if (!match) break;
    alignments.push({ index: cursor + skipped, skipped, merged: match.merged,
      heardStart: offset + match.start, heardEnd: offset + match.consumed,
      score: match.score, heardText: heard.slice(offset + match.start, offset + match.consumed) });
    for (let k = 0; k < skipped; k++) results.push({ index: cursor++, state: 'review' });
    for (let k = 0; k < match.merged; k++) results.push({ index: cursor++, state: 'matched' });
    offset += match.consumed;
    // Absorb a continuing final sound unless the next word needs that sound
    // at its start. Otherwise madd/shaddah tails can masquerade as short words.
    const ending = heard[offset - 1];
    if (words[cursor]?.phoneme[0] !== ending) {
      while (offset < heard.length && heard[offset] === ending) offset++;
    }
  }
  return { results, cursor, consumed: offset, heard, diagnostic: {
    reason: cursor >= words.length ? 'page-complete' : offset >= heard.length ? 'waiting-for-more-phonemes' : 'no-supported-match',
    blockedIndex: cursor, remaining: heard.slice(offset).slice(-2000), attempts,
    alignments: alignments.slice(-80),
  } };
}
