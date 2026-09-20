import { alignSegment, normalize, locateTranscriptBoundary } from './alignment.js';
import { setupOffline, refreshOfflineStatus } from './offline.js';
import { createDebugPanel } from './debug.js';
import { createWordInfo, wordRules } from './word-info.js';

const $ = id => document.getElementById(id);
const arabicNumber = new Intl.NumberFormat('ar', { numberingSystem: 'arab', useGrouping: false });
let chapters = [], words = [], elements = [], states = [], committed = [];
let chapter, cursor = 0, segmentStart = 0, phase = 'idle', engineReady = false;
let segmentCarry = '';
let alignmentAnchor = null;
let pageBoundary = null;
let reviewDetails = [], completedMatched = 0, completedReview = 0, completedPages = 0, firstPracticePage = 1;
const wordInfo = createWordInfo(index => ({ word: words[index], state: states[index], detail: reviewDetails[index], hidden: memoryMode && !states[index] }));
let worker, sessionId = 0, pendingChunks = 0, workerTimer;
let media, context, source, capture, analyser, mute, animation, flushResolve;
let finishResolve, startResolve, stopPromise, engineResolve;
let elapsed = 0, startedAt = 0, memoryMode = false, fontSize = 34;
try {
  const savedSize = Number(localStorage.getItem('hafizassist-font-size'));
  if (savedSize >= 24 && savedSize <= 56) fontSize = savedSize;
} catch {}
let lastFollowedAyah = null, savedThisRun = false;
let history = [];
let voiceSearch = false, voiceText = '', searchWorker, searchRequest = 0, searchTimer;
let scrollFrame;
let layouts = {}, currentPage = 1;
const verseKey = verse => `${verse.surah}:${verse.ayah}`;
let lastRecognitionAt = 0, lastAdvanceAt = 0, lastAudioLogAt = 0, lastTranscript = '', micSettings = {};
let audioDiagnostic = {};
function debugWord(index) {
  const word = words[index];
  return word ? { index, surah: word.surah, ayah: word.ayah, word: word.position + 1,
    bismillah: Boolean(word.bismillah), text: word.accessible, phoneme: word.phoneme, state: states[index] || 'upcoming' } : null;
}
function debugSnapshot() {
  const now = Date.now();
  return { phase, page: currentPage, sessionId, engineReady, cursor, segmentStart,
    totalWords: words.length, pendingChunks, estimatedQueuedAudioMs: pendingChunks * 320,
    alignmentAnchor: alignmentAnchor ? { cursor: alignmentAnchor.cursor, offset: alignmentAnchor.offset } : null,
    sinceRecognitionMs: lastRecognitionAt ? now - lastRecognitionAt : null,
    sinceAdvanceMs: lastAdvanceAt ? now - lastAdvanceAt : null,
    expected: debugWord(cursor), nearby: words.slice(Math.max(0, cursor - 2), cursor + 5).map((_, i) => debugWord(Math.max(0, cursor - 2) + i)),
    transcript: lastTranscript, segmentCarry, audio: audioDiagnostic, micSettings,
    audioContextState: context?.state || 'closed', status: $('status').textContent };
}
const debug = createDebugPanel(debugSnapshot);
try { history = JSON.parse(localStorage.getItem('hafizassist-history') || '[]'); if (!Array.isArray(history)) history = []; } catch {}
try { document.body.classList.toggle('dark', localStorage.getItem('hafizassist-theme') === 'dark'); } catch {}


function status(message, error = false) {
  if (voiceSearch) { $('voice-status').textContent = message; $('voice-status').classList.toggle('error', error); }
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  // Keep routine practice messages out of the reading area, but surface problems and setup progress.
  $('status').hidden = voiceSearch || !(error || ['loading', 'starting'].includes(phase));
}
function locked() { return ['loading', 'starting', 'recording', 'stopping'].includes(phase); }
function controls() {
  const busy = ['loading', 'starting', 'stopping'].includes(phase);
  $('voice-open').disabled = !chapter || locked();
  $('voice-close').disabled = voiceSearch && busy;
  $('voice-record').disabled = busy;
  $('voice-record').textContent = phase === 'recording' ? 'Find verse' : busy ? 'Please wait…' : 'Start voice search';
  $('voice-record').classList.toggle('listening', voiceSearch && phase === 'recording');
  for (const id of ['search', 'search-go', 'surah']) $(id).disabled = locked() || !chapter;
  $('previous-page').disabled = locked() || currentPage <= 1;
  $('next-page').disabled = locked() || currentPage >= 604;
  $('record').disabled = !chapter || ['loading', 'starting', 'stopping'].includes(phase);
  $('reset').disabled = ['loading', 'starting', 'stopping'].includes(phase);
  $('record').classList.toggle('recording', phase === 'recording');
  const recordLabel = ({ loading: 'Loading model…', starting: 'Opening microphone…', recording: 'Stop reciting', stopping: 'Finishing…' })[phase] || 'Start reciting';
  $('record').setAttribute('aria-label', recordLabel);
  $('record').title = recordLabel;
  $('record').setAttribute('aria-pressed', String(phase === 'recording'));
  $('record').setAttribute('aria-busy', String(['loading', 'starting', 'stopping'].includes(phase)));
}

