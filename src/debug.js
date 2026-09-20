// Bounded, in-memory diagnostics. No audio samples, uploads, or persistent logs.
export function createDebugPanel(snapshot) {
  const panel = document.getElementById('debug-panel');
  const output = document.getElementById('debug-output');
  const notice = document.getElementById('debug-notice');
  const events = [];
  const started = Date.now();
  let dropped = 0;
  const environment = {
    version: document.querySelector('.app-version').textContent,
    userAgent: navigator.userAgent, language: navigator.language,
    cores: navigator.hardwareConcurrency, memoryGB: navigator.deviceMemory,
    model: 'zipformer_p_arabic_v3.int8.onnx', sensitivity: 'balanced',
    matchingPolicy: 'consumed-transcript-boundary-with-earliest-occurrence',
  };
  function report() {
    return { schema: 1, capturedAt: new Date().toISOString(), environment,
      current: snapshot(), droppedEvents: dropped, events: [...events] };
  }
  function refresh() {
    if (!panel.open || document.activeElement === output) return;
    output.value = JSON.stringify({ ...report(), events: events.slice(-12) }, null, 2);
  }
  function log(type, data = {}) {
    events.push({ ms: Date.now() - started, type, ...data });
    if (events.length > 300) { events.shift(); dropped++; }
  }
  document.getElementById('debug-mark').addEventListener('click', () => {
    log('user-marked-stall', { snapshot: snapshot() });
    notice.textContent = 'Stall marked. Stop reciting, then copy the report.';
    refresh();
  });
  document.getElementById('debug-copy').addEventListener('click', async () => {
    const text = JSON.stringify(report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      notice.textContent = 'Full report copied. Paste it into our conversation.';
    } catch {
      output.value = text; output.focus(); output.select();
      notice.textContent = 'Report selected. Copy it with Ctrl+C or your device’s Copy command.';
    }
  });
  document.getElementById('debug-clear').addEventListener('click', () => {
    events.length = 0; dropped = 0;
    log('log-cleared', { snapshot: snapshot() });
    notice.textContent = 'Log cleared.'; refresh();
  });
  panel.addEventListener('toggle', refresh);
  setInterval(refresh, 1000);
  return { log };
}
