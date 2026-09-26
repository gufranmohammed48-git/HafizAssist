// Rule positions in schema 2 refer to characters in aya_text, not phonemes.
export function wordRules(verse, names) {
  return [...verse.aya_text.matchAll(/\S+/gu)].map(token => (verse.rules || [])
    .filter(([position]) => position >= token.index && position < token.index + token[0].length)
    .map(([, id, length]) => ({ id, en: names[id]?.en || `Rule ${id}`, ar: names[id]?.ar || '',
      beats: id >= 1 && id <= 7 ? length : null })));
}

// Match by written letters as well as position: the two sources occasionally
// split a written word differently. Never attach another word's annotations.
export function referenceWords(verse, entries) {
  const letters = text => text.replace(/ٱ/g, 'ا').normalize('NFKD').replace(/[^\u0621-\u063a\u0641-\u064a]/gu, '');
  const current = verse.aya_text.trim().split(/\s+/u);
  const source = Object.entries(entries || {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, value]) => value);
  let offset = 0;
  const spans = source.map(entry => {
    const start = offset; offset += letters(entry[0]).length;
    return { entry, start, end: offset };
  });
  const sameText = current.map(letters).join('') === source.map(entry => letters(entry[0])).join('');
  offset = 0;
  return current.map((text, index) => {
    const start = offset; offset += letters(text).length;
    const matches = sameText ? spans.filter(span => span.start < offset && span.end > start).map(span => span.entry)
      : source[index] && letters(source[index][0]) === letters(text) ? [source[index]] : [];
    if (!matches.length) return null;
    return { text: matches.map(entry => entry[0]).join(' '), phoneme: matches.map(entry => entry[1]).join(''),
      rules: matches.flatMap(entry => (entry[2] || '').split(',').filter(Boolean).map(item => {
        const separator = item.indexOf(':');
        return { letter: item.slice(0, separator), name: item.slice(separator + 1) };
      })) };
  });
}


