// Teacher audio is reference recitation, separate from the recognition model.
// Keep the Quran page and its completed-word history unchanged during feedback.
const AUDIO_BASE = 'https://audio.qurancdn.com/wbw/';
const CACHE = 'recitealquran-teacher-audio-v1';
const RETENTION = 6 * 24 * 60 * 60 * 1000;
const MAX_CLIPS = 200;
const SPLIT_WORDS = { '2:181': 3, '8:6': 4, '13:37': 8, '37:130': 3 };
const abortError = () => new DOMException('Teacher playback cancelled.', 'AbortError');

export function teacherAudioReference(word) {
  if (!word) return null;
  const surah = word.bismillah ? 1 : word.surah;
  const ayah = word.bismillah ? 1 : word.ayah;
  let position = word.position + 1;
  const split = SPLIT_WORDS[`${surah}:${ayah}`];
  const combined = Boolean(split && (position === split || position === split + 1));
  if (split && position > split) position--;
  const path = [surah, ayah, position].map(value => String(value).padStart(3, '0')).join('_');
  return { url: `${AUDIO_BASE}${path}.mp3`, combined, split };
}

export function createTeacherMode({ getState, pauseRecognition, resumeRecognition, onStateChange }) {
  const $ = id => document.getElementById(id);
  if (!$('teacher-enabled')) return { refresh() {}, observe() {}, cancel() {}, unlock() {}, continuePage() {}, playing: false, busy: false };
  const card = $('teacher-feedback');
  let enabled = false, hints = true, corrections = true;
  let audioContext, mediaAudio, silentUrl, source, activeJob, correction;
  let dismissTimer, closeTimer, cardFrame, lastKey = '', warmKey = '', warmController;
  let feedbackWord;
  const hinted = new Set(), corrected = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem('recitealquran-teacher') || '{}');
    enabled = saved.enabled === true; hints = saved.hints !== false; corrections = saved.corrections !== false;
  } catch {}
  $('teacher-enabled').checked = enabled;
  $('teacher-hints').checked = hints;
  $('teacher-corrections').checked = corrections;
  function save() {
    try { localStorage.setItem('recitealquran-teacher', JSON.stringify({ enabled, hints, corrections })); } catch {}
  }
  function message(text) { $('teacher-status').textContent = text; }
  function positionCard() {
    if (card.hidden) return;
    const page = document.querySelector('.reader')?.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const available = page ? width - page.right - 32 : 0;
    if (available >= 240) {
      const cardWidth = Math.min(310, available);
      card.dataset.placement = 'gutter';
      card.style.width = `${cardWidth}px`;
      card.style.left = `${page.right + 16 + (available - cardWidth) / 2}px`;
    } else {
      card.dataset.placement = 'overlay';
      card.style.removeProperty('width'); card.style.removeProperty('left');
    }
  }
  function hideCard() {
    clearTimeout(dismissTimer); clearTimeout(closeTimer); cancelAnimationFrame(cardFrame);
    card.classList.remove('is-visible');
    closeTimer = setTimeout(() => { card.hidden = true; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 440);
  }
  function showCard(label, word, detail, temporary = false) {
    clearTimeout(dismissTimer); clearTimeout(closeTimer); cancelAnimationFrame(cardFrame);
    $('teacher-feedback-label').textContent = label;
    $('teacher-feedback-word').textContent = word?.audioLabel || word?.accessible || '';
    $('teacher-feedback-detail').textContent = detail;
    feedbackWord = word;
    card.hidden = false; positionCard();
    cardFrame = requestAnimationFrame(() => card.classList.add('is-visible'));
    if (temporary) dismissTimer = setTimeout(hideCard, 5000);
  }
  function unlock(manual = false) {
    if (!enabled && !manual) return;
    // Called directly from the Teacher toggle, replay button, or mic click.
    try {
      if (!audioContext || audioContext.state === 'closed') audioContext = new (window.AudioContext || window.webkitAudioContext)();
      void audioContext.resume().catch(() => {});
      if (!mediaAudio) {
        mediaAudio = new Audio();
        // Unlock the same media element for a direct-stream fallback on browsers
        // where public CDN files cannot be fetched for WebAudio decoding.
        const wav = new ArrayBuffer(46), view = new DataView(wav);
        const write = (offset, value) => [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
        write(0, 'RIFF'); view.setUint32(4, 38, true); write(8, 'WAVE'); write(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, 2, true);
        silentUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        mediaAudio.src = silentUrl;
        void mediaAudio.play().catch(() => {});
      }
    } catch { message('Audio playback is unavailable in this browser.'); }
  }
  async function pruneCache() {
    try {
      const cache = await caches.open(CACHE);
      const entries = await Promise.all((await cache.keys()).map(async request => {
        const response = await cache.match(request);
        return { request, saved: Number(response?.headers.get('X-Teacher-Saved-At')) || 0 };
      }));
      const fresh = entries.filter(entry => Date.now() - entry.saved < RETENTION).sort((a, b) => b.saved - a.saved);
      const keep = new Set(fresh.slice(0, MAX_CLIPS).map(entry => entry.request.url));
      await Promise.all(entries.filter(entry => !keep.has(entry.request.url)).map(entry => cache.delete(entry.request)));
    } catch {} // Private browsing or quota limits must not prevent streaming.
  }
  void pruneCache();
  async function fetchClip(url, signal) {
    if (signal.aborted) throw abortError();
    let cache;
    try {
      cache = await caches.open(CACHE);
      const saved = await cache.match(url);
      if (saved?.ok) {
        const time = Number(saved.headers.get('X-Teacher-Saved-At')) || 0;
        if (Date.now() - time < RETENTION) return saved.arrayBuffer();
        await cache.delete(url);
      }
    } catch {}
    if (!navigator.onLine) throw new Error('This word’s audio is not saved on this device. Connect to download it.');
    const download = new AbortController();
    const abort = () => download.abort(); signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 10000);
    try {
      const response = await fetch(url, { signal: download.signal, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('The reference recording for this word is unavailable.');
      const bytes = await response.arrayBuffer();
      if (signal.aborted) throw abortError();
      if (cache) {
        const headers = new Headers({ 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg' });
        headers.set('X-Teacher-Saved-At', String(Date.now()));
        try { await cache.put(url, new Response(bytes.slice(0), { headers })); void pruneCache(); } catch {}
      }
      return bytes;
    } catch (error) {
      if (signal.aborted) throw abortError();
      throw error;
    } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  }
  async function prepare(word, signal) {
    const reference = teacherAudioReference(word);
    if (!reference) throw new Error('Choose a Quran word first.');
    try {
      const bytes = await fetchClip(reference.url, signal);
      if (!audioContext) throw new Error('Enable Teacher mode or press Hear this word to allow audio.');
      const buffer = await audioContext.decodeAudioData(bytes);
      if (!buffer.duration || buffer.duration > 12) throw new Error('The reference clip could not be read.');
      return { buffer, reference };
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (!navigator.onLine) throw error;
      // A regular audio element can play public media without reading its bytes.
      return { reference, direct: true };
    }
  }
  function playClip(clip, signal) {
    return new Promise((resolve, reject) => {
      let timer, finished = false;
      const cleanup = () => {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
        if (mediaAudio) { mediaAudio.onended = null; mediaAudio.onerror = null; }
        if (source) { source.onended = null; source.disconnect(); source = null; }
      };
      const finish = error => { if (finished) return; finished = true; cleanup(); error ? reject(error) : resolve(); };
      const abort = () => {
        try { source?.stop(); } catch {}
        mediaAudio?.pause(); finish(abortError());
      };
      if (signal.aborted) { reject(abortError()); return; }
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => {
        try { source?.stop(); } catch {}
        mediaAudio?.pause(); finish(new Error('Teacher audio timed out. Press Hear this word to retry.'));
      }, 15000);
      if (clip.direct) {
        if (!mediaAudio) { finish(new Error('Press Hear this word to allow audio playback.')); return; }
        mediaAudio.onended = () => finish();
        mediaAudio.onerror = () => finish(new Error('The reference recording could not load. Your microphone can continue.'));
        mediaAudio.src = clip.reference.url;
        void mediaAudio.play().catch(() => finish(new Error('Audio was blocked. Press Hear this word to allow playback.')));
      } else {
        try {
          source = audioContext.createBufferSource(); source.buffer = clip.buffer;
          source.connect(audioContext.destination); source.onended = () => finish(); source.start();
        } catch (error) { finish(error); }
      }
    });
  }
  function resumeAudio(signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('Press Hear this word to allow audio playback.')), 3000);
      const abort = () => finish(abortError());
      function finish(error) {
        clearTimeout(timer); signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      }
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      audioContext.resume().then(() => finish(audioContext.state === 'running' ? null : new Error('Audio playback is paused. Press Hear this word.')), finish);
    });
  }
  function cancel({ reset = false, hide = true, preserveCorrection = false } = {}) {
    activeJob?.controller.abort();
    warmController?.abort(); warmKey = '';
    if (!preserveCorrection) correction = null;
    if (reset) { hinted.clear(); corrected.clear(); lastKey = ''; }
    if (hide) hideCard();
  }
  async function speak(word, kind, key) {
    if (activeJob || !word) return;
    const before = getState();
    if (before.voiceSearch || !['idle', 'recording'].includes(before.phase)) return;
    const job = { controller: new AbortController(), kind, playing: false, page: before.page,
      cursor: before.cursor, speechAt: before.speechAt, gated: false };
    activeJob = job; refresh(); onStateChange?.();
    const signal = job.controller.signal;
    message('Loading reference audio…');
    showCard(kind === 'correction' ? 'Review this word' : kind === 'hint' ? 'A little help' : 'Reference word', word, 'Loading audio…');
    try {
      const clip = await prepare(word, signal);
      if (!clip.direct) await resumeAudio(signal);
      let now = getState();
      if (signal.aborted || now.page !== before.page || now.cursor !== before.cursor || now.phase !== before.phase ||
          (kind !== 'manual' && now.speechAt > before.speechAt)) throw abortError();
      if (before.phase === 'recording') {
        job.gated = true;
        await pauseRecognition();
        now = getState();
        if (signal.aborted || now.phase !== 'recording' || (kind !== 'manual' && now.speechAt > before.speechAt)) throw abortError();
      }
      job.playing = true;
      showCard(kind === 'correction' ? 'Review this word' : kind === 'hint' ? 'A little help' : 'Reference word', word,
        clip.reference.combined ? 'Playing the complete source word.' : 'Listen to the reference recording.');
      message('Playing reference audio…');
      await playClip(clip, signal);
      if (signal.aborted) throw abortError();
      if (kind === 'hint') hinted.add(key);
      if (kind === 'correction') corrected.add(key);
      showCard('Your turn', word, kind === 'correction' ? 'Continue when you’re ready. The flagged word remains available for review.' : 'Read the highlighted word when you’re ready.', true);
      message(clip.direct ? 'Listening. This clip streamed online and was not saved offline.' : 'Ready. Downloaded word audio is kept on this device for up to six days.');
    } catch (error) {
      if (error.name !== 'AbortError') {
        // Do not retry failed automatic prompts in an endless loop.
        if (kind === 'hint') hinted.add(key);
        if (kind === 'correction') corrected.add(key);
        showCard('Audio unavailable', word, error.message, true); message(error.message);
      }
    } finally {
      // Include cancellation and playback errors: a stopped speaker can still
      // leave a brief echo, which must not be counted as the learner's speech.
      if (job.gated && job.playing && getState().phase === 'recording') await new Promise(resolve => setTimeout(resolve, 400));
      if (job.gated) await resumeRecognition().catch(() => {});
      job.playing = false;
      if (activeJob === job) activeJob = null;
      refresh(); onStateChange?.();
    }
  }
  function refresh() {
    const state = getState();
    const busy = !['idle', 'recording'].includes(state.phase) || state.voiceSearch;
    $('teacher-hear').disabled = !state.word || busy || Boolean(activeJob);
    $('teacher-replay').disabled = !feedbackWord || busy || Boolean(activeJob);
    $('teacher-hints').disabled = !enabled;
    $('teacher-corrections').disabled = !enabled;
    if (state.key !== lastKey) {
      lastKey = state.key;
      if (!activeJob) hideCard();
      if (correction && (correction.page !== state.page || state.cursor - correction.cursor > 6)) correction = null;
    }
    // Fetch only the next three words, not a whole chapter or Quran audio pack.
    if (enabled && state.word && navigator.onLine && !state.voiceSearch && !busy && warmKey !== state.key) {
      warmController?.abort(); warmController = new AbortController(); warmKey = state.key;
      const signal = warmController.signal;
      void (async () => {
        for (const word of state.nextWords || []) {
          if (signal.aborted) break;
          try { await fetchClip(teacherAudioReference(word).url, signal); } catch { if (signal.aborted) break; }
        }
      })();
    }
  }
  function observe(results, page) {
    if (!enabled || !corrections) return;
    const latest = results.filter(result => result.state === 'review').at(-1);
    if (!latest?.word) return;
    const key = `${page}:${latest.word.surah}:${latest.word.ayah}:${latest.word.position}:${Boolean(latest.word.bismillah)}`;
    if (!corrected.has(key)) correction = { key, word: latest.word, page, cursor: getState().cursor };
  }
  function continuePage(page) {
    // The final flagged word can still be heard after an automatic page turn.
    if (correction) { correction.page = page; correction.cursor = 0; }
  }
  setInterval(() => {
    const state = getState();
    if (activeJob) {
      if (!activeJob.gated && activeJob.kind !== 'manual' && state.speechAt > activeJob.speechAt) cancel();
      return;
    }
    if (!enabled || state.phase !== 'recording' || state.voiceSearch || !state.word || document.hidden) return;
    // Recent PCM and an empty queue are required: a slow worker is not silence.
    if (!state.audioAt || Date.now() - state.audioAt > 1000 || state.pendingChunks > 0) return;
    const quietFor = Date.now() - Math.max(state.speechAt, state.advanceAt);
    if (correction && corrections && quietFor >= 1200) {
      const next = correction; correction = null;
      if (next.page === state.page) void speak(next.word, 'correction', next.key);
    } else if (hints && quietFor >= 5000 && !hinted.has(state.key)) void speak(state.word, 'hint', state.key);
  }, 250);
  $('teacher-enabled').addEventListener('change', () => {
    enabled = $('teacher-enabled').checked;
    if (enabled) { unlock(); message('Teacher on. Pause for five seconds for help, or press Hear this word.'); }
    else { cancel(); message('Teacher off. Manual word replay is still available.'); }
    save(); refresh();
  });
  $('teacher-hints').addEventListener('change', () => { hints = $('teacher-hints').checked; save(); if (!hints) cancel(); });
  $('teacher-corrections').addEventListener('change', () => { corrections = $('teacher-corrections').checked; save(); if (!corrections) cancel(); });
  $('teacher-hear').addEventListener('click', () => { unlock(true); void speak(getState().word, 'manual'); });
  $('teacher-replay').addEventListener('click', () => { unlock(true); void speak(feedbackWord, 'manual'); });
  $('teacher-dismiss').addEventListener('click', () => cancel());
  window.addEventListener('resize', positionCard);
  window.addEventListener('scroll', positionCard, { passive: true });
  new ResizeObserver(positionCard).observe(document.querySelector('.reader'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  window.addEventListener('pagehide', () => {
    cancel(); mediaAudio?.pause(); void audioContext?.close().catch(() => {});
    if (silentUrl) URL.revokeObjectURL(silentUrl);
  });
  message(enabled ? 'Teacher on. Press the microphone to begin, or Hear this word.' : 'Enable Teacher mode for spoken word hints and vowel review.');
  return { refresh, observe, cancel, unlock, continuePage, get playing() { return activeJob?.playing === true; }, get busy() { return Boolean(activeJob); } };
}