function formatTime(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
setInterval(() => { $('time').textContent = formatTime(elapsed + (startedAt ? (Date.now() - startedAt) / 1000 : 0)); }, 500);

function paint() {
  let matched = 0, review = 0;
  for (let i = 0; i < elements.length; i++) {
    const state = states[i] || '';
    const concealed = memoryMode && !state;
    elements[i].className = `word ${state} ${i === cursor ? 'next' : ''} ${concealed ? 'concealed' : ''}`;
    elements[i].setAttribute('aria-label', concealed ? `Hidden word ${words[i].position + 1}, ayah ${words[i].ayah}. Select to resume here.` : `${words[i].accessible} — ${state === 'review' ? 'needs review' : state || 'upcoming'}. Select to resume here.`);
    if (state === 'matched') matched++;
    if (state === 'review') review++;
  }
  const percentage = words.length ? Math.round((matched + review) / words.length * 100) : 0;
  $('matched').textContent = completedMatched + matched;
  $('mistakes').textContent = completedReview + review;
  $('progress').value = percentage;
  $('percent').textContent = `${percentage}%`;
  if (words[cursor]) { chapter = chapters.find(c => c.id === words[cursor].surah); $('surah').value = String(chapter.id); }
  const currentAyah = words[cursor] && `${words[cursor].surah}:${words[cursor].ayah}`;
  document.querySelectorAll('.ayah').forEach(row => row.classList.toggle('current', row.dataset.key === currentAyah));
  const currentPosition = currentAyah && `${currentPage}:${cursor}`;
  if (currentPosition && currentPosition !== lastFollowedAyah && phase === 'recording') {
    followWord();
  }
  lastFollowedAyah = currentPosition;
}

function followWord(force = false) {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const element = elements[cursor];
    if (!element || $('voice-dialog').open) return;
    const word = element.getBoundingClientRect();
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    // The Mushaf grows with its text; only the document scrolls.
    if (force || word.top < 48 || word.bottom > innerHeight - 64) {
      window.scrollBy({ top: word.top - innerHeight / 3, behavior });
    }
  });
}
function appendWord(row, word, text) {
  const index = words.length; words.push(word);
  const button = document.createElement('button');
  button.className = 'word'; button.textContent = text; button.type = 'button';
  wordInfo.bind(button, index);
  button.addEventListener('click', () => {
    if (locked()) { status('Stop reciting before choosing a different starting word.'); return; }
    cursor = index; segmentStart = index; segmentCarry = '';
    alignmentAnchor = null;
    pageBoundary = null;
    lastAdvanceAt = Date.now(); debug.log('word-selected', { expected: debugWord(index) });
    states = states.map((state, i) => i < index ? state : undefined); committed = [...states];
    reviewDetails = reviewDetails.map((detail, i) => i < index ? detail : undefined);
    savedThisRun = false; paint();
    status(word.bismillah ? 'Ready from the opening Bismillah.' : `Ready from ayah ${word.surah}:${word.ayah}, word ${word.position + 1}.`);
  });
  row.append(button, document.createTextNode(' ')); elements.push(button);
}

