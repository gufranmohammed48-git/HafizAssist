/* Sherpa inference lives off the UI thread. No audio is sent over the network. */
let recognizer = null;
let stream = null;
let sessionId = 0;
let lastText = '';
let runtimePromise;
const modelName = 'zipformer_p_arabic_v3.int8.onnx';
const modelUrl = new URL(`models/${modelName}`, self.location.href).href;
async function downloadUrl() {
  const response = await fetch(new URL('model-config.json', self.location.href));
  if (!response.ok) throw new Error('Model download configuration is missing. Redeploy the complete site.');
  const config = await response.json();
  if (!config.modelUrl) return modelUrl; // Local development/file-picker fallback.
  const remote = new URL(config.modelUrl);
  if (remote.protocol !== 'https:' || remote.username || remote.password) {
    throw new Error('The model download URL must be a public HTTPS URL without credentials.');
  }
  return remote.href;
}
const send = (type, data = {}) => self.postMessage({ type, sessionId, ...data });

function runtime() {
  if (!runtimePromise) runtimePromise = new Promise((resolve, reject) => {
    self.Module = {
      locateFile: path => new URL(`vendor/${path}`, self.location.href).href,
      onRuntimeInitialized: resolve,
      onAbort: reason => reject(new Error(`Speech runtime could not start: ${reason}`)),
      print: () => {}, printErr: text => console.warn(text),
    };
    try { importScripts('vendor/sherpa-onnx-asr.js', 'vendor/sherpa-onnx-wasm-main-asr.js'); }
    catch (error) { reject(error); }
  });
  return runtimePromise;
}

async function loadModel(file) {
  // Cache is a convenience only: denial/quota exhaustion must not block practice.
  let cache;
  try { cache = await caches.open('hafizassist-model-v1'); } catch {}
  let response, fromCache = false;
  if (file) {
    if (file.size !== 72705392) throw new Error('Please select the 72.7 MB INT8 v3 model, not the full-size model.');
    response = new Response(file, { headers: { 'Content-Length': String(file.size) } });
  } else {
    try { response = await cache?.match(modelUrl); } catch {}
    if (response && (!response.ok || Number(response.headers.get('Content-Length')) !== 72705392)) {
      try { await cache?.delete(modelUrl); } catch {}
      response = null;
    }
    fromCache = Boolean(response);
    if (!response) {
      try {
        const sourceUrl = await downloadUrl();
        send('progress', { value: 0, message: 'Downloading speech model for this device…' });
        response = await fetch(sourceUrl, { mode: 'cors', credentials: 'omit' });
      }
      catch {
        const error = new Error('Could not download the speech model. Check your connection; the model host must allow this website through CORS. You can also select your downloaded INT8 model below.');
        error.needsModel = true; throw error;
      }
    }
  }
  if (!response.ok) { const error = new Error(`Model download failed (HTTP ${response.status}). The public model URL may be missing or unavailable. Select your downloaded INT8 model below to continue.`); error.needsModel = true; throw error; }
  const total = Number(response.headers.get('Content-Length')) || 72705392;
  const reader = response.body.getReader();
  const chunks = []; let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length;
    if (loaded > 72705392) { await reader.cancel(); throw new Error('The hosted model is too large. Upload zipformer_p_arabic_v3.int8.onnx (72,705,392 bytes).'); }
    send('progress', { value: Math.min(95, loaded / total * 95), message: `${fromCache ? 'Opening saved model — no download' : file ? 'Reading selected model' : 'Downloading speech model'} · ${Math.round(loaded / 1e6)} MB` });
  }
  if (loaded !== 72705392) { const error = new Error('Model is missing or incomplete. Select the downloaded INT8 v3 ONNX file.'); error.needsModel = true; throw error; }
  const bytes = new Uint8Array(loaded); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  chunks.length = 0;
  if (cache && !fromCache) { try { await cache.put(modelUrl, new Response(bytes, { headers: { 'Content-Length': String(loaded) } })); } catch {} }
  return bytes;
}

function newStream() {
  stream?.free();
  stream = recognizer.createStream();
  if (!stream.handle) throw new Error('Could not create a speech stream. Reload the page and try again.');
  lastText = '';
  stream.acceptWaveform(16000, new Float32Array(4800));
}

function decode(final = false) {
  while (recognizer.isReady(stream)) recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  const endpoint = final || recognizer.isEndpoint(stream);
  if (result.text !== lastText || endpoint) {
    lastText = result.text;
    send('result', { text: result.text || '', final: endpoint });
  }
  if (endpoint && !final) { recognizer.reset(stream); lastText = ''; }
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      if (recognizer) { send('ready'); return; }
      send('progress', { value: 0, message: 'Preparing the private speech engine…' });
      await runtime();
      const bytes = await loadModel(data.file);
      const tokensResponse = await fetch('models/tokens.txt');
      if (!tokensResponse.ok) throw new Error('The model token file is missing. Restore public/models/tokens.txt.');
      const tokens = new Uint8Array(await tokensResponse.arrayBuffer());
      Module.FS_createDataFile('/', modelName, bytes, true, true, true);
      Module.FS_createDataFile('/', 'quran_tokens.txt', tokens, true, true, true);
      Module.modelPath = `./${modelName}`;
      send('progress', { value: 98, message: 'Initializing recognition. This can take a moment…' });
      // Preserve context over natural breaths. The UI carries unmatched tails
      // across segment boundaries. No language model is used.
      const config = {
        featConfig: { sampleRate: 16000, featureDim: 80 },
        modelConfig: {
          zipformer2Ctc: { model: `./${modelName}` },
          tokens: './quran_tokens.txt', numThreads: 1, provider: 'cpu',
          debug: 0, modelType: '', modelingUnit: 'cjkchar', bpeVocab: '',
        },
        decodingMethod: 'greedy_search', maxActivePaths: 4, enableEndpoint: 1,
        rule1MinTrailingSilence: 5, rule2MinTrailingSilence: 2.4,
        rule3MinUtteranceLength: 60, hotwordsFile: '', hotwordsScore: 1.5,
        ctcFstDecoderConfig: { graph: '', maxActive: 3000 }, ruleFsts: '', ruleFars: '',
      };
      recognizer = createOnlineRecognizer(Module, config);
      if (!recognizer.handle) { recognizer = null; throw new Error('Could not initialize the streaming recognizer.'); }
      try { Module.FS_unlink('/' + modelName); } catch {}
      send('ready');
    } else if (data.type === 'start') {
      if (!recognizer) throw new Error('The speech model is not ready.');
      sessionId = data.sessionId; newStream(); send('started');
    } else if (data.type === 'audio' && stream && data.sessionId === sessionId) {
      const began = performance.now();
      let squares = 0, peak = 0;
      for (const value of data.samples) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
      stream.acceptWaveform(16000, data.samples); decode();
      send('ack', { processMs: performance.now() - began, audioMs: data.samples.length / 16,
        rms: Math.sqrt(squares / Math.max(1, data.samples.length)), peak });
    } else if (data.type === 'finish' && data.sessionId === sessionId) {
      if (stream) {
        stream.acceptWaveform(16000, new Float32Array(8000));
        stream.inputFinished(); decode(true); stream.free(); stream = null;
      }
      send('finished');
    }
  } catch (error) {
    send('error', { message: error.message || 'Speech processing failed.', needsModel: Boolean(error.needsModel) });
  }
};
