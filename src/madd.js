import { normalize, locateTranscriptBoundary } from './alignment.js';

// CTC emission times are NOT phoneme boundaries. Collect inspectable timing
// evidence without labelling it vowel duration, harakat, or a recitation error.
export function createMaddMonitor(enabled) {
  const candidates = new Map(), results = new Map();
  let segmentKey = '', currentPage = null;
  let availability = 'Start reciting to collect madd timing evidence.';
  let lastTimingDiagnostic = null;
  const reports = [];
  function paintStatus() {
    const label = document.getElementById('madd-status');
    if (label) label.textContent = availability;
  }
  function clear() {
    candidates.clear(); results.clear(); reports.length = 0;
    segmentKey = ''; currentPage = null;
    lastTimingDiagnostic = null;
    availability = 'Start reciting to collect madd timing evidence.'; paintStatus();
  }
  function observe(data, words, alignments, inputOffset, carry, page) {
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
      if (span.merged !== 1 || span.score !== 0 || !word?.rules?.some(rule => rule.id >= 1 && rule.id <= 7)) continue;
      const start = inputOffset + span.heardStart - carryLength;
      const end = inputOffset + span.heardEnd - carryLength;
      // Never assign old carried text to timestamps from a new audio segment.
      if (start < 0 || end > heard.length || heard.slice(start, end) !== word.phoneme) continue;
      candidates.set(span.index, { word, heard, start, end });
    }
    let offset = 0;
    const tokenSpans = valid ? tokens.map((token, i) => {
      const start = offset; offset += normalize(token).length;
      return { start, end: offset, time: times[i] };
    }).filter(token => token.end > token.start) : [];
    for (const [index, candidate] of candidates) {
      const start = candidate.start === 0 ? 0 : locateTranscriptBoundary({ heard: candidate.heard, offset: candidate.start }, heard);
      const end = locateTranscriptBoundary({ heard: candidate.heard, offset: candidate.end }, heard);
      const measurements = [];
      let note = valid ? 'No isolated vowel-token span is available.' : failure;
      if (start === null || end === null || heard.slice(start, end) !== candidate.word.phoneme) {
        note = 'Recognition changed; this timing cannot be assigned reliably.';
      } else if (valid) {
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
      const result = { page, index, word: candidate.word.accessible, surah: candidate.word.surah, ayah: candidate.word.ayah,
        referenceRules: candidate.word.rules.filter(rule => rule.id >= 1 && rule.id <= 7), measurements, note,
        final: Boolean(data.final), segment: key };
      results.set(index, result);
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
  return { observe, clear, get: index => enabled ? results.get(index) : null };
}
