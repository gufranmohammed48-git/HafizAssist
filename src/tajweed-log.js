const MAX_EVENTS = 160;
const MAX_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shortText(value, limit = 70) {
  const text = typeof value === 'string' ? value : '';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function describe(event) {
  const parts = [];
  if (Number.isInteger(event.attempt)) parts.push(`Attempt ${event.attempt}`);
  if (event.page !== undefined) parts.push(`Page ${event.page}`);
  const word = typeof event.word === 'string' ? event.word : event.word?.text;
  if (word) parts.push(shortText(word, 30));
  const rule = typeof event.rule === 'string' ? event.rule : event.rule?.name;
  if (rule) parts.push(shortText(rule, 36));
  const status = ({ underheld: 'Possibly too short', overheld: 'Possibly too long', 'within-range': 'Within preview range', unavailable: 'Not assessed' })[event.status] || event.status || event.kind || 'Event';
  parts.push(shortText(String(status).replaceAll('-', ' '), 50));
  const estimate = Number(event.estimatedMs);
  if (event.estimatedMs !== null && event.estimatedMs !== undefined && Number.isFinite(estimate)) {
    parts.push(`Estimated ${(estimate / 1000).toFixed(2)} s`);
  }
  return parts.join(' · ');
}

/** In-memory diagnostics for the experimental page. Never stores or uploads audio. */
export function createTajweedLog() {
  const container = document.querySelector('.tajweed-preview-settings');
  if (!container) return { record() {} };
  const existing = container.querySelector('.tajweed-testing-log');
  if (existing) return { record() {} };

  const panel = element('details', 'tajweed-testing-log');
  panel.append(element('summary', '', 'Testing log'));
  const body = element('div', 'tajweed-log-body');
  const toggleLabel = element('label', 'tajweed-log-toggle');
  const toggle = element('input');
  toggle.type = 'checkbox';
  toggle.checked = true;
  toggleLabel.append(toggle, element('span', '', 'Record diagnostics'));
  body.append(toggleLabel);
  body.append(element('p', 'hint', 'Enable, recite, then copy the log. No audio is saved.'));
  const summary = element('p', 'tajweed-log-summary');
  // The event list changes often; only this throttled, compact summary is announced.
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-atomic', 'true');
  body.append(summary);
  const list = element('ol', 'tajweed-log-events');
  list.setAttribute('aria-label', 'Latest diagnostic events');
  body.append(list);
  const actions = element('div', 'tajweed-log-actions');
  const copy = element('button', '', 'Copy log');
  const download = element('button', '', 'Download log');
  const clear = element('button', '', 'Clear log');
  for (const button of [copy, download, clear]) button.type = 'button';
  actions.append(copy, download, clear);
  body.append(actions);
  const message = element('p', 'hint tajweed-log-message');
  message.setAttribute('role', 'status');
  body.append(message);
  const fallback = element('textarea', 'tajweed-log-fallback');
  fallback.hidden = true;
  fallback.readOnly = true;
  fallback.rows = 4;
  fallback.setAttribute('aria-label', 'Diagnostic JSON to copy manually');
  fallback.spellcheck = false;
  body.append(fallback);
  body.append(element('p', 'hint tajweed-log-retention', 'Local memory only · latest 160 events, up to 2 MiB. Reloading clears the log. Times are recognition estimates.'));
  panel.append(body);
  container.append(panel);

  const entries = [];
  let retainedBytes = 0;
  let received = 0;
  let discarded = 0;
  let nextSequence = 0;
  let renderTimer = null;
  let lastSummaryAt = 0;
  let summaryTimer = null;

  function updateSummary() {
    clearTimeout(summaryTimer);
    summaryTimer = null;
    lastSummaryAt = Date.now();
    const latest = entries.at(-1)?.event;
    summary.textContent = `${toggle.checked ? 'Recording' : 'Paused'} · ${entries.length} retained event${entries.length === 1 ? '' : 's'}${latest ? ` · ${describe(latest)}` : ' · Waiting for recitation'}`;
  }

  function render(forceSummary = false) {
    clearTimeout(renderTimer);
    renderTimer = null;
    copy.disabled = download.disabled = clear.disabled = entries.length === 0;
    if (panel.open) {
      list.replaceChildren();
      for (const { event } of entries.filter(entry => ['assessment', 'vowel', 'matching-excluded'].includes(entry.event.kind)).slice(-10).reverse()) {
        const row = element('li');
        row.append(element('span', 'tajweed-log-event-label', describe(event)));
        if ([event.minMs, event.targetMs, event.maxMs].every(value => typeof value === 'number' && Number.isFinite(value))) {
          row.append(element('small', '', `${event.speed || 'Selected'} pace · thresholds ${event.minMs}–${event.maxMs} ms · target ${event.targetMs} ms`));
        }
        if (event.reason) row.append(element('small', '', shortText(event.reason, 180)));
        list.append(row);
      }
    }
    if (forceSummary || Date.now() - lastSummaryAt >= 1500) updateSummary();
    else if (summaryTimer === null) summaryTimer = setTimeout(updateSummary, 1500 - (Date.now() - lastSummaryAt));
  }

  function exportText() {
    return JSON.stringify({
      schema: 1,
      kind: 'tajweed-preview-log',
      version: document.querySelector('.app-version')?.textContent.trim() || 'Unknown',
      capturedAt: new Date().toISOString(),
      privacy: 'Local-only in-memory diagnostics. No audio recorded or uploaded.',
      evidence: 'Recognition phonemes and CTC emission timing estimates, not verified acoustic measurements.',
      configuration: {
        tajweedReview: document.documentElement.dataset.tajweedReview,
        selectedSpeed: document.getElementById('tajweed-speed')?.value || 'normal',
      },
      recording: toggle.checked,
      retention: { maxEvents: MAX_EVENTS, maxBytes: MAX_BYTES, retainedEvents: entries.length, retainedBytes, receivedEvents: received, discardedEvents: discarded },
      events: entries.map(entry => entry.event),
    }, null, 2);
  }

  toggle.addEventListener('change', () => {
    message.textContent = toggle.checked ? 'New diagnostics are being recorded.' : 'Recording paused. Existing entries are kept.';
    render(true);
  });
  panel.addEventListener('toggle', () => render(true));
  copy.addEventListener('click', async () => {
    const text = exportText();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      fallback.value = '';
      message.textContent = 'Log copied. Paste it into our chat.';
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      message.textContent = 'Clipboard unavailable. Copy the selected JSON below, or download it.';
    }
  });
  download.addEventListener('click', () => {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = element('a');
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    link.href = url;
    link.download = `tajweed-log-${stamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.textContent = 'Log downloaded. No audio is included.';
  });
  clear.addEventListener('click', () => {
    entries.length = 0;
    retainedBytes = received = discarded = 0;
    fallback.value = '';
    fallback.hidden = true;
    list.replaceChildren();
    message.textContent = 'Log cleared. Your reading position and practice results are unchanged.';
    render(true);
  });

  render(true);
  const logger = {
    record(payload) {
      if (!toggle.checked) return;
      received++;
      let event, bytes;
      try {
        // Snapshot the caller's data so later recognition revisions cannot rewrite history.
        const snapshot = JSON.parse(JSON.stringify(payload));
        event = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
          ? { ...snapshot, sequence: ++nextSequence, loggedAt: new Date().toISOString() }
          : { payload: snapshot, sequence: ++nextSequence, loggedAt: new Date().toISOString() };
        bytes = encoder.encode(JSON.stringify(event)).byteLength;
      } catch {
        discarded++;
        return;
      }
      if (bytes > MAX_BYTES) {
        discarded++;
        return;
      }
      entries.push({ event, bytes });
      retainedBytes += bytes;
      while (entries.length > MAX_EVENTS || retainedBytes > MAX_BYTES) {
        retainedBytes -= entries.shift().bytes;
        discarded++;
      }
      if (renderTimer === null) renderTimer = setTimeout(() => render(), 350);
    },
  };
  document.getElementById('tajweed-speed')?.addEventListener('change', event => {
    logger.record({ kind: 'pace-change', speed: event.target.value,
      reason: 'Pace changed. New timing suggestions use the selected thresholds.' });
  });
  return logger;
}
