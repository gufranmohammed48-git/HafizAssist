// Shared Teacher voice choices on the desktop, mobile, and test pages. Recognition continues
// to use the same local model; these sources are prerecorded Quran audio.
import { createTeacherQua } from './teacher-qua.js';
const SELECTION_KEY = 'recitealquran-teacher-voice-preview';
const TIMING_CACHE = 'recitealquran-teacher-timings-v1';
const DEFAULT_VOICE = 'husary-murattal';
const AUDIO_BASE = 'https://everyayah.com/data/';
const VOICES = [
  { id: 'husary-murattal', name: 'Mahmoud Khalil Al-Husary', style: 'Murattal', folder: 'Husary_64kbps', timed: true },
  { id: 'minshawi-murattal', name: 'Muhammad Siddiq Al-Minshawi', style: 'Murattal', folder: 'Minshawy_Murattal_128kbps', timed: true },
  { id: 'afasy-murattal', name: 'Mishary Rashid Al-Afasy', style: 'Murattal', folder: 'Alafasy_128kbps', timed: true },
  { id: 'abdulbasit-mujawwad', name: 'Abdul Basit Abdus Samad', style: 'Mujawwad', folder: 'Abdul_Basit_Mujawwad_128kbps', timed: true },
  { id: 'minshawi-mujawwad', name: 'Muhammad Siddiq Al-Minshawi', style: 'Mujawwad', folder: 'Minshawy_Mujawwad_192kbps', timed: true },
];
const timingData = new Map(), timingRequests = new Map();
const abortError = () => new DOMException('Teacher voice selection cancelled.', 'AbortError');
function checkAbort(signal) {
  if (signal?.aborted) throw signal.reason || abortError();
}
function validTimingData(data, voice) {
  return data?.schema === 1 && data.voice === voice.id && typeof data.source === 'string' &&
    data.verses && typeof data.verses === 'object' && !Array.isArray(data.verses) &&
    (!data.audioFolder || data.audioFolder === voice.folder);
}
async function loadTimings(voice, signal) {
  const url = new URL(`../data/teacher-timings/${voice.id}.json?v=1`, import.meta.url).href;
  let cache;
  try { cache = await caches.open(TIMING_CACHE); } catch {}
  checkAbort(signal);
  try {
    const saved = await cache?.match(url);
    if (saved) {
      const data = await saved.json();
      checkAbort(signal);
      if (validTimingData(data, voice)) return data;
      await cache.delete(url);
    }
  } catch { checkAbort(signal); }
  checkAbort(signal);
  // Missing timings use an explicitly labelled single-word reference.
  // Never invent a boundary by dividing a multi-word span equally.
  let timer;
  const request = new AbortController();
  const onAbort = () => request.abort(signal.reason || abortError());
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    timer = setTimeout(() => request.abort(), 8000);
    const response = await fetch(url, { credentials: 'omit', signal: request.signal });
    if (!response.ok) return null;
    const savedResponse = response.clone();
    const data = await response.json();
    checkAbort(signal);
    if (!validTimingData(data, voice)) return null;
    try { await cache?.put(url, savedResponse); } catch {}
    checkAbort(signal);
    return data;
  } catch { checkAbort(signal); return null; }
  finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}