function renderPassage(continuing = false) {
  wordInfo.hide();
  $('ayahs').replaceChildren(); words = []; elements = [];
  $('ayahs').classList.toggle('opening-page', currentPage <= 2);
  $('page-label').textContent = `Page ${currentPage}`;
  const verses = chapters.flatMap(c => c.verses).filter(v => layouts[verseKey(v)][1].some(([page]) => page === currentPage));
  const lines = new Map();
  function pageLine(line) {
    if (!lines.has(line)) {
      const row = document.createElement('div'); row.className = 'mushaf-line'; row.lang = 'ar'; row.dir = 'rtl';
      lines.set(line, row); $('ayahs').append(row);
    }
    return lines.get(line);
  }
  for (const verse of verses) {
    const layout = layouts[verseKey(verse)][1];
    if (verse.ayah === 1 && layout[0][0] === currentPage) {
      const heading = document.createElement('h3'); heading.className = 'mushaf-surah-header'; heading.lang = 'ar'; heading.dir = 'rtl';
      heading.textContent = `سورة ${chapters.find(c => c.id === verse.surah).ar}`; $('ayahs').append(heading);
      // Al-Fatihah already includes Bismillah as 1:1; At-Tawbah has no opening Bismillah.
      if (![1, 9].includes(verse.surah)) {
        const row = document.createElement('div');
        row.className = 'bismillah-line'; row.lang = 'ar'; row.dir = 'rtl';
        const opening = chapters[0].verses[0];
        const text = ['بِسْمِ', 'اللَّهِ', 'الرَّحْمَٰنِ', 'الرَّحِيمِ'];
        opening.aya_phonemes_list.forEach((phoneme, position) => {
          appendWord(row, { surah: verse.surah, ayah: 1, position, bismillah: true,
            phoneme: normalize(phoneme), accessible: text[position], rules: opening.wordRules[position] }, text[position]);
        });
        $('ayahs').append(row);
      }
    }
    // Preserve the source's exact per-word glyph and phoneme mapping.
    const glyphs = verse.aya_ui.trim().split(/\s+/u); glyphs.pop();
    const readable = verse.aya_text.trim().split(/\s+/u);
    verse.aya_phonemes_list.forEach((phoneme, position) => {
      if (layout[position][0] !== currentPage) return;
      appendWord(pageLine(layout[position][1]), { surah: verse.surah, ayah: verse.ayah, position,
        phoneme: normalize(phoneme), accessible: readable[position] || `Word ${position + 1}`, rules: verse.wordRules[position]
      }, glyphs[position] || readable[position] || '…');
    });
    if (layout.at(-1)[0] === currentPage) {
      const number = document.createElement('span'); number.className = 'ayah-number';
      number.textContent = arabicNumber.format(verse.ayah); number.setAttribute('aria-label', `Ayah ${verse.ayah}`);
      pageLine(layout.at(-1)[1]).append(number);
    }
  }
  const pageChapters = [...new Set(verses.map(v => v.surah))].map(id => chapters.find(c => c.id === id));
  $('surah-ar').textContent = pageChapters.map(c => c.ar).join(' · ');
  $('surah-title').textContent = `Juz ${layouts[verseKey(verses[0])][0]} · Page ${currentPage} of 604`;
  $('passage-label').textContent = `PAGE ${currentPage} · ${pageChapters.map(c => c.en).join(' / ')}`;
  if (continuing) {
    states = new Array(words.length); committed = [...states]; reviewDetails = [];
    cursor = 0; segmentStart = 0; lastFollowedAyah = null; paint();
  } else resetSession();
  $('ayahs').scrollTop = 0; controls(); fitMushafLines();
}
function fitMushafLines() {
  // Keep one readable size. Longer lines wrap instead of silently shrinking the font.
  $('ayahs').style.setProperty('--quran-size', `${fontSize}px`);
  $('font-smaller').disabled = fontSize <= 24;
  $('font-larger').disabled = fontSize >= 56;
}
function changeFontSize(delta) {
  wordInfo.hide();
  fontSize = Math.max(24, Math.min(56, fontSize + delta));
  try { localStorage.setItem('hafizassist-font-size', String(fontSize)); } catch {}
  fitMushafLines();
  if (phase === 'recording') followWord(true);
}
$('font-smaller').addEventListener('click', () => changeFontSize(-2));
$('font-larger').addEventListener('click', () => changeFontSize(2));
function fontLayoutReady() {
  fitMushafLines();
  if (cursor > 0 || phase === 'recording') followWord(true);
}
document.fonts.ready.then(fontLayoutReady);
document.fonts.addEventListener('loadingdone', fontLayoutReady);
function resetSession() {
  pageBoundary = null;
  wordInfo.hide(); reviewDetails = []; completedMatched = 0; completedReview = 0; completedPages = 0; firstPracticePage = currentPage;
  alignmentAnchor = null;
  debug.log('reset', { page: currentPage });
  lastRecognitionAt = 0; lastAdvanceAt = 0; lastTranscript = ''; audioDiagnostic = {};
  states = new Array(words.length); committed = [...states]; cursor = 0; segmentStart = 0;
  segmentCarry = '';
  elapsed = 0; startedAt = 0; savedThisRun = false; lastFollowedAyah = null;
  $('time').textContent = '00:00'; paint();
  status('Choose a passage, then start when you’re ready.');
}
function focusVerse(key) {
  pageBoundary = null;
  alignmentAnchor = null;
  const index = words.findIndex(w => `${w.surah}:${w.ayah}` === key);
  if (index < 0) return;
  cursor = index; segmentStart = index; paint();
  debug.log('verse-selected', { key, expected: debugWord(index) });
  followWord(true);
  status(words[index].bismillah ? 'Begin with Bismillah, then continue into the surah.' : `Ready from ayah ${key}.`);
}