export function createWordInfo(getInfo) {
  const tip = document.createElement('div');
  tip.id = 'word-info'; tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-modal', 'false'); tip.setAttribute('aria-labelledby', 'word-info-title');
  tip.hidden = true; document.body.append(tip);
  let active, closeTimer;
  function hide() {
    clearTimeout(closeTimer);
    active?.setAttribute('aria-expanded', 'false');
    active = null; tip.hidden = true;
  }
  function closeAndReturn() {
    const button = active;
    hide();
    // Focus without reopening through the word's focus handler.
    suppressFocus = true; button?.focus({ preventScroll: true }); suppressFocus = false;
  }
  let suppressFocus = false;
  function scheduleHide() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!tip.matches(':hover') && !active?.matches(':hover') &&
          !tip.contains(document.activeElement) && document.activeElement !== active) hide();
    }, 220);
  }
  function position() {
    if (!active || tip.hidden) return;
    const rect = active.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, rect.left)) + 'px';
    tip.style.top = Math.max(8, rect.top >= tip.offsetHeight + 12 ? rect.top - tip.offsetHeight - 8 :
      Math.min(innerHeight - tip.offsetHeight - 8, rect.bottom + 8)) + 'px';
  }
  function textElement(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function field(label, value, arabic = false) {
    const row = document.createElement('div'); row.className = 'word-info-field';
    row.append(textElement('strong', label));
    const content = textElement('div', value);
    content.dir = 'auto';
    if (arabic) { content.lang = 'ar'; content.className = 'word-info-arabic'; }
    row.append(content); return row;
  }
  function referenceContent(word) {
    const content = document.createElement('div'); content.className = 'word-info-reference';
    const reference = word.reference;
    const rules = reference ? reference.rules.map(r => r.name + ' → ' + r.letter)
      : (word.rules || []).map(r => r.en + ' · ' + r.ar + (r.beats ? ' · ' + r.beats + ' counts' : ''));
    if (rules.length) {
      const list = document.createElement('ul');
      rules.forEach(rule => list.append(textElement('li', rule)));
      content.append(list);
    } else content.append(textElement('p', 'No rule annotation supplied for this word.', 'word-info-note'));
    return content;
  }
  function bind(button, index) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', tip.id);
    button.setAttribute('aria-expanded', 'false');
    function show() {
      if (suppressFocus) return;
      clearTimeout(closeTimer);
      if (active === button && !tip.hidden) return;
      hide(); active = button; button.setAttribute('aria-expanded', 'true');
      tip.replaceChildren();
      const { word, state, detail, hidden } = getInfo(index);
      tip.classList.toggle('is-review', !hidden && state === 'review');
      const header = document.createElement('div'); header.className = 'word-info-heading';
      // Hafs uses display glyphs; reuse the rendered word, not its Unicode transcription.
      const title = textElement('span', hidden ? 'Hidden word' : button.textContent, hidden ? '' : 'word-info-word');
      title.id = 'word-info-title';
      if (!hidden) {
        title.lang = 'ar'; title.dir = 'rtl';
        title.style.fontFamily = getComputedStyle(button).fontFamily;
        title.setAttribute('aria-label', word.accessible);
      }
      header.append(title);
      if (!hidden) {
        const pronunciation = textElement('span', word.reference ? '/' + word.reference.phoneme + '/' : word.phoneme, 'word-info-pronunciation');
        pronunciation.dir = 'auto';
        header.append(pronunciation);
      }
      tip.append(header);
      if (hidden) tip.append(textElement('p', 'Use the eye button to show word details.'));
      else if (state === 'review') {
        title.setAttribute('aria-label', 'Expected word: ' + word.accessible);
        const possibleSkip = detail?.recoveryWord && !detail?.heard;
        tip.append(field('Issue', possibleSkip
          ? 'Possible skipped word. Tracking matched a later word.'
          : 'Couldn’t confidently match this word.'));
        if (detail?.heard) {
          tip.append(field('Recognized sounds nearby', detail.heard, true));
          tip.append(textElement('p', 'This fragment may cover more than one word; it is not a confirmed transcription of what you said for this word.', 'word-info-note'));
        } else tip.append(field('Heard', 'No reliable sound fragment was isolated for this word.'));
        if (detail?.recoveryWord) tip.append(field('Tracking resumed at', detail.recoveryWord, true));
        tip.append(textElement('p', 'Recognition can be wrong. This flag does not confirm a specific pronunciation or Tajweed mistake.', 'word-info-note'));
        const details = document.createElement('details');
        details.append(textElement('summary', 'Tajweed rules'), referenceContent(word));
        details.addEventListener('toggle', position); tip.append(details);
      } else {
        tip.append(referenceContent(word));
      }
      tip.style.left = '8px';
      tip.hidden = false; position();
    }
    button.addEventListener('mouseenter', show);
    button.addEventListener('focus', show);
    button.addEventListener('click', show);
    button.addEventListener('mouseleave', scheduleHide);
    button.addEventListener('blur', scheduleHide);
    button.addEventListener('keydown', event => {
      if (event.key === 'Tab' && !event.shiftKey && active === button && !tip.hidden) {
        const summary = tip.querySelector('summary');
        if (summary) { event.preventDefault(); summary.focus(); }
        else hide();
      }
    });
  }
  tip.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  tip.addEventListener('mouseleave', scheduleHide);
  tip.addEventListener('focusin', () => clearTimeout(closeTimer));
  tip.addEventListener('focusout', scheduleHide);
  document.addEventListener('pointerdown', event => {
    if (active && !active.contains(event.target) && !tip.contains(event.target)) hide();
  });
  window.addEventListener('scroll', event => { if (!tip.contains(event.target)) hide(); }, true);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) { event.preventDefault(); closeAndReturn(); }
  });
  return { bind, hide };
}
