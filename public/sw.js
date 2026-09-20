// Increment with every delivered change; keep index.html's badge in sync.
const VERSION = 'V20';
const PREFIX = `hafizassist-shell:${self.registration.scope}:`;
const SHELL = PREFIX + VERSION;
const url = path => new URL(path, self.registration.scope).href;
const FILES = [
  'index.html', 'favicon.svg', 'src/app.js', 'src/alignment.js', 'src/debug.js', 'src/word-info.js',
  'src/offline.js', 'src/style.css', 'src/voice-search-worker.js', 'data/quran.json', 'data/HafsSmart.ttf',
  'data/mushaf-layout.json', 'assets/bismillah.png',
  'recognizer-worker.js', 'audio-worklet.js', 'models/tokens.txt', 'model-config.json',
  'vendor/sherpa-onnx-asr.js', 'vendor/sherpa-onnx-wasm-main-asr.js',
  'vendor/sherpa-onnx-wasm-main-asr.wasm',
].map(url);
const fileSet = new Set(FILES);

self.addEventListener('install', event => {
  // A failed/incomplete download must not replace a usable offline version.
  // Do not skipWaiting: avoid swapping code during a live recitation session.
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' })));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== SHELL).map(name => caches.delete(name)));
    // Model cache and practice history are intentionally retained.
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requested = new URL(request.url);
  if (!requested.href.startsWith(self.registration.scope)) return;
  const path = requested.origin + requested.pathname;
  const isHome = request.mode === 'navigate' && [url(''), url('index.html'), url('recite/'), url('recite')].includes(path);
  const key = isHome ? url('index.html') : path;
  if (!fileSet.has(key)) return; // The recognizer owns its separate model cache.
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const saved = await cache.match(key);
    if (saved) return saved;
    const response = await fetch(new Request(key, { cache: 'reload' }));
    if (response.ok) await cache.put(key, response.clone());
    return response;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'offline-status') return;
  event.waitUntil((async () => {
    try {
      const shell = await caches.open(SHELL);
      const entries = await Promise.all(FILES.map(file => shell.match(file)));
      const models = await caches.open('hafizassist-model-v1');
      const model = await models.match(url('models/zipformer_p_arabic_v3.int8.onnx'));
      event.ports[0]?.postMessage({ shell: entries.every(Boolean), model: Boolean(model?.ok && Number(model.headers.get('Content-Length')) === 72705392) });
    } catch { event.ports[0]?.postMessage({ shell: false, model: false }); }
  })());
});