function openPage(page, targetKey) {
  if (locked()) return;
  if (!Number.isInteger(page) || page < 1 || page > 604) { status('Enter a page number from 1 to 604.', true); return; }
  const firstVerse = chapters.flatMap(c => c.verses).find(v => targetKey ? verseKey(v) === targetKey : layouts[verseKey(v)][1].some(([p]) => p === page));
  chapter = chapters.find(c => c.id === firstVerse.surah);
  $('surah').value = String(chapter.id);
  currentPage = page; renderPassage();
  if (targetKey) focusVerse(targetKey);
  else followWord(true);
}
const searchName = value => value.normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670ـ]/g, '').replace(/[أإآٱ]/g, 'ا').toLowerCase().replace(/[^\p{L}\p{N}:]/gu, '');
function searchPassage(event) {
  event.preventDefault(); if (locked() || !chapter) return;
  const value = $('search').value.trim()
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
  if (/^\d+$/.test(value)) { openPage(Number(value)); return; }
  const key = value.match(/^(\d+)\s*:\s*(\d+)$/);
  const surah = value.match(/^s\s*(\d+)$/i);
  if (key) {
    const normalized = `${Number(key[1])}:${Number(key[2])}`;
    if (layouts[normalized]) { openPage(layouts[normalized][1][0][0], normalized); return; }
  } else {
    const query = searchName(value);
    const found = surah ? chapters.find(c => c.id === Number(surah[1]))
      : ['yasin', 'yaseen', 'يس'].includes(query) ? chapters.find(c => c.id === 36)
      : chapters.find(c => searchName(c.en) === query || searchName(c.ar) === query)
        || (query.length > 1 && chapters.find(c => searchName(c.en).includes(query) || searchName(c.ar).includes(query)));
    if (found) { openPage(layouts[`${found.id}:1`][1][0][0], `${found.id}:1`); return; }
  }
  status('Try a page (4), chapter (s 2), verse (2:255), or surah name (Yasin / يس).', true);
}

