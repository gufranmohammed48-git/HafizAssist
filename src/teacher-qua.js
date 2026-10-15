// QUA is a separate timing trial. Its timestamps must remain paired with the
// exact recording supplied by the pinned import, never an EveryAyah filename.
const RELEASE = 'v3.2.0';
const REVISION = 2; // Speech cuts use clean owned-letter spans, not highlight durations.
const CACHE = `recitealquran-teacher-qua-timings-${RELEASE}-r${REVISION}`;
const CATALOG_URL = new URL(`../data/teacher-qua/catalog.json?release=${RELEASE}&revision=${REVISION}`, import.meta.url).href;
const DATA_ROOT = new URL('../data/teacher-qua/', import.meta.url).href;
const loaded = new Map(), requests = new Map();
const abortError = () => new DOMException('Teacher timing request cancelled.', 'AbortError');
function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason || abortError();
}
function validCatalog(data) {
  return data?.schema === 1 && data.provider === 'QUA' && data.release === RELEASE && data.revision === REVISION &&
    data.voices && typeof data.voices === 'object' && !Array.isArray(data.voices);
}
function validShard(data, voice) {
  return data?.schema === 1 && data.provider === 'QUA' && data.release === RELEASE && data.revision === REVISION &&
    data.voice === voice && data.verses && typeof data.verses === 'object' && !Array.isArray(data.verses);
}
async function download(url, valid, signal) {
  checkAbort(signal);
  let cache;
  try { cache = await caches.open(CACHE); } catch {}
  checkAbort(signal);
  try {
    const response = await cache?.match(url);
    if (response) {
      const data = await response.json();
      checkAbort(signal);
      if (valid(data)) return data;
      await cache.delete(url);
    }
  } catch { checkAbort(signal); }
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason || abortError());
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    checkAbort(signal);
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) return null;
    const saved = response.clone(), data = await response.json();
    checkAbort(signal);
    if (!valid(data)) return null;
    try { await cache?.put(url, saved); } catch {}
    checkAbort(signal);
    return data;
  } catch { checkAbort(signal); return null; }
  finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}
function shared(key, url, valid, signal) {
  checkAbort(signal);
  if (loaded.has(key)) return Promise.resolve(loaded.get(key));
  let entry = requests.get(key);
  if (!entry || entry.controller.signal.aborted) {
    entry = { controller: new AbortController(), users: 0, settled: false };
    requests.set(key, entry);
    entry.promise = download(url, valid, entry.controller.signal).then(data => {
      if (data) loaded.set(key, data);
      return data;
    }).finally(() => {
      entry.settled = true;
      if (requests.get(key) === entry) requests.delete(key);
    });
  }
  entry.users++;
  // Warming and playback share each small surah download. Cancelling one
  // caller must not abandon the metadata needed by another active caller.
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', onAbort); entry.users--;
      if (!entry.users && !entry.settled) entry.controller.abort(abortError());
      callback(value);
    };
    const onAbort = () => finish(reject, signal.reason || abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    entry.promise.then(data => finish(resolve, data), error => finish(reject, error));
  });
}
async function timings(voice, surah, signal) {
  const catalog = await shared('catalog', CATALOG_URL, validCatalog, signal);
  checkAbort(signal);
  const selected = catalog?.voices?.[voice];
  if (!selected || typeof selected.timingPath !== 'string' ||
      typeof selected.slug !== 'string' || !/^[a-z0-9_-]+$/.test(selected.slug)) return null;
  const path = selected.timingPath.replaceAll('{slug}', selected.slug).replaceAll('{surah}', String(surah));
  let url;
  try { url = new URL(path, DATA_ROOT); } catch { return null; }
  // Timing imports are local offline assets; a malformed catalog cannot
  // redirect metadata requests to another origin or another app directory.
  if (!url.href.startsWith(DATA_ROOT) || url.hash || !url.pathname.endsWith('.json')) return null;
  url.searchParams.set('release', RELEASE);
  url.searchParams.set('revision', String(REVISION));
  const data = await shared(`${voice}:${surah}`, url.href, value => validShard(value, voice), signal);
  checkAbort(signal);
  return data ? { data, source: selected.source, sourceFile: path } : null;
}
const wordPosition = reference => reference?.quaPosition ?? reference?.timingPosition ?? reference?.position;
const wordCount = reference => reference?.quaWordCount ?? reference?.timingWordCount;
function wordTiming(data, reference) {
  const verse = data?.verses?.[`${reference.surah}:${reference.ayah}`];
  const position = wordPosition(reference), count = wordCount(reference);
  if (!Number.isInteger(count) || count < 1 ||
      verse?.wordCount !== count || !Number.isInteger(position) ||
      position < 1 || position > verse.wordCount || !Array.isArray(verse.words)) return null;
  const candidates = verse.words.filter(word => word?.position === position);
  // The importer chooses a canonical complete take. Ambiguous or duplicate
  // positions are declined rather than playing whichever repeat is shortest.
  if (candidates.length !== 1) return null;
  const word = candidates[0];
  // The source uses integer milliseconds; subtraction after conversion to
  // seconds can produce 79.9999999999 ms for a valid 80 ms boundary.
  const durationMs = (word.end - word.start) * 1000;
  if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 ||
      durationMs < 80 - 1e-6 || durationMs > 45000 + 1e-6 ||
      !['string', 'number'].includes(typeof word.take) || !String(word.take).trim() ||
      typeof word.take === 'number' && !Number.isFinite(word.take) ||
      typeof word.url !== 'string') return null;
  let url;
  try { url = new URL(word.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
  return { ...word, url: url.href };
}
function resolvedReference(reference, voice, word, data, format = 'word') {
  return { ...reference, url: word.url, voiceId: voice.id, voiceName: voice.name, style: voice.style,
    combined: false,
    format, start: word.start, end: word.end, stream: true, timingTake: word.take,
    timingProvider: 'QUA', timingRelease: RELEASE, timingSource: data.source,
    timingSourceFile: data.sourceFile };
}
export function createTeacherQua() {
  return {
    async resolve(reference, voice, signal) {
      if (!reference || !Number.isInteger(reference.surah) || reference.surah < 1 || reference.surah > 114) return null;
      const result = await timings(voice.id, reference.surah, signal);
      const word = wordTiming(result?.data, reference);
      return word ? resolvedReference(reference, voice, word, result) : null;
    },
    async resolvePhrase(references, voice, signal) {
      if (!Array.isArray(references) || references.length < 2 || references.length > 3) return null;
      const first = references[0], firstPosition = wordPosition(first);
      if (!first || !references.every((reference, index) => reference &&
          reference.surah === first.surah && reference.ayah === first.ayah &&
          wordCount(reference) === wordCount(first) &&
          wordPosition(reference) === firstPosition + index)) return null;
      const result = await timings(voice.id, first.surah, signal);
      const words = references.map(reference => wordTiming(result?.data, reference));
      if (words.some(word => !word)) return null;
      if (!words.every((word, index) => word.url === words[0].url && word.take === words[0].take &&
          (!index || word.start >= words[index - 1].end && word.start - words[index - 1].end <= 1.5))) return null;
      return { ...resolvedReference(first, voice, { ...words[0], end: words.at(-1).end }, result, 'phrase'),
        combined: false, phraseWordCount: references.length,
        endTimingPosition: wordPosition(references.at(-1)) };
    },
  };
}
