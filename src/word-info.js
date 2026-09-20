// Rule positions in schema 2 refer to characters in aya_text, not phonemes.
export function wordRules(verse, names) {
  return [...verse.aya_text.matchAll(/\S+/gu)].map(token => (verse.rules || [])
    .filter(([position]) => position >= token.index && position < token.index + token[0].length)
    .map(([, id, length]) => ({ id, en: names[id]?.en || `Rule ${id}`, ar: names[id]?.ar || '',
      beats: id >= 1 && id <= 7 ? length : null })));
}

export function createWordInfo(getInfo) {
  const tip = document.createElement('div'); tip.id = 'word-info'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.append(tip);
  let active;
  function hide() { active?.removeAttribute('aria-describedby'); active = null; tip.hidden = true; }
  function bind(button, index) {
    function show() {
      hide(); active = button; button.setAttribute('aria-describedby', tip.id);
      const { word, state, detail, hidden } = getInfo(index);
      if (hidden) tip.textContent = 'Quran text is hidden. Use the eye button to show word details.';
      else {
        const rules = (word.rules || []).map(r => `${r.en} · ${r.ar}${r.beats ? ` · ${r.beats} counts` : ''}`);
        tip.textContent = [word.accessible, `Phonemes: ${word.phoneme}`,
          ...(state === 'review' ? ['Flagged for review', detail?.reason || 'No confident match before tracking moved ahead.',
            detail?.heard ? `Recognized fragment: ${detail.heard}` : 'No separate recognized fragment was aligned to this word.',
            detail?.recoveryWord ? `Tracking resumed at: ${detail.recoveryWord}` : '',
            'This does not establish a specific pronunciation or Tajweed error.'] : []),
          'Tajweed reference:', ...(rules.length ? rules : ['No rule annotation supplied for this word.']),
        ].filter(Boolean).join('\n');
      }
      tip.hidden = false;
      const rect = button.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, rect.left))}px`;
      tip.style.top = `${Math.max(8, rect.top >= tip.offsetHeight + 12 ? rect.top - tip.offsetHeight - 8 : Math.min(innerHeight - tip.offsetHeight - 8, rect.bottom + 8))}px`;
    }
    button.addEventListener('mouseenter', show); button.addEventListener('focus', show);
    button.addEventListener('mouseleave', hide); button.addEventListener('blur', hide);
  }
  window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  return { bind, hide };
}
