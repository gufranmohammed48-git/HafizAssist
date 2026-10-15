// Correction retry state is separate from the permanent mistake history.
// Hold the first flagged word before later matches can change the page.
// Its mistake history survives both reference playback and a correct retry.
import { alignSegment } from './alignment.js';

const wordKey = word => word
  ? `${word.surah}:${word.ayah}:${word.position}:${Boolean(word.bismillah)}` : '';

export function preserveReview(state, detail, result) {
  return state === 'review'
    ? { state, detail: detail ?? result.detail }
    : { state: result.state, detail: result.detail };
}

export function createTeacherRetry(enabled = false) {
  let target = null;

  function updateFrontier(page, frontier) {
    if (!target || target.page !== page || !Number.isInteger(frontier)) return;
    target.frontier = Math.max(target.frontier, frontier);
  }

  function begin(words, word, page, frontier, { awaitingReference = false } = {}) {
    if (!enabled || !word || !Number.isInteger(page)) return false;
    const key = wordKey(word);
    const index = words.findIndex(candidate => wordKey(candidate) === key);
    if (index < 0) return false;
    if (target) {
      if (target.page !== page || target.key !== key) return false;
      updateFrontier(page, frontier);
      target.awaitingReference = awaitingReference;
      return true;
    }
    target = { page, key, index, awaitingReference, frontier: Math.max(index + 1,
      Number.isInteger(frontier) ? frontier : index + 1) };
    return true;
  }

  function align(words, heard, sensitivity = 'balanced', final = false,
    reviewVowels = false, options = {}) {
    if (!target || target.awaitingReference || wordKey(words[target.index]) !== target.key) return null;
    const index = target.index;
    // A one-word array leaves no later-word lookahead, recovery, or merge
    // candidate that could allow the retry to pass without this word.
    const match = alignSegment(words.slice(index, index + 1), 0, heard,
      sensitivity, final, reviewVowels, { ...options, recover: false });
    return { ...match, cursor: index + match.cursor,
      results: match.results.map(result => ({ ...result, index: index + result.index })),
      diagnostic: { ...match.diagnostic,
        blockedIndex: index + match.diagnostic.blockedIndex,
        attempts: match.diagnostic.attempts.map(attempt => ({ ...attempt,
          ...(Number.isInteger(attempt.index) ? { index: index + attempt.index } : {}) })),
        alignments: match.diagnostic.alignments.map(alignment => ({ ...alignment,
          index: index + alignment.index })),
      } };
  }

  function accept(result, page, frontier) {
    if (!target || target.page !== page) return { accepted: false, nextCursor: null, target: null };
    updateFrontier(page, frontier);
    const snapshot = { ...target };
    if (target.awaitingReference || result?.index !== target.index || result.state !== 'matched')
      return { accepted: false, nextCursor: target.index, target: snapshot };
    const nextCursor = Math.max(target.frontier, target.index + 1);
    target = null;
    return { accepted: true, nextCursor, target: snapshot };
  }

  function activate(page, word) {
    if (!target || target.page !== page || word && wordKey(word) !== target.key) return false;
    target.awaitingReference = false;
    return true;
  }

  return { begin, updateFrontier, align, accept, activate,
    clear() { target = null; },
    get pending() { return target ? { ...target } : null; } };
}
