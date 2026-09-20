import { normalize } from './alignment.js';

// Ignore vowel length variations when locating a passage, not when grading it.
const simplify = text => normalize(text).replace(/[\u064b-\u0652]/gu, '').replace(/(.)\1+/gu, '$1');
let passages = [];
const grams = text => new Set(Array.from({ length: Math.max(0, text.length - 2) }, (_, i) => text.slice(i, i + 3)));

// Semi-global edit distance: the recitation may begin anywhere inside an ayah.
function locate(query, text) {
  let previous = new Uint16Array(text.length + 1), starts = Uint32Array.from({ length: text.length + 1 }, (_, i) => i);
  for (let i = 1; i <= query.length; i++) {
    const row = new Uint16Array(text.length + 1), nextStarts = new Uint32Array(text.length + 1);
    row[0] = i;
    for (let j = 1; j <= text.length; j++) {
      const diagonal = previous[j - 1] + (query[i - 1] === text[j - 1] ? 0 : 1);
      const deletion = previous[j] + 1, insertion = row[j - 1] + 1;
      row[j] = Math.min(diagonal, deletion, insertion);
      nextStarts[j] = row[j] === diagonal ? starts[j - 1] : row[j] === deletion ? starts[j] : nextStarts[j - 1];
    }
    previous = row; starts = nextStarts;
  }
  let end = 1;
  for (let j = 2; j <= text.length; j++) if (previous[j] < previous[end]) end = j;
  return { score: 1 - previous[end] / query.length, start: starts[end] };
}

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      passages = data.verses.map((verse, i) => {
        let text = ''; const positions = [];
        // Include neighboring verses so a recitation can cross verse boundaries.
        for (const part of data.verses.slice(i, i + 4)) {
          if (part.key.split(':')[0] !== verse.key.split(':')[0]) break;
          part.phonemes.forEach((phoneme, word) => {
            positions.push({ offset: text.length, key: part.key, word }); text += simplify(phoneme);
          });
        }
        return { text, positions, grams: grams(text) };
      });
      return;
    }
    const query = simplify(data.text).slice(-180), queryGrams = grams(query);
    if (query.length < 12) { postMessage({ id: data.id, results: [], short: true }); return; }
    const ranked = passages.map(p => ({ p, overlap: [...queryGrams].reduce((n, gram) => n + Number(p.grams.has(gram)), 0) }))
      .sort((a, b) => b.overlap - a.overlap).slice(0, 80);
    const matches = new Map();
    for (const { p, overlap } of ranked) {
      if (!overlap) continue;
      const match = locate(query, p.text);
      if (match.score < .62) continue;
      const position = p.positions.findLast(item => item.offset <= match.start);
      if (!position) continue;
      if (!matches.has(position.key) || matches.get(position.key).score < match.score)
        matches.set(position.key, { key: position.key, word: position.word, score: match.score });
    }
    postMessage({ id: data.id, results: [...matches.values()].sort((a, b) => b.score - a.score).slice(0, 5) });
  } catch { postMessage({ id: data.id, error: 'Verse search could not finish. Please try again.' }); }
};