function renderHistory() {
  $('history-list').replaceChildren();
  if (!history.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Your completed practice sessions will appear here.'; $('history-list').append(p); return; }
  for (const item of history.slice(0, 8)) {
    const row = document.createElement('div'); row.className = 'history-item';
    const name = document.createElement('div'); name.textContent = item.passage || `${item.surah} · ${item.from}–${item.to}`;
    const detail = document.createElement('span'); detail.textContent = `${item.matched} matched · ${formatTime(item.seconds)} · ${new Date(item.date).toLocaleDateString()}`;
    row.append(name, detail); $('history-list').append(row);
  }
}
function saveSession() {
  if (savedThisRun || elapsed < 1) return;
  savedThisRun = true;
  const entry = { surah: chapter.en, from: words[0]?.ayah, to: words.at(-1)?.ayah, matched: completedMatched + states.filter(s => s === 'matched').length, review: completedReview + states.filter(s => s === 'review').length, seconds: elapsed, date: new Date().toISOString() };
  entry.passage = completedPages ? `Pages ${firstPracticePage} → ${currentPage} · ${completedPages} completed` : $('passage-label').textContent;
  history.unshift(entry); history = history.slice(0, 30);
  try { localStorage.setItem('hafizassist-history', JSON.stringify(history)); } catch { status('Session finished. Browser storage is unavailable, so history cannot be saved.'); }
  renderHistory();
}

function createWorker() {
  worker = new Worker(new URL('../recognizer-worker.js', import.meta.url));
  worker.onerror = () => failEngine('The speech worker could not start. Reload the page using localhost or HTTPS.');
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') { status(data.message); $('download').value = data.value; return; }
    if (data.type === 'ready') {
      debug.log('engine-ready');
      clearTimeout(workerTimer); engineReady = true; $('download').hidden = true; $('model-picker').hidden = true;
      engineResolve?.(); engineResolve = null;
      void refreshOfflineStatus(); return;
    }
    if (data.type === 'error') {
      clearTimeout(workerTimer);
      void failEngine(data.message);
      return;
    }
    if (data.sessionId !== sessionId) return;
    if (data.type === 'started') { startResolve?.(); startResolve = null; }
    if (data.type === 'ack') {
      pendingChunks = Math.max(0, pendingChunks - 1);
      audioDiagnostic = { processMs: data.processMs, audioMs: data.audioMs, rms: data.rms, peak: data.peak,
        receivedAt: Date.now(), maxProcessMs: Math.max(audioDiagnostic.maxProcessMs || 0, data.processMs || 0),
        maxPendingChunks: Math.max(audioDiagnostic.maxPendingChunks || 0, pendingChunks) };
      if (Date.now() - lastAudioLogAt >= 1000) {
        lastAudioLogAt = Date.now();
        debug.log('audio', { ...audioDiagnostic, pendingChunks,
          sinceRecognitionMs: lastRecognitionAt ? Date.now() - lastRecognitionAt : null,
          sinceAdvanceMs: lastAdvanceAt ? Date.now() - lastAdvanceAt : null });
      }
    }
    if (data.type === 'result' && ['recording', 'stopping'].includes(phase)) {
      if (voiceSearch) {
        if (data.final) voiceText = (voiceText + data.text).slice(-2000);
        $('voice-status').textContent = 'Listening. Recite a few distinctive words, then press Find verse.';
        if (!data.final) lastTranscript = data.text;
        else lastTranscript = '';
      } else handleRecognition(data);
    }
    if (data.type === 'finished') { finishResolve?.(); finishResolve = null; }
  };
}
function handleRecognition(data) {
  while (true) {

      lastRecognitionAt = Date.now(); lastTranscript = data.text.slice(-6000);
      const cursorBefore = cursor, segmentBefore = segmentStart, carryBefore = segmentCarry;
      const matchingBegan = performance.now();
      const heard = normalize(segmentCarry + data.text);
      const hadAnchor = alignmentAnchor !== null;
      const boundary = alignmentAnchor?.cursor === cursor ? locateTranscriptBoundary(alignmentAnchor, heard) : null;
      const pageOffset = pageBoundary ? locateTranscriptBoundary(pageBoundary, heard) : null;
      if (pageBoundary && pageOffset === null && boundary === null) {
        debug.log('page-boundary-revised', { page: currentPage, final: data.final });
        // Never search an earlier page's audio as if it belongs to the new page.
        if (data.final) { pageBoundary = null; alignmentAnchor = null; segmentStart = cursor; segmentCarry = ''; }
        return;
      }
      const inputOffset = boundary ?? pageOffset ?? 0;
      const inputStart = boundary === null ? segmentStart : cursor;
      const match = alignSegment(words, inputStart, heard.slice(inputOffset), 'balanced', data.final);
      const matchingMs = performance.now() - matchingBegan;
      // CTC can revise an earlier part of its cumulative hypothesis. Once a
      // word has advanced the visible cursor, that revision must not rewind
      // the reading position or erase completed highlights.
      const caughtUp = match.cursor >= cursor;
      if (caughtUp) {
        for (const result of match.results) {
          if (result.index >= cursor) { states[result.index] = result.state; reviewDetails[result.index] = result.detail; }
        }
        cursor = match.cursor;
      }
      if (cursor > cursorBefore) {
        lastAdvanceAt = Date.now();
        alignmentAnchor = { heard, offset: inputOffset + match.consumed, cursor };
      }
      debug.log('recognition', {
        sessionId, final: data.final, transcript: lastTranscript, transcriptLength: data.text.length,
        normalizedTranscript: heard.slice(-6000), carryBefore, segmentBefore,
        inputStart, inputOffset, boundaryReused: boundary !== null,
        anchorFallback: hadAnchor && boundary === null,
        cursorBefore, candidateCursor: match.cursor, cursorAfter: cursor,
        noRewindGuardHeld: !caughtUp, matchingMs, consumed: match.consumed,
        changes: match.results.slice(-40), expected: debugWord(cursor), candidateBlockedWord: debugWord(match.cursor),
        sinceAdvanceMs: lastAdvanceAt ? Date.now() - lastAdvanceAt : null,
        diagnostic: match.diagnostic,
      });
      if (cursor >= words.length && phase === 'recording') {
        const nextOffset = inputOffset + match.consumed;
        completedMatched += states.filter(s => s === 'matched').length;
        completedReview += states.filter(s => s === 'review').length;
        completedPages++;
        debug.log('auto-page-turn', { from: currentPage, to: currentPage === 604 ? 1 : currentPage + 1, nextOffset });
        currentPage = currentPage === 604 ? 1 : currentPage + 1;
        renderPassage(true);
        // Keep the same audio stream and cumulative transcript. Reuse any
        // already-decoded words beyond this page immediately, even on a final result.
        alignmentAnchor = { heard, offset: nextOffset, cursor: 0 };
        pageBoundary = { heard, offset: nextOffset };
        status(`Listening · continued to page ${currentPage}.`);
        continue;
      }
      if (data.final) {
        pageBoundary = null;
        committed = [...states]; segmentStart = cursor;
        // Carry only audio aligned at the current frontier. A regressed final
        // hypothesis contains old verse audio, not a new unfinished word.
        segmentCarry = caughtUp ? match.heard.slice(match.consumed).slice(-192) : '';
        alignmentAnchor = null;
      }
      paint();
      break;
    
  }
}

