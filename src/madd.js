import { normalize, locateTranscriptBoundary } from './alignment.js';
import { evaluateTiming, matchesTimedWord, timingRules } from './tajweed-timing.js';

// CTC emission times are NOT phoneme boundaries. Collect inspectable timing
// evidence without labelling it vowel duration, harakat, or a recitation error.
export function createMaddMonitor(enabled, { reviewEnabled = false, getSpeed = () => 'normal', onDiagnostic = null } = {}) {
  const candidates = new Map(), results = new Map();
  let segmentKey = '', currentPage = null;
  let availability = 'Start reciting to collect madd timing evidence.';
  let lastTimingDiagnostic = null;
  const reports = [];
  let diagnosticAttempt = 1, observationId = 0, lastLoggedRecognition = '';
  const loggedReviews = new Map();
  function diagnose(event, fingerprint = null) {
    if (!reviewEnabled || !onDiagnostic) return;
    if (fingerprint) {
      const key = `${event.kind}:${event.page}:${event.index}:${event.ruleId ?? ''}:${event.ruleOccurrence ?? ''}`;
      if (loggedReviews.get(key) === fingerprint) return;
      loggedReviews.set(key, fingerprint);
      if (loggedReviews.size > 256) loggedReviews.delete(loggedReviews.keys().next().value);
    }
    // Diagnostics must never interrupt recognition or the reading pointer.
    try { onDiagnostic({ attempt: diagnosticAttempt, observationId, ...event }); }
    catch (error) { console.warn('Tajweed diagnostic record unavailable:', error); }
  }
  function paintStatus() {
    const label = document.getElementById('madd-status');
    if (label) label.textContent = availability;
  }
  function clear() {
    candidates.clear(); results.clear(); reports.length = 0;
    segmentKey = ''; currentPage = null;
    lastTimingDiagnostic = null;
    diagnosticAttempt++; lastLoggedRecognition = ''; loggedReviews.clear();
    diagnose({ kind: 'reset', reason: 'Practice reset or passage changed. Earlier diagnostic records are retained.' });
    availability = 'Start reciting to collect madd timing evidence.'; paintStatus();
  }
  function observe(data, words, alignments, inputOffset, carry, page, alignmentDiagnostic = null) {
    if (!enabled) return;
    const key = `${data.sessionId}:${Number.isInteger(data.timingSegment) ? data.timingSegment : 'missing'}`;
    const tokens = data.tokens, times = data.timestamps;
    let failure = '';
    if (data.timingProtocol !== 1) failure = 'Worker timing protocol missing. Close all app tabs and reopen to load the updated worker.';
    else if (data.timingEnabled !== true) failure = 'The recognition worker did not enable madd timing for this session.';
    else if (!Number.isInteger(data.timingSegment)) failure = 'The worker did not supply a timing segment ID.';
    else if (!Array.isArray(tokens) || !Array.isArray(times)) failure = 'The worker did not supply token/timestamp arrays.';
    else if (!tokens.length || !times.length) failure = 'The recognizer returned no tokens or timestamps for this result.';
    else if (tokens.length !== times.length) failure = 'Token and timestamp counts differ.';
    else if (!tokens.every(token => typeof token === 'string')) failure = 'The recognizer returned unsupported token values.';
    else if (!times.every((time, i) => Number.isFinite(time) && time >= 0 && (!i || time >= times[i - 1]))) failure = 'Timestamps are invalid or out of order.';
    else if (normalize(tokens.join('')) !== normalize(data.text)) failure = 'Decoded tokens do not match the recognized text.';
    const valid = !failure;
    lastTimingDiagnostic = { protocol: data.timingProtocol ?? null, enabled: data.timingEnabled ?? null,
      segment: data.timingSegment ?? null, resultFields: data.resultFields ?? [], reason: failure || 'usable',
      transcript: data.text.slice(0, 12000), tokens: Array.isArray(tokens) ? tokens.slice(0, 4000) : null,
      timestamps: Array.isArray(times) ? times.slice(0, 4000) : null };
    if (reviewEnabled) {
      const fingerprint = JSON.stringify([key, data.final, lastTimingDiagnostic]);
      if (fingerprint !== lastLoggedRecognition) {
        lastLoggedRecognition = fingerprint; observationId++;
        diagnose({ kind: 'recognition', page, sessionId: data.sessionId, segment: key, final: Boolean(data.final),
          speed: getSpeed(), protocol: lastTimingDiagnostic.protocol, enabled: lastTimingDiagnostic.enabled,
          status: valid ? 'usable' : 'unavailable', reason: lastTimingDiagnostic.reason,
          text: lastTimingDiagnostic.transcript, normalizedText: normalize(data.text).slice(0, 12000),
          tokens: lastTimingDiagnostic.tokens, timestamps: lastTimingDiagnostic.timestamps,
          tokenCount: Array.isArray(tokens) ? tokens.length : null, timingUnit: 'seconds',
          truncated: { text: data.text.length > 12000, tokens: Array.isArray(tokens) && tokens.length > 4000 },
          inputOffset, carryLength: normalize(carry).length, alignments: alignments.slice(-80),
          alignmentReason: alignmentDiagnostic?.reason, blockedIndex: alignmentDiagnostic?.blockedIndex });
      }
      const blockedIndex = alignmentDiagnostic?.blockedIndex;
      const blockedWord = words[blockedIndex];
      if (valid && alignmentDiagnostic?.reason === 'no-supported-match' && blockedWord && timingRules(blockedWord).length) {
        diagnose({ kind: 'matching-excluded', page, index: blockedIndex, word: blockedWord.accessible,
          surah: blockedWord.surah, ayah: blockedWord.ayah, segment: key, status: 'unavailable',
          reason: 'This word has not matched confidently; no timing was assigned.', expectedPhoneme: blockedWord.phoneme,
          remainingPhonemes: alignmentDiagnostic.remaining, matchingAttempts: alignmentDiagnostic.attempts.slice(-4) },
          JSON.stringify([key, alignmentDiagnostic.remaining]));
      }
    }
    availability = valid ? 'Timing evidence available. Hover a madd word after reading it. No automatic madd grade yet.' : failure;
    paintStatus();
    // Do not combine utterances if the worker cannot identify their boundaries.
    if (data.timingProtocol !== 1 || data.timingEnabled !== true || !Number.isInteger(data.timingSegment)) {
      candidates.clear(); results.clear(); return;
    }
    if (currentPage !== page) { candidates.clear(); results.clear(); currentPage = page; }
    if (segmentKey !== key) { candidates.clear(); segmentKey = key; }
    const heard = normalize(data.text);
    const carryLength = normalize(carry).length;
    for (const span of alignments) {
      const word = words[span.index];
      if (reviewEnabled && span.merged !== 1) {
        for (let index = span.index; index < span.index + span.merged; index++) {
          const mergedWord = words[index];
          if (!mergedWord || !timingRules(mergedWord).length) continue;
          const reason = 'Recognition matched a group of words; a separate word interval could not be isolated.';
          diagnose({ kind: 'matching-excluded', page, index, word: mergedWord.accessible,
            surah: mergedWord.surah, ayah: mergedWord.ayah, segment: key, status: 'unavailable',
            reason, merged: span.merged, score: span.score }, JSON.stringify([key, reason]));
        }
        continue;
      }
      const relevant = reviewEnabled ? word && timingRules(word).length : word?.rules?.some(rule => rule.id >= 1 && rule.id <= 7);
      if (span.merged !== 1 || (!reviewEnabled && span.score !== 0) || !relevant) continue;
      const start = inputOffset + span.heardStart - carryLength;
      const end = inputOffset + span.heardEnd - carryLength;
      const fragment = heard.slice(start, end);
      // Never assign old carried text to timestamps from a new audio segment.
      // The preview permits changed repetition counts, but still requires the
      // same base sounds and short vowels before attributing timing to a word.
      if (start < 0 || end > heard.length || !(reviewEnabled
        ? matchesTimedWord(word, fragment) : fragment === word.phoneme)) {
        diagnose({ kind: 'matching-excluded', page, index: span.index, word: word.accessible,
          surah: word.surah, ayah: word.ayah, segment: key, status: 'unavailable',
          reason: start < 0 || end > heard.length ? 'The word interval includes carried text outside this audio segment.' :
            'The recognized letters or short vowels do not match closely enough to assign duration.',
          expectedPhoneme: word.phoneme, recognizedPhoneme: fragment, score: span.score,
          wordInterval: { start, end } }, JSON.stringify([key, start, end, fragment]));
        continue;
      }
      candidates.set(span.index, { word, heard, start, end, fragment });
    }
    let offset = 0;
    const tokenSpans = valid ? tokens.map((token, i) => {
      const start = offset; offset += normalize(token).length;
      return { token, index: i, start, end: offset, time: times[i] };
    }).filter(token => token.end > token.start) : [];
    for (const [index, candidate] of candidates) {
      const start = candidate.start === 0 ? 0 : locateTranscriptBoundary({ heard: candidate.heard, offset: candidate.start }, heard);
      const end = locateTranscriptBoundary({ heard: candidate.heard, offset: candidate.end }, heard);
      const measurements = [];
      let note = valid ? 'No isolated vowel-token span is available.' : failure;
      const unchanged = start !== null && end !== null && heard.slice(start, end) === candidate.fragment;
      if (!unchanged) {
        note = 'Recognition changed; this timing cannot be assigned reliably.';
      } else if (valid && candidate.fragment === candidate.word.phoneme) {
        for (const run of candidate.word.phoneme.matchAll(/([اوي])\1+/gu)) {
          const a = start + run.index, b = a + run[0].length;
          const first = tokenSpans.find(token => token.start === a);
          const following = tokenSpans.find(token => token.start === b);
          // No interpolation within a multi-character token and no invented
          // endpoint for a final vowel. Silence must not become madd duration.
          if (!first || !following || following.time <= first.time) continue;
          measurements.push({ vowel: run[1], emissionIntervalMs: Math.round((following.time - first.time) * 1000) });
        }
        if (measurements.length) note = 'Intervals between decoded tokens, not measured vowel duration or a harakat score.';
      }
      const timingReview = reviewEnabled && valid && unchanged ? evaluateTiming({
          word: candidate.word, heard, start, end, tokens, timestamps: times, speed: getSpeed(),
          final: Boolean(data.final), trailingContext: heard.slice(end),
          pauseConfirmed: Boolean(data.final && end === heard.length),
        }) : null;
      const result = { page, index, word: candidate.word.accessible, surah: candidate.word.surah, ayah: candidate.word.ayah,
        referenceRules: candidate.word.rules.filter(rule => rule.id >= 1 && rule.id <= 7), measurements, note,
        final: Boolean(data.final), segment: key,
        ...(reviewEnabled ? { timingReview, speed: getSpeed() } : {}) };
      results.set(index, result);
      if (reviewEnabled) {
        if (!timingReview?.assessments?.length) {
          diagnose({ kind: 'matching-excluded', page, index, word: candidate.word.accessible,
            surah: candidate.word.surah, ayah: candidate.word.ayah, segment: key,
            status: 'unavailable', reason: note, expectedPhoneme: candidate.word.phoneme,
            recognizedPhoneme: unchanged ? heard.slice(start, end) : null }, JSON.stringify([key, note]));
        }
        for (const [ruleOccurrence, assessment] of (timingReview?.assessments || []).entries()) {
          const tokenStart = assessment.span?.start ?? start;
          const tokenEnd = assessment.span?.end ?? end;
          const tokenEvidence = tokenStart !== null && tokenEnd !== null ? tokenSpans.filter(token =>
            token.end >= tokenStart - 2 && token.start <= tokenEnd + 2).slice(0, 200) : [];
          diagnose({ kind: 'assessment', page, index, word: candidate.word.accessible,
            surah: candidate.word.surah, ayah: candidate.word.ayah, segment: key, final: Boolean(data.final),
            speed: assessment.speed, rule: assessment.name, ruleId: assessment.ruleId, ruleKind: assessment.kind,
            ruleOccurrence, referenceCounts: assessment.referenceCounts, allowedCounts: assessment.allowedCounts,
            estimatedMs: assessment.estimatedMs, minMs: assessment.minMs, targetMs: assessment.targetMs,
            maxMs: assessment.maxMs, status: assessment.status, reason: assessment.reason,
            evidence: assessment.evidence, expectedPhoneme: candidate.word.phoneme,
            recognizedPhoneme: heard.slice(start, end), wordInterval: { start, end },
            soundInterval: assessment.span, tokenEvidence }, JSON.stringify([key, data.final, assessment]));
        }
      }
      if (data.final) {
        reports.push({ ...result, phoneme: candidate.word.phoneme, transcript: heard.slice(0, 12000),
          timingDiagnostic: lastTimingDiagnostic });
        if (reports.length > 30) reports.shift();
      }
    }
    if (data.final) candidates.clear();
  }
  if (enabled) document.getElementById('madd-copy')?.addEventListener('click', async () => {
    const output = document.getElementById('madd-report');
    const report = JSON.stringify({ schema: 2, kind: 'madd-timing-evidence-not-grading',
      version: document.querySelector('.app-version').textContent, capturedAt: new Date().toISOString(),
      availability, timingDiagnostic: lastTimingDiagnostic, completed: reports, latest: [...results.values()] }, null, 2);
    try { await navigator.clipboard.writeText(report); output.hidden = true; }
    catch { output.value = report; output.hidden = false; output.focus(); output.select(); }
    const message = document.getElementById('madd-copy-status');
    message.textContent = output.hidden ? 'Madd report copied.' : 'Select and copy the report below.';
  });
  return { observe, clear, get: index => {
    if (!enabled) return null;
    const result = results.get(index);
    if (result || !reviewEnabled) return result;
    const failure = lastTimingDiagnostic?.reason;
    return { timingReview: null, speed: getSpeed(), timingUnavailable: failure && failure !== 'usable'
      ? failure : 'No isolated recognition timing is available for this word.' };
  } };
}
