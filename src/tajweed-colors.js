// These are the rule classes published with Quran Foundation's tagged text.
// The local annotation file is mapped to this app's exact written words;
// recognition, word positions, and the Quran font do not depend on colours.
export const TAJWEED_COLOR_RULES = Object.freeze([
  'ham_wasl', 'laam_shamsiyah', 'slnt',
  'madda_normal', 'madda_permissible', 'madda_necessary',
  'madda_obligatory',
  'qalaqah', 'ikhafa', 'ikhafa_shafawi', 'idgham_shafawi', 'iqlab',
  'idgham_ghunnah', 'idgham_wo_ghunnah', 'ghunnah',
  'idgham_mutajanisayn', 'idgham_mutaqaribayn',
]);

const ruleNames = new Set(TAJWEED_COLOR_RULES);
const isMark = character => Boolean(character && /\p{M}/u.test(character));

function safeRuns(entry) {
  if (!entry || typeof entry.text !== 'string' || !Array.isArray(entry.runs)) return null;
  const characters = Array.from(entry.text);
  let previousEnd = 0;
  const runs = [];
  for (const run of entry.runs) {
    if (!Number.isInteger(run?.start) || !Number.isInteger(run?.end) ||
        run.start < previousEnd || run.end <= run.start || run.end > characters.length) return null;
    previousEnd = run.end;
    // Never split a base letter from its Quranic vowel or combining marks.
    if (!ruleNames.has(run.rule) || isMark(characters[run.start]) || isMark(characters[run.end])) continue;
    runs.push({ start: run.start, end: run.end, rule: run.rule });
  }
  return { characters, runs };
}

export function createTajweedColors(enabled) {
  if (!enabled) return { load: async () => false, decorate() {} };

  let verses = null, loading, ready = false, showing = false;
  let uncolouredVerses = 0;
  let toggle, status;
  const announce = message => { if (status) status.textContent = message; };
  const updateToggle = () => {
    document.body.classList.toggle('tajweed-colors-on', ready && showing);
    if (!toggle) return;
    toggle.disabled = !ready;
    toggle.setAttribute('aria-pressed', String(ready && showing));
    const label = showing ? 'Hide Tajweed colours' : 'Show Tajweed colours';
    toggle.setAttribute('aria-label', label);
    toggle.title = ready ? label : 'Tajweed colours are loading';
  };

  async function load() {
    if (loading) return loading;
    toggle = document.getElementById('tajweed-colors-toggle');
    status = document.getElementById('tajweed-colors-status');
    if (toggle) {
      toggle.addEventListener('click', () => {
        if (!ready) return;
        showing = !showing;
        updateToggle();
        announce(showing ? 'Tajweed colours on.' + (uncolouredVerses ? ' Some verses remain uncoloured.' : '') : 'Tajweed colours off.');
      });
    }
    showing = false;
    updateToggle();
    announce('Loading Tajweed colours…');
    loading = (async () => {
      try {
        const response = await fetch(new URL('../data/tajweed-colors.json', import.meta.url));
        if (!response.ok) throw new Error('annotations-unavailable');
        const data = await response.json();
        if (data?.schema !== 1 || !data.verses || typeof data.verses !== 'object' || Array.isArray(data.verses)) {
          throw new Error('annotations-invalid');
        }
        verses = data.verses;
        uncolouredVerses = Number(data.coverage?.skippedVerses) || 0;
        ready = true;
        updateToggle();
        announce('Tajweed colours ready. Turn on the Tajweed icon to show them.' +
          (uncolouredVerses ? ' Some verses remain uncoloured.' : ''));
        return true;
      } catch {
        verses = null;
        ready = false;
        showing = false;
        updateToggle();
        if (toggle) {
          toggle.title = 'Tajweed colours are unavailable. You can still recite normally.';
          toggle.setAttribute('aria-label', 'Tajweed colours unavailable');
        }
        announce('Tajweed colours could not load. Quran reading and tracking remain available.');
        return false;
      }
    })();
    return loading;
  }

  function decorate(button, word) {
    if (!ready || !button || !word || !Number.isInteger(word.position)) return;
    const key = word.bismillah ? '1:1' : `${word.surah}:${word.ayah}`;
    const entry = verses[key]?.words?.[word.position];
    // The importer handles text-edition differences. Runtime colouring is
    // deliberately exact so another word's letters cannot be annotated.
    if (!entry || entry.text !== word.accessible || button.textContent !== entry.text) return;
    const result = safeRuns(entry);
    if (!result?.runs.length) return;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const run of result.runs) {
      if (run.start > offset) fragment.append(document.createTextNode(result.characters.slice(offset, run.start).join('')));
      const span = document.createElement('span');
      span.dataset.tajweedRule = run.rule;
      span.textContent = result.characters.slice(run.start, run.end).join('');
      fragment.append(span);
      offset = run.end;
    }
    if (offset < result.characters.length) fragment.append(document.createTextNode(result.characters.slice(offset).join('')));
    button.replaceChildren(fragment);
  }

  return { load, decorate };
}
