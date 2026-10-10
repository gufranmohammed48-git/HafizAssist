import { normalize } from './alignment.js';

// Anchor committed progress to this utterance's token times as well as text.
// Earlier CTC text can change without moving the sound already consumed.
function tokenSpans(data) {
  if (!Number.isInteger(data.timingSegment) || !Array.isArray(data.tokens)
    || !Array.isArray(data.timestamps) || data.tokens.length !== data.timestamps.length) return null;
  let offset = 0, previousTime = -1;
  const spans = [];
  for (let i = 0; i < data.tokens.length; i++) {
    if (typeof data.tokens[i] !== 'string') return null;
    const time = data.timestamps[i];
    if (!Number.isFinite(time) || time < previousTime || time < 0) return null;
    previousTime = time;
    const token = normalize(data.tokens[i]);
    const start = offset; offset += token.length;
    if (token) spans.push({ start, end: offset, time, token });
  }
  if (normalize(data.tokens.join('')) !== normalize(data.text)) return null;
  return spans;
}

export function captureRecognitionBoundary(data, combinedOffset, carry) {
  const offset = combinedOffset - normalize(carry).length;
  if (offset <= 0) return null;
  const spans = tokenSpans(data);
  const last = spans?.find(span => span.start < offset && span.end >= offset);
  return last ? { segment: data.timingSegment, time: last.time, token: last.token,
    offset: offset - last.start, complete: offset === last.end } : null;
}

export function locateRecognitionBoundary(anchor, data, carry) {
  if (!anchor || anchor.segment !== data.timingSegment) return null;
  const spans = tokenSpans(data);
  if (!spans?.length) return null;
  const carryLength = normalize(carry).length;
  if (anchor.complete) {
    // Never replay earlier verse audio when an old text prefix was revised.
    const next = spans.find(span => span.time > anchor.time + 1e-6);
    return carryLength + (next?.start ?? spans.at(-1).end);
  }
  // A boundary within a multi-character token needs the exact same token.
  const matches = spans.filter(span => Math.abs(span.time - anchor.time) < 1e-6 && span.token === anchor.token);
  return matches.length === 1 ? carryLength + matches[0].start + anchor.offset : null;
}
