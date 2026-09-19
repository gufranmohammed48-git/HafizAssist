import { alignSegment, normalize } from './alignment.js';
import { setupOffline, refreshOfflineStatus } from './offline.js';

const $ = id => document.getElementById(id);
const arabicNumber = new Intl.NumberFormat('ar', { useGrouping: false });
let chapters = [], words = [], elements = [], states = [], committed = [];
let chapter, cursor = 0, segmentStart = 0, phase = 'idle', engineReady = false;
let segmentCarry = '';
let worker, sessionId = 0, pendingChunks = 0, workerTimer;
let media, context, source, capture, analyser, mute, animation, flushResolve;
let finishResolve, startResolve, stopPromise;
let elapsed = 0, startedAt = 0, memoryMode = false, revealed = false, fontSize = 34;
let lastFollowedAyah = null, savedThisRun = false;
let history = [];
try { history = JSON.parse(localStorage.getItem('hafizassist-history') || '[]'); if (!Array.isArray(history)) history = []; } catch {}
try { document.body.classList.toggle('dark', localStorage.getItem('hafizassist-theme') === 'dark'); } catch {}

const bars = Array.from({ length: 40 }, () => { const bar = document.createElement('i'); $('waveform').append(bar); return bar; });
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function locked() { return ['loading', 'starting', 'recording', 'stopping'].includes(phase); }
function controls() {
  for (const id of ['surah', 'from', 'to', 'sensitivity']) $(id).disabled = locked() || !chapter;
  $('record').disabled = !chapter || ['loading', 'starting', 'stopping'].includes(phase);
  $('reset').disabled = ['loading', 'starting', 'stopping'].includes(phase);
  $('record').classList.toggle('recording', phase === 'recording');
  $('record-label').textContent = ({ loading: 'Loading model…', starting: 'Opening microphone…', recording: 'Stop reciting', stopping: 'Finishing…' })[phase] || 'Start reciting';
  $('reader-state').textContent = phase === 'recording' ? 'LISTENING TO YOUR RECITATION' : 'READY WHEN YOU ARE';
}

function formatTime(seconds) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
setInterval(() => { $('time').textContent = formatTime(elapsed + (startedAt ? (Date.now() - startedAt) / 1000 : 0)); }, 500);