function getTimings(voice, signal) {
  checkAbort(signal);
  if (timingData.has(voice.id)) return Promise.resolve(timingData.get(voice.id));
  let entry = timingRequests.get(voice.id);
  if (!entry || entry.controller.signal.aborted) {
    entry = { controller: new AbortController(), users: 0, settled: false };
    timingRequests.set(voice.id, entry);
    entry.promise = loadTimings(voice, entry.controller.signal).then(data => {
      if (data) timingData.set(voice.id, data);
      return data;
    }).finally(() => {
      entry.settled = true;
      if (timingRequests.get(voice.id) === entry) timingRequests.delete(voice.id);
    });
  }
  entry.users++;
  // Upcoming-word warming can share one metadata download, while each
  // playback request still responds promptly to its own cancellation signal.
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (callback, value) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', onAbort);
      entry.users--;
      if (!entry.users && !entry.settled) entry.controller.abort(abortError());
      callback(value);
    };
    const onAbort = () => finish(reject, signal.reason || abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    entry.promise.then(data => finish(resolve, data), error => finish(reject, error));
  });
}
function isolatedWordTiming(data, reference) {
  const index = (reference.timingPosition ?? reference.position) - 1;
  const spans = data?.verses?.[`${reference.surah}:${reference.ayah}`];
  if (!Array.isArray(spans)) return null;
  // A shifted/extra source index can select a different word. Decline the
  // entire verse's timings when its terminal index disagrees with our text.
  if (Number.isInteger(reference.timingWordCount) &&
      Math.max(...spans.map(span => Array.isArray(span) ? span[1] : NaN)) !== reference.timingWordCount) return null;
  return spans.filter(span => Array.isArray(span) && span.length >= 4 &&
    span.every(Number.isFinite) && Number.isInteger(span[0]) && Number.isInteger(span[1]) &&
    span[0] === index && span[1] === index + 1 && span[2] >= 0 && span[3] - span[2] >= 80)
    .sort((a, b) => (a[3] - a[2]) - (b[3] - b[2]))[0] || null;
}