function loadEngine(file) {
  if (!worker) createWorker();
  phase = 'loading'; $('download').hidden = false; $('download').value = 0; $('model-picker').hidden = true; controls();
  return new Promise((resolve, reject) => {
    engineResolve = error => error ? reject(error) : resolve();
    workerTimer = setTimeout(() => failEngine('Model loading timed out. Try again or reload the page.'), 180000);
    worker.postMessage({ type: 'init', file });
  });
}

async function releaseAudio() {
  cancelAnimationFrame(animation);
  media?.getTracks().forEach(track => track.stop()); media = null;
  if (capture) capture.port.onmessage = null;
  capture?.disconnect(); source?.disconnect(); mute?.disconnect(); analyser?.disconnect();
  capture = null; source = null; mute = null; analyser = null;
  if (context && context.state !== 'closed') await context.close().catch(() => {});
  context = null;
  $('record').style.removeProperty('--voice-glow');
}
async function failEngine(message) {
  debug.log('engine-error', { message, snapshot: debugSnapshot() });
  phase = 'stopping'; controls();
  clearTimeout(workerTimer); worker?.terminate(); worker = null; engineReady = false;
  if (startedAt) { elapsed += (Date.now() - startedAt) / 1000; startedAt = 0; }
  startResolve?.(new Error(message)); startResolve = null;
  finishResolve?.(new Error(message)); finishResolve = null;
  flushResolve?.(); flushResolve = null;
  await releaseAudio();
  engineResolve?.(new Error(message)); engineResolve = null;
  phase = 'idle'; $('download').hidden = true; $('model-picker').hidden = false;
  status(message, true); controls();
}

function animateLevel() {
  if (!analyser) return;
  const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value - 128) / 128);
  $('record').style.setProperty('--voice-glow', `${5 + Math.min(15, peak * 60)}px`);
  animation = requestAnimationFrame(animateLevel);
}

async function startRecording(file) {
  if (phase !== 'idle') return;
  debug.log('start-request', { page: currentPage, cursor, engineReady });
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { status('This browser does not support microphone tracking. Use a recent Chrome, Edge, Firefox, or Safari on HTTPS.', true); return; }
  if (!voiceSearch && cursor >= words.length) resetSession();
  phase = 'starting'; controls(); status('Allow microphone access to begin.');
  let micTimer;
  try {
    context = new AudioContext();
    await context.resume();
    // Resume from the original click, then await initialization in this same flow.
    if (!engineReady) await loadEngine(file);
    phase = 'starting'; controls(); status('Allow microphone access to begin.');
    const request = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    let abandoned = false;
    request.then(value => { if (abandoned) value.getTracks().forEach(track => track.stop()); }, () => {});
    try {
      media = await Promise.race([request, new Promise((_, reject) => { micTimer = setTimeout(() => { abandoned = true; reject(new Error('Microphone permission timed out. Allow access, then try again.')); }, 45000); })]);
    } finally { clearTimeout(micTimer); }
    const settings = media.getAudioTracks()[0].getSettings();
    micSettings = { sampleRate: settings.sampleRate, channelCount: settings.channelCount,
      echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression,
      autoGainControl: settings.autoGainControl, contextSampleRate: context.sampleRate };
    await context.audioWorklet.addModule(new URL('../audio-worklet.js', import.meta.url));
    capture = new AudioWorkletNode(context, 'recitation-capture');
    source = context.createMediaStreamSource(media); analyser = context.createAnalyser(); analyser.fftSize = 512;
    mute = context.createGain(); mute.gain.value = 0;
    sessionId++; pendingChunks = 0; segmentStart = cursor; committed = [...states]; segmentCarry = '';
    pageBoundary = null;
    alignmentAnchor = null;
    lastRecognitionAt = 0; lastTranscript = ''; lastAdvanceAt = Date.now(); lastAudioLogAt = 0; audioDiagnostic = {};
    debug.log('session-start', { sessionId, expected: debugWord(cursor), micSettings });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { startResolve = null; reject(new Error('The speech engine did not start. Please retry.')); }, 15000);
      startResolve = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
      worker.postMessage({ type: 'start', sessionId });
    });
    capture.port.onmessage = ({ data }) => {
      if (data.flushed) { flushResolve?.(); flushResolve = null; return; }
      if (!data.samples || !worker || !['recording', 'stopping'].includes(phase)) return;
      pendingChunks++;
      if (pendingChunks > 30) { failEngine('This device is processing audio too slowly. Close other tabs, then try a shorter passage.'); return; }
      worker.postMessage({ type: 'audio', samples: data.samples, sessionId }, [data.samples.buffer]);
    };
    media.getAudioTracks()[0].onended = () => { if (phase === 'recording') void stopRecording(); };
    source.connect(analyser); source.connect(capture); capture.connect(mute); mute.connect(context.destination);
    phase = 'recording'; if (!voiceSearch) { startedAt = Date.now(); savedThisRun = false; } controls(); animateLevel();
    status(voiceSearch ? 'Recite any passage, then press Find verse.' : 'Listening. Recite the highlighted passage at your own pace.');
  } catch (error) {
    debug.log('start-error', { name: error.name, message: error.message });
    await releaseAudio(); phase = 'idle'; controls();
    const messages = { NotAllowedError: 'Microphone access was denied. Allow it in your browser’s site settings, then try again.', NotFoundError: 'No microphone was found. Connect one, then try again.', NotReadableError: 'The microphone is busy or unavailable. Close other apps using it, then retry.' };
    status(messages[error.name] || error.message, true);
  }
}