function paint() {
  let matched = 0, review = 0;
  for (let i = 0; i < elements.length; i++) {
    const state = states[i] || '';
    const concealed = memoryMode && !revealed && state !== 'matched';
    elements[i].className = `word ${state} ${i === cursor ? 'next' : ''} ${concealed ? 'concealed' : ''}`;
    elements[i].setAttribute('aria-label', concealed ? `Hidden word ${words[i].position + 1}, ayah ${words[i].ayah}. Select to resume here.` : `${words[i].accessible} — ${state === 'review' ? 'needs review' : state || 'upcoming'}. Select to resume here.`);
    if (state === 'matched') matched++;
    if (state === 'review') review++;
  }
  const percentage = words.length ? Math.round((matched + review) / words.length * 100) : 0;
  $('matched').textContent = matched;
  $('progress').value = percentage;
  $('percent').textContent = `${percentage}%`;
  $('progress-hint').textContent = review ? `${review} word${review === 1 ? '' : 's'} to revisit. Select a word to try again.` : matched ? `${matched} of ${words.length} words matched.` : 'One ayah at a time.';
  const currentAyah = words[cursor]?.ayah;
  document.querySelectorAll('.ayah').forEach(row => row.classList.toggle('current', Number(row.dataset.ayah) === currentAyah));
  if ($('follow').checked && currentAyah && currentAyah !== lastFollowedAyah && phase === 'recording') {
    const row = elements[cursor].parentElement;
    const container = $('ayahs');
    const top = row.offsetTop;
    container.scrollTo({ top: Math.max(0, top - container.clientHeight / 3), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  lastFollowedAyah = currentAyah;
}

function renderPassage() {
  $('ayahs').replaceChildren(); words = []; elements = [];
  const first = Number($('from').value), last = Number($('to').value);
  for (const verse of chapter.verses.filter(v => v.ayah >= first && v.ayah <= last)) {
    const row = document.createElement('div'); row.className = 'ayah'; row.dataset.ayah = verse.ayah; row.lang = 'ar'; row.dir = 'rtl';
    // HafsSmart glyphs preserve the source's exact per-word text mapping.
    const glyphs = verse.aya_ui.trim().split(/\s+/u); glyphs.pop();
    const readable = verse.aya_text.trim().split(/\s+/u);
    verse.aya_phonemes_list.forEach((phoneme, position) => {
      const index = words.length;
      const word = { ayah: verse.ayah, position, phoneme: normalize(phoneme), accessible: readable[position] || `Word ${position + 1}` };
      words.push(word);
      const button = document.createElement('button'); button.className = 'word'; button.textContent = glyphs[position] || readable[position] || '…'; button.type = 'button';
      button.addEventListener('click', () => {
        if (locked()) { status('Stop reciting before choosing a different starting word.'); return; }
        cursor = index; segmentStart = index; segmentCarry = '';
        states = states.map((state, i) => i < index ? state : undefined); committed = [...states];
        savedThisRun = false; paint(); status(`Ready from ayah ${word.ayah}, word ${word.position + 1}.`);
      });
      row.append(button, document.createTextNode(' ')); elements.push(button);
    });
    const number = document.createElement('span'); number.className = 'ayah-number'; number.textContent = arabicNumber.format(verse.ayah); number.setAttribute('aria-label', `Ayah ${verse.ayah}`); row.append(number); $('ayahs').append(row);
  }
  $('surah-ar').textContent = chapter.ar;
  $('surah-title').textContent = `${chapter.en} · ${chapter.verses.length} ayahs`;
  $('passage-label').textContent = `SURAH ${chapter.id} · AYAHS ${first}–${last}`;
  resetSession(); $('ayahs').scrollTop = 0;
}
function resetSession() {
  states = new Array(words.length); committed = [...states]; cursor = 0; segmentStart = 0;
  segmentCarry = '';
  elapsed = 0; startedAt = 0; savedThisRun = false; lastFollowedAyah = null;
  $('time').textContent = '00:00'; paint();
  status('Choose a passage, then start when you’re ready.');
}
function selectChapter() {
  chapter = chapters.find(c => c.id === Number($('surah').value));
  for (const id of ['from', 'to']) {
    $(id).replaceChildren(...chapter.verses.map(v => new Option(String(v.ayah), String(v.ayah))));
  }
  $('from').value = '1'; $('to').value = String(Math.min(chapter.verses.length, 10));
  renderPassage(); controls();
}

function renderHistory() {
  $('history-list').replaceChildren();
  if (!history.length) { const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Your completed practice sessions will appear here.'; $('history-list').append(p); return; }
  for (const item of history.slice(0, 8)) {
    const row = document.createElement('div'); row.className = 'history-item';
    const name = document.createElement('div'); name.textContent = `${item.surah} · ${item.from}–${item.to}`;
    const detail = document.createElement('span'); detail.textContent = `${item.matched} matched · ${formatTime(item.seconds)} · ${new Date(item.date).toLocaleDateString()}`;
    row.append(name, detail); $('history-list').append(row);
  }
}
function saveSession() {
  if (savedThisRun || elapsed < 1) return;
  savedThisRun = true;
  const entry = { surah: chapter.en, from: Number($('from').value), to: Number($('to').value), matched: states.filter(s => s === 'matched').length, review: states.filter(s => s === 'review').length, seconds: elapsed, date: new Date().toISOString() };
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
      clearTimeout(workerTimer); engineReady = true; phase = 'idle'; $('download').hidden = true; $('model-picker').hidden = true;
      status('Speech model ready. Press Start reciting and allow microphone access.'); controls();
      void refreshOfflineStatus(); return;
    }
    if (data.type === 'error') {
      clearTimeout(workerTimer);
      if (data.needsModel) {
        phase = 'idle'; $('download').hidden = true; $('model-picker').hidden = false; status(data.message); controls();
      } else failEngine(data.message);
      return;
    }
    if (data.sessionId !== sessionId) return;
    if (data.type === 'started') { startResolve?.(); startResolve = null; }
    if (data.type === 'ack') pendingChunks = Math.max(0, pendingChunks - 1);
    if (data.type === 'result' && ['recording', 'stopping'].includes(phase)) {
      const match = alignSegment(words, segmentStart, segmentCarry + data.text, $('sensitivity').value, data.final);
      // CTC can revise an earlier part of its cumulative hypothesis. Once a
      // word has advanced the visible cursor, that revision must not rewind
      // the reading position or erase completed highlights.
      const caughtUp = match.cursor >= cursor;
      if (caughtUp) {
        for (const result of match.results) {
          if (result.index >= cursor) states[result.index] = result.state;
        }
        cursor = match.cursor;
      }
      if (data.final) {
        committed = [...states]; segmentStart = cursor;
        // Carry only audio aligned at the current frontier. A regressed final
        // hypothesis contains old verse audio, not a new unfinished word.
        segmentCarry = caughtUp ? match.heard.slice(match.consumed).slice(-192) : '';
      }
      paint();
      if (cursor >= words.length && phase === 'recording') void stopRecording();
    }
    if (data.type === 'finished') { finishResolve?.(); finishResolve = null; }
  };
}
function loadEngine(file) {
  if (phase !== 'idle') return;
  if (!window.isSecureContext) { status('Open this site on HTTPS or http://localhost:5173 to use the microphone.', true); return; }
  if (!worker) createWorker();
  phase = 'loading'; $('download').hidden = false; $('download').value = 0; $('model-picker').hidden = true; controls();
  workerTimer = setTimeout(() => failEngine('Model loading timed out. Try again or reload the page.'), 180000);
  worker.postMessage({ type: 'init', file });
}

async function releaseAudio() {
  cancelAnimationFrame(animation);
  media?.getTracks().forEach(track => track.stop()); media = null;
  if (capture) capture.port.onmessage = null;
  capture?.disconnect(); source?.disconnect(); mute?.disconnect(); analyser?.disconnect();
  capture = null; source = null; mute = null; analyser = null;
  if (context && context.state !== 'closed') await context.close().catch(() => {});
  context = null;
  bars.forEach(bar => bar.style.height = '5px');
}
async function failEngine(message) {
  phase = 'stopping'; controls();
  clearTimeout(workerTimer); worker?.terminate(); worker = null; engineReady = false;
  if (startedAt) { elapsed += (Date.now() - startedAt) / 1000; startedAt = 0; }
  startResolve?.(new Error(message)); startResolve = null;
  finishResolve?.(new Error(message)); finishResolve = null;
  flushResolve?.(); flushResolve = null;
  await releaseAudio();
  phase = 'idle'; $('download').hidden = true; $('model-picker').hidden = false;
  status(message, true); controls();
}

function animateLevel() {
  if (!analyser) return;
  const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
  for (let i = 0; i < bars.length; i++) {
    let peak = 0;
    for (let j = i * 12; j < (i + 1) * 12; j++) peak = Math.max(peak, Math.abs(samples[j] - 128) / 128);
    bars[i].style.height = `${Math.max(4, Math.min(36, peak * 105))}px`;
  }
  animation = requestAnimationFrame(animateLevel);
}

async function startRecording() {
  if (phase !== 'idle') return;
  if (!engineReady) { loadEngine(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) { status('This browser does not support microphone tracking. Use a recent Chrome, Edge, Firefox, or Safari on HTTPS.', true); return; }
  if (cursor >= words.length) resetSession();
  phase = 'starting'; controls(); status('Allow microphone access to begin.');
  let micTimer;
  try {
    context = new AudioContext();
    await context.resume();
    const request = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    let abandoned = false;
    request.then(value => { if (abandoned) value.getTracks().forEach(track => track.stop()); }, () => {});
    try {
      media = await Promise.race([request, new Promise((_, reject) => { micTimer = setTimeout(() => { abandoned = true; reject(new Error('Microphone permission timed out. Allow access, then try again.')); }, 45000); })]);
    } finally { clearTimeout(micTimer); }
    await context.audioWorklet.addModule(new URL('../audio-worklet.js', import.meta.url));
    capture = new AudioWorkletNode(context, 'recitation-capture');
    source = context.createMediaStreamSource(media); analyser = context.createAnalyser(); analyser.fftSize = 512;
    mute = context.createGain(); mute.gain.value = 0;
    sessionId++; pendingChunks = 0; segmentStart = cursor; committed = [...states]; segmentCarry = '';
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
    phase = 'recording'; startedAt = Date.now(); savedThisRun = false; controls(); animateLevel();
    status('Listening. Recite the highlighted passage at your own pace.');
  } catch (error) {
    await releaseAudio(); phase = 'idle'; controls();
    const messages = { NotAllowedError: 'Microphone access was denied. Allow it in your browser’s site settings, then try again.', NotFoundError: 'No microphone was found. Connect one, then try again.', NotReadableError: 'The microphone is busy or unavailable. Close other apps using it, then retry.' };
    status(messages[error.name] || error.message, true);
  }
}

async function stopRecording() {
  if (stopPromise) return stopPromise;
  if (phase !== 'recording') return;
  phase = 'stopping'; controls();
  elapsed += (Date.now() - startedAt) / 1000; startedAt = 0;
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
      saveSession();
    } catch (error) { failEngine(error.message); }
    finally { stopPromise = null; }
  })();
  return stopPromise;
}