export function createTeacherVoices({ onChange, getEnabled, onToggle, onOpen } = {}) {
  if (document.documentElement.dataset.teacherVoices !== 'preview') return null;
  const qua = document.documentElement.dataset.teacherTimings === 'qua' ? createTeacherQua() : null;
  const trigger = document.getElementById('teacher-enabled');
  if (!trigger) return null;
  let selected = DEFAULT_VOICE;
  try {
    const saved = localStorage.getItem(SELECTION_KEY);
    if (VOICES.some(voice => voice.id === saved)) selected = saved;
    else if (saved?.endsWith('-mujawwad')) selected = 'abdulbasit-mujawwad';
  } catch {}
  const panel = document.createElement('aside');
  panel.id = 'teacher-voices'; panel.className = 'teacher-voice-panel'; panel.hidden = true; panel.inert = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'teacher-voices-title'); panel.setAttribute('aria-hidden', 'true');
  const header = document.createElement('div'); header.className = 'teacher-voices-heading';
  const heading = document.createElement('h2'); heading.id = 'teacher-voices-title'; heading.textContent = 'Teacher';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'icon-button teacher-voices-close';
  close.setAttribute('aria-label', 'Close Teacher options'); close.textContent = '×';
  header.append(heading, close);
  const help = document.createElement('p'); help.className = 'teacher-voices-help'; help.textContent = trigger.dataset.help ||
    'Teacher helps after a five-second quiet pause and recites words flagged as possible mistakes so you can listen and try again.';
  const enableRow = document.createElement('div'); enableRow.className = 'teacher-voices-enable-row';
  const enableLabel = document.createElement('span'); enableLabel.textContent = 'Teacher';
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'teacher-voices-toggle';
  toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-label', 'Teacher');
  const switchTrack = document.createElement('span'); switchTrack.className = 'teacher-voices-switch-track'; switchTrack.setAttribute('aria-hidden', 'true');
  const switchState = document.createElement('span'); switchState.className = 'teacher-voices-switch-state'; switchState.setAttribute('aria-hidden', 'true');
  toggle.append(switchTrack, switchState); enableRow.append(enableLabel, toggle);
  const instruction = document.createElement('p'); instruction.className = 'teacher-voices-instruction';
  const choices = document.createElement('fieldset'); choices.className = 'teacher-voice-choices';
  const legend = document.createElement('legend'); legend.className = 'sr-only'; legend.textContent = 'Teacher voice'; choices.append(legend);
  const inputs = [];
  function choice(id, name, parent) {
    const label = document.createElement('label'); label.className = 'teacher-voice-choice';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'teacher-voice-preview'; input.value = id;
    input.checked = selected === id; input.setAttribute('aria-describedby', 'teacher-voice-notice');
    label.classList.toggle('is-selected', input.checked);
    const text = document.createElement('span'); text.textContent = name;
    label.append(input, text); parent.append(label); inputs.push(input);
    input.addEventListener('change', () => selectVoice(id));
    // Choosing the already selected voice is also a direct way to enable
    // Teacher. Arrow-key radio changes keep their native keyboard behavior.
    input.addEventListener('click', () => {
      if (selected === id && !getEnabled?.()) onChange?.(selected);
    });
  }
  for (const style of ['Murattal', 'Mujawwad']) {
    const group = document.createElement('div'); group.className = 'teacher-voice-group';
    const title = document.createElement('h3'); title.textContent = style; group.append(title);
    for (const voice of VOICES.filter(item => item.style === style)) choice(voice.id, voice.name, group);
    choices.append(group);
  }
  const notice = document.createElement('p'); notice.id = 'teacher-voice-notice'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  const status = document.createElement('p'); status.id = 'teacher-voices-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.textContent = document.getElementById('teacher-status')?.textContent || '';
  const voiceForSelection = () => VOICES.find(voice => voice.id === selected);
  function defaultNotice() {
    const help = document.documentElement.dataset.teacherPauseWords === '3'
      ? 'Pause help plays up to three words; corrections play one word.' : 'Teacher plays one word.';
    if (qua) {
      notice.textContent = `${help} This trial uses QUA letter boundaries. Conflicting boundaries use the original timing for your chosen voice, then a labelled Quran.com word reference if needed. Streamed recordings need a connection.`;
      return;
    }
    notice.textContent = `${help} If this voice has no usable word timing, it uses a clearly labelled Quran.com word reference.`;
  }
  defaultNotice();
  panel.append(header, help, enableRow, instruction, choices, notice, status); document.body.append(panel);
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
  let isOpen = false, closeTimer, openFrame, placementFrame, disposed = false;
  function refreshEnabled(enabled = Boolean(getEnabled?.())) {
    toggle.setAttribute('aria-checked', String(enabled));
    switchState.textContent = enabled ? 'On' : 'Off';
    toggle.title = enabled ? 'Teacher is on. Click to turn it off.' : 'Teacher is off. Click to turn it on.';
    instruction.textContent = enabled ? 'Choose the voice for pause help and corrections.' : 'Choose a voice to enable Teacher.';
  }
  refreshEnabled();
  function selectVoice(id) {
    selected = id;
    try { localStorage.setItem(SELECTION_KEY, selected); } catch {}
    for (const input of inputs) {
      input.checked = input.value === selected;
      input.parentElement.classList.toggle('is-selected', input.checked);
    }
    defaultNotice();
    onChange?.(selected);
    refreshEnabled();
  }
  function placePanel() {
    if (panel.hidden) return;
    const page = document.querySelector('.reader')?.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const toolbar = document.querySelector('.practice')?.getBoundingClientRect();
    const topRow = document.body.classList.contains('book-controls-top');
    // Reserve the complete toolbar rectangle, even when the page has no
    // spare gutter. This panel may overlap the page edge, never its controls.
    const safeLeft = topRow ? 16 : Math.max(16, (toolbar?.right || 70) + 12);
    const available = page ? page.left - safeLeft - 12 : 0;
    const inGutter = !topRow && available >= 250;
    const width = Math.max(1, Math.min(320, viewport - safeLeft - 16, inGutter ? available : 320));
    const safeTop = topRow && toolbar && toolbar.bottom > 0 && toolbar.top < viewportHeight
      ? Math.max(16, toolbar.bottom + 12) : 16;
    const availableHeight = Math.max(1, viewportHeight - safeTop - 16);
    panel.dataset.placement = topRow ? 'row' : inGutter ? 'gutter' : 'overlay';
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${availableHeight}px`;
    panel.style.left = `${inGutter ? safeLeft + (available - width) / 2 : safeLeft}px`;
    // offsetHeight is untransformed, so the growing animation cannot alter
    // its own placement. Center inside the space below a visible top row.
    const height = panel.offsetHeight;
    panel.style.top = `${Math.max(safeTop, safeTop + (availableHeight - height) / 2)}px`;
  }
  function schedulePlacement() {
    cancelAnimationFrame(placementFrame); placementFrame = requestAnimationFrame(placePanel);
  }
  function closePanel({ restoreFocus = true } = {}) {
    if (!isOpen) return;
    const returnFocus = restoreFocus && panel.contains(document.activeElement);
    isOpen = false; cancelAnimationFrame(openFrame); clearTimeout(closeTimer);
    panel.classList.remove('is-open'); panel.inert = true; panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('teacher-panel-open');
    if (returnFocus) trigger.focus({ preventScroll: true });
    closeTimer = setTimeout(() => {
      if (!isOpen) panel.hidden = true;
      closeTimer = null;
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500);
  }
  function togglePanel() {
    if (disposed) return;
    if (isOpen) { closePanel(); return; }
    // Opening options is an audio-unlock gesture, without toggling Teacher
    // or shifting the centered Mushaf. The panel has its own on/off button.
    onOpen?.();
    const settings = document.getElementById('book-settings');
    if (settings?.open) settings.close();
    clearTimeout(closeTimer); closeTimer = null; cancelAnimationFrame(openFrame);
    isOpen = true; panel.hidden = false; panel.inert = false; panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true'); document.body.classList.add('teacher-panel-open');
    refreshEnabled(); placePanel();
    // Explicit frames and a delayed hidden attribute animate both directions
    // in browsers without discrete display/overlay transition support.
    openFrame = requestAnimationFrame(() => {
      openFrame = requestAnimationFrame(() => {
        if (!isOpen) return;
        panel.classList.add('is-open'); close.focus({ preventScroll: true });
      });
    });
  }
  const onClose = () => closePanel();
  const onToggleTeacher = () => { onToggle?.(); refreshEnabled(); };
  const onOutside = event => {
    if (isOpen && !panel.contains(event.target) && !trigger.contains(event.target)) closePanel({ restoreFocus: false });
  };
  const onKey = event => {
    if (isOpen && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); }
  };
  close.addEventListener('click', onClose); toggle.addEventListener('click', onToggleTeacher);
  document.addEventListener('pointerdown', onOutside, true); document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', schedulePlacement);
  window.addEventListener('scroll', schedulePlacement, { passive: true });
  const reader = document.querySelector('.reader');
  const readerObserver = new ResizeObserver(schedulePlacement);
  if (reader) readerObserver.observe(reader);
  const toolbar = document.querySelector('.practice'); if (toolbar) readerObserver.observe(toolbar);
  readerObserver.observe(panel);
  const layoutObserver = new MutationObserver(schedulePlacement);
  layoutObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const modalObserver = new MutationObserver(() => {
    if (document.getElementById('book-settings')?.open || document.getElementById('voice-dialog')?.open) closePanel({ restoreFocus: false });
  });
  for (const id of ['book-settings', 'voice-dialog']) {
    const dialog = document.getElementById(id);
    if (dialog) modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
  return {
    get key() { return selected; },
    get id() { return selected; },
    get name() { return voiceForSelection().name; },
    togglePanel, closePanel, refreshEnabled,
    setStatus(text) { if (status.textContent !== text) status.textContent = text; },
    setDisabled(disabled, busy = false) {
      for (const input of inputs) {
        input.disabled = Boolean(disabled);
        input.parentElement.classList.toggle('is-disabled', Boolean(disabled));
        input.parentElement.title = disabled ? 'Wait for Teacher playback, microphone setup, or voice search to finish before changing the voice.' : 'Use this voice for Teacher';
      }
      toggle.disabled = Boolean(busy);
    },
    dispose() {
      disposed = true; clearTimeout(closeTimer); cancelAnimationFrame(openFrame); cancelAnimationFrame(placementFrame);
      document.removeEventListener('pointerdown', onOutside, true); document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', schedulePlacement); window.removeEventListener('scroll', schedulePlacement);
      readerObserver.disconnect(); layoutObserver.disconnect(); modalObserver.disconnect();
      document.body.classList.remove('teacher-panel-open'); trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-controls'); trigger.removeAttribute('aria-haspopup'); panel.remove();
    },
    fallback(reference, reason = 'An isolated word timing is unavailable.', { quiet = false } = {}) {
      const voice = voiceForSelection();
      const detail = `${reason} Using Quran.com single-word audio instead of ${voice.name}.`;
      if (!quiet) notice.textContent = detail;
      return { ...reference, voiceId: 'word-reference', voiceName: 'Quran.com word reference', format: 'word',
        start: undefined, end: undefined, notice: detail, wordFallback: true };
    },
    async resolve(reference, signal, { quiet = false } = {}) {
      checkAbort(signal);
      if (!reference) return null;
      const voice = voiceForSelection();
      const { surah, ayah, position } = reference;
      if (![surah, ayah, position].every(value => Number.isInteger(value) && value > 0)) throw new Error('The word location is unavailable for this Teacher voice.');
      if (qua) {
        const resolved = await qua.resolve(reference, voice, signal);
        checkAbort(signal);
        if (selected !== voice.id) throw abortError();
        if (resolved) {
          if (!quiet) notice.textContent = `Teacher reads one word in ${voice.name} (${voice.style}) using QUA letter boundaries.`;
          return resolved;
        }
        // Connected letters or missing bounds cannot give an isolated QUA
        // clip. Try our original timing for the SAME reciter first.
      }
      const path = `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
      const resolved = { ...reference, url: `${AUDIO_BASE}${voice.folder}/${path}`, voiceId: voice.id, voiceName: voice.name, style: voice.style };
      const data = await getTimings(voice, signal);
      checkAbort(signal);
      if (selected !== voice.id) throw abortError();
      const timing = isolatedWordTiming(data, reference);
      if (timing) {
        if (!quiet) notice.textContent = `Teacher reads one word in ${voice.name} (${voice.style})${qua ? ' using the original word timing; QUA boundaries were unavailable or conflicting' : ''}.`;
        return { ...resolved, combined: reference.timingPosition !== reference.position ? false : reference.combined,
          format: 'word', start: timing[2] / 1000, end: timing[3] / 1000,
          ...(qua ? { timingProvider: 'legacy', quaFallback: true } : {}) };
      }
      return this.fallback(reference, undefined, { quiet });
    },
    async resolvePhrase(references, signal, { quiet = false } = {}) {
      checkAbort(signal);
      if (!Array.isArray(references) || references.length < 2 || references.length > 3) return null;
      const voice = voiceForSelection();
      // QUA is mapped to the original display words. Its split-word indices
      // must not pass through the merged Quran.com/legacy timing guard below.
      if (qua) {
        const resolved = await qua.resolvePhrase(references, voice, signal);
        checkAbort(signal);
        if (selected !== voice.id) throw abortError();
        if (resolved) {
          if (!quiet) notice.textContent = `Teacher reads ${references.length} words in ${voice.name} (${voice.style}) using QUA letter boundaries.`;
          return resolved;
        }
      }
      const first = references[0];
      if (!first || !Number.isInteger(first.timingWordCount) || first.timingWordCount < 1) return null;
      const firstPosition = first.timingPosition ?? first.position;
      // Only join exact consecutive source words in the same ayah. Quran.com
      // combined words can share an index; those must retain individual replay.
      // The separate 37:130 timingPosition indices remain usable here.
      if (!references.every((reference, index) => reference &&
        [reference.surah, reference.ayah, reference.position].every(value => Number.isInteger(value) && value > 0) &&
        reference.surah === first.surah && reference.ayah === first.ayah &&
        reference.timingWordCount === first.timingWordCount &&
        Number.isInteger(reference.timingPosition ?? reference.position) &&
        (reference.timingPosition ?? reference.position) === firstPosition + index)) return null;
      const data = await getTimings(voice, signal);
      checkAbort(signal);
      if (selected !== voice.id) throw abortError();
      const spans = references.map(reference => isolatedWordTiming(data, reference));
      if (spans.some(span => !span) || spans.some((span, index) => index > 0 && span[2] < spans[index - 1][3])) return null;
      const path = `${String(first.surah).padStart(3, '0')}${String(first.ayah).padStart(3, '0')}.mp3`;
      if (!quiet) notice.textContent = `Teacher reads ${references.length} words in ${voice.name} (${voice.style})${qua ? ' using the original word timing; QUA boundaries were unavailable or conflicting' : ''}.`;
      return { ...first, url: `${AUDIO_BASE}${voice.folder}/${path}`, voiceId: voice.id, voiceName: voice.name, style: voice.style,
        combined: false, format: 'phrase', phraseWordCount: references.length,
        endTimingPosition: references[references.length - 1].timingPosition ?? references[references.length - 1].position,
        start: spans[0][2] / 1000, end: spans[spans.length - 1][3] / 1000,
        timingSource: data.source, timingSourceFile: data.sourceFile,
        ...(qua ? { timingProvider: 'legacy', quaFallback: true } : {}) };
    },
  };
}