async function stopRecording() {
  if (stopPromise) return stopPromise;
  if (phase !== 'recording') return;
  debug.log('stop-request', { snapshot: debugSnapshot() });
  phase = 'stopping'; controls();
  if (!voiceSearch) { elapsed += (Date.now() - startedAt) / 1000; startedAt = 0; }
  stopPromise = (async () => {
    try {
      if (capture) await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        flushResolve = () => { clearTimeout(timer); resolve(); };
        capture.port.postMessage('flush');
      });
      await releaseAudio();
      if (!worker) return;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { finishResolve = null; reject(new Error('Finishing recognition timed out. Your microphone is off. Please reload.')); }, 20000);
        finishResolve = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
        worker.postMessage({ type: 'finish', sessionId });
      });
      phase = 'idle'; controls();
      status(cursor >= words.length ? 'You reached the end of your passage. Take a moment to revisit any highlighted words.' : 'Session paused. Start again to continue, or select a word to revisit it.');
      if (voiceSearch) findVoiceVerse();
      else saveSession();
    } catch (error) { failEngine(error.message); }
    finally { stopPromise = null; }
  })();
  return stopPromise;
}

function findVoiceVerse() {
  const text = voiceText + lastTranscript;
  if (!text.trim()) { status('No speech recognized. Try again and recite several words.', true); return; }
  if (!searchWorker) {
    searchWorker = new Worker(new URL('./voice-search-worker.js', import.meta.url), { type: 'module' });
    searchWorker.postMessage({ type: 'init', verses: chapters.flatMap(c => c.verses).map(v => ({ key: verseKey(v), phonemes: v.aya_phonemes_list })) });
    searchWorker.onerror = () => { clearTimeout(searchTimer); searchWorker?.terminate(); searchWorker = null; if (voiceSearch) status('Voice search could not load. Please try again.', true); };
    searchWorker.onmessage = ({ data }) => {
      if (!voiceSearch || data.id !== searchRequest) return;
      clearTimeout(searchTimer);
      if (data.error) { status(data.error, true); return; }
      $('voice-results').replaceChildren();
      if (!data.results.length) { status(data.short ? 'Recite a longer phrase so we can locate the verse.' : 'No close match found. Try a longer, distinctive passage.', true); return; }
      status('Select your verse. Similar passages may appear in several places.');
      for (const result of data.results) {
        const [surah, ayah] = result.key.split(':').map(Number);
        const ch = chapters.find(c => c.id === surah), verse = ch.verses.find(v => v.ayah === ayah);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'voice-result';
        const label = document.createElement('span'); label.textContent = `${result.key} · ${ch.en} — ${ch.ar}`;
        const text = document.createElement('span'); text.lang = 'ar'; text.dir = 'rtl'; text.textContent = verse.aya_text;
        button.append(label, text); button.onclick = () => openVoiceResult(result); $('voice-results').append(button);
      }
      if (data.results[0].score >= .88 && (!data.results[1] || data.results[0].score - data.results[1].score > .09)) openVoiceResult(data.results[0]);
    };
  }
  status('Searching the whole Quran on this device…');
  const id = ++searchRequest;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { if (id !== searchRequest) return; searchRequest++; searchWorker?.terminate(); searchWorker = null; status('Search took too long. Please try a shorter phrase.', true); }, 30000);
  searchWorker.postMessage({ type: 'search', id, text });
}
function openVoiceResult(result) {
  if (locked()) return;
  voiceSearch = false; searchRequest++; clearTimeout(searchTimer); $('voice-dialog').close();
  const page = layouts[result.key][1][result.word]?.[0] || layouts[result.key][1][0][0];
  openPage(page, result.key);
  const index = words.findIndex(w => !w.bismillah && `${w.surah}:${w.ayah}` === result.key && w.position === result.word);
  if (index >= 0) { cursor = index; segmentStart = index; paint(); followWord(true); }
  status(`Found ayah ${result.key}. Start reciting to continue from the highlighted word.`);
}
$('voice-open').addEventListener('click', () => {
  if (locked()) return;
  voiceSearch = true; voiceText = ''; lastTranscript = ''; $('voice-results').replaceChildren();
  $('voice-dialog').showModal(); controls();
  status('Recite a few words from anywhere in the Quran. We will find the passage on this device.');
});
$('voice-record').addEventListener('click', async () => {
  if (phase === 'recording') { await stopRecording(); return; }
  if (phase !== 'idle') return;
  voiceText = ''; lastTranscript = ''; searchRequest++; clearTimeout(searchTimer); $('voice-results').replaceChildren();
  await startRecording();
});
async function closeVoiceSearch() {
  if (['loading', 'starting', 'stopping'].includes(phase)) return;
  if (phase === 'recording') await stopRecording();
  voiceSearch = false; searchRequest++; clearTimeout(searchTimer); $('voice-dialog').close(); controls();
  status('Voice search closed. Your practice position is unchanged.');
}
$('voice-close').addEventListener('click', closeVoiceSearch);
$('voice-dialog').addEventListener('cancel', event => { event.preventDefault(); void closeVoiceSearch(); });

