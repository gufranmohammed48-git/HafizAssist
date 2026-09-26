// Convert the owner's Desktop-HafizAssist annotation file without executing it.
import { readFile, writeFile } from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw new Error('Pass the Desktop-HafizAssist phonemes-data.js path.');
const text = await readFile(source, 'utf8');
const prefix = 'window.SURAH_PHONEMES=';
const start = text.indexOf(prefix);
if (start < 0) throw new Error('SURAH_PHONEMES assignment was not found.');
const data = JSON.parse(text.slice(start + prefix.length).trim().replace(/;$/, ''));
await writeFile(new URL('../public/data/tajweed-words.json', import.meta.url), JSON.stringify(data));
console.log('Copied the original per-word phonemes and Tajweed annotations to public/data/tajweed-words.json.');