$('record').addEventListener('click', () => phase === 'recording' ? void stopRecording() : void startRecording());
$('model-file').addEventListener('change', event => { const file = event.target.files[0]; if (file) loadEngine(file); event.target.value = ''; });
$('reset').addEventListener('click', async () => { await stopRecording(); resetSession(); });
$('surah').addEventListener('change', selectChapter);
$('from').addEventListener('change', () => { if (Number($('to').value) < Number($('from').value)) $('to').value = $('from').value; renderPassage(); });
$('to').addEventListener('change', () => { if (Number($('from').value) > Number($('to').value)) $('from').value = $('to').value; renderPassage(); });
function setMode(memory) {
  memoryMode = memory; revealed = false;
  $('read-mode').setAttribute('aria-pressed', String(!memory)); $('memory-mode').setAttribute('aria-pressed', String(memory));
  $('reveal').hidden = !memory; $('reveal').textContent = 'Reveal text';
  $('mode-hint').textContent = memory ? 'Words stay hidden until matched. Reveal the text whenever you need a hint.' : 'Follow the words as you recite at your own pace.';
  paint();
}
$('read-mode').addEventListener('click', () => setMode(false));
$('memory-mode').addEventListener('click', () => setMode(true));
$('reveal').addEventListener('click', () => { revealed = !revealed; $('reveal').textContent = revealed ? 'Hide text' : 'Reveal text'; paint(); });
for (const [id, delta] of [['smaller', -3], ['larger', 3]]) $(id).addEventListener('click', () => { fontSize = Math.min(58, Math.max(25, fontSize + delta)); document.documentElement.style.setProperty('--quran-size', `${fontSize}px`); });
$('theme').addEventListener('click', () => { const dark = document.body.classList.toggle('dark'); try { localStorage.setItem('hafizassist-theme', dark ? 'dark' : 'light'); } catch {} });
window.addEventListener('pagehide', () => { media?.getTracks().forEach(track => track.stop()); worker?.terminate(); void context?.close(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'recording') void stopRecording(); });

async function init() {
  renderHistory();
  try {
    const response = await fetch(new URL('../data/quran.json', import.meta.url));
    if (!response.ok) throw new Error('Quran reference data could not be loaded. Reload the page to try again.');
    const data = await response.json();
    const map = new Map();
    for (const [key, verse] of Object.entries(data.verses)) {
      const [surah, ayah] = key.split(':').map(Number);
      if (!map.has(surah)) map.set(surah, { id: surah, en: verse.suraname_en, ar: verse.suraname_ar, verses: [] });
      map.get(surah).verses.push({ ...verse, ayah });
    }
    chapters = [...map.values()].sort((a, b) => a.id - b.id);
    chapters.forEach(c => c.verses.sort((a, b) => a.ayah - b.ayah));
    $('surah').replaceChildren(...chapters.map(c => new Option(`${c.id}. ${c.en}`, String(c.id))));
    selectChapter();
  } catch (error) { $('ayahs').textContent = 'Unable to load the Quran passage.'; status(error.message, true); }
}
void init();
void setupOffline();