$('record').addEventListener('click', () => phase === 'recording' ? void stopRecording() : void startRecording());
$('model-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) void startRecording(file); event.target.value = ''; });
$('reset').addEventListener('click', async () => { await stopRecording(); resetSession(); });
$('previous-page').addEventListener('click', () => openPage(currentPage - 1));
$('next-page').addEventListener('click', () => openPage(currentPage + 1));
$('search-form').addEventListener('submit', searchPassage);
$('surah').addEventListener('change', () => {
  if (locked()) return;
  const key = `${$('surah').value}:1`;
  if (layouts[key]) openPage(layouts[key][1][0][0], key);
});
$('visibility').addEventListener('click', () => {
  wordInfo.hide();
  memoryMode = !memoryMode;
  const button = $('visibility');
  button.setAttribute('aria-pressed', String(memoryMode));
  button.title = memoryMode ? 'Show all Quran text' : 'Hide upcoming words';
  button.setAttribute('aria-label', button.title);
  $('eye-open').hidden = memoryMode;
  $('eye-closed').hidden = !memoryMode;
  paint();
});
$('theme').addEventListener('click', () => { const dark = document.body.classList.toggle('dark'); try { localStorage.setItem('hafizassist-theme', dark ? 'dark' : 'light'); } catch {} });
window.addEventListener('pagehide', () => { media?.getTracks().forEach(track => track.stop()); worker?.terminate(); void context?.close(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'recording') void stopRecording(); });

async function init() {
  renderHistory();
  try {
    const response = await fetch(new URL('../data/quran.json', import.meta.url));
    if (!response.ok) throw new Error('Quran reference data could not be loaded. Reload the page to try again.');
    const data = await response.json();
    const layoutResponse = await fetch(new URL('../data/mushaf-layout.json', import.meta.url));
    if (!layoutResponse.ok) throw new Error('Mushaf page data could not be loaded. Reload the page to try again.');
    layouts = await layoutResponse.json();
    const map = new Map();
    for (const [key, verse] of Object.entries(data.verses)) {
      const [surah, ayah] = key.split(':').map(Number);
      if (!map.has(surah)) map.set(surah, { id: surah, en: verse.suraname_en, ar: verse.suraname_ar, verses: [] });
      map.get(surah).verses.push({ ...verse, surah, ayah, wordRules: wordRules(verse, data.rule_names) });
    }
    chapters = [...map.values()].sort((a, b) => a.id - b.id);
    chapters.forEach(c => c.verses.sort((a, b) => a.ayah - b.ayah));
    $('surah').replaceChildren(...chapters.map(c => new Option(`${c.id}. ${c.en} — \u2067${c.ar}\u2069`, String(c.id))));
    openPage(1);
    cancelAnimationFrame(scrollFrame); // Keep the controls visible on initial load.
  } catch (error) { $('ayahs').textContent = 'Unable to load the Quran passage.'; status(error.message, true); }
}
void init();
void setupOffline();
