import { messages as coreMessages, patterns as corePatterns } from './ui-language-core-ar.js';
import { messages as teacherMessages, patterns as teacherPatterns } from './ui-language-teacher-ar.js';
import { messages as wordMessages, patterns as wordPatterns } from './ui-language-word-ar.js';

// Presentation only: recognition, Quran words, phonemes, form values and
// saved practice data stay in their original form when the language changes.
const messages = { ...coreMessages, ...teacherMessages, ...wordMessages,
  'Language:': 'اللغة:', 'Interface language': 'لغة الواجهة',
  'Language settings': 'إعدادات اللغة',
};
const patterns = [...corePatterns, ...teacherPatterns, ...wordPatterns];
const storageKey = 'recitealquran-ui-language';
const textState = new WeakMap();
const attributeState = new WeakMap();
const reverse = new Map(Object.entries(messages).map(([en, ar]) => [ar, en]));
const dynamicReverse = new Map();
const preserved = 'script,style,svg,code,textarea,[data-ui-preserve],[lang="ar"]:not(html),.word,.mushaf-surah-header,.ayah-number,#surah-ar,#surah-title,#page-label,.word-info-word,.word-info-arabic,.word-info-pronunciation,#teacher-feedback-word,.app-version';
const attributes = ['title', 'aria-label', 'aria-description', 'placeholder', 'alt', 'content'];
let language = 'en', observer, select, started = false;

const digits = value => String(value).replace(/[0-9]/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const canonical = value => dynamicReverse.get(value) || reverse.get(value) || value;

function translateArabic(source, depth = 0) {
  if (!source || depth > 8) return source;
  if (Object.hasOwn(messages, source)) return messages[source];
  for (const [pattern, render] of patterns) {
    const match = source.match(pattern);
    if (match) return render(match, value => translateArabic(value, depth + 1), digits);
  }
  // Counts, percentages and clocks are display text, never input values.
  if (/^[\d\s.,:%/–—→+−-]+$/u.test(source)) return digits(source).replace(/%/g, '٪');
  return source;
}

function translated(value) {
  const content = value.trim();
  if (!content || language === 'en') return value;
  const result = translateArabic(content);
  if (result !== content) {
    const output = value.replace(content, result);
    // Other UI components sometimes mirror an existing status node. Retain
    // its English source too, so switching back never leaves a stale status.
    dynamicReverse.set(output, value);
    if (dynamicReverse.size > 2048) dynamicReverse.delete(dynamicReverse.keys().next().value);
    return output;
  }
  return value;
}

function translateText(node) {
  if (!node.parentElement || node.parentElement.closest(preserved)) return;
  const value = node.nodeValue;
  const previous = textState.get(node);
  const source = previous && value === previous.output ? previous.source : canonical(value);
  const output = translated(source);
  textState.set(node, { source, output });
  if (value !== output) node.nodeValue = output;
}

function translateAttributes(element, only) {
  // Even protected Quran buttons have interface-only accessible labels.
  if (element.closest('script,style,svg,code,textarea,[data-ui-preserve]')) return;
  let state = attributeState.get(element);
  if (!state) { state = new Map(); attributeState.set(element, state); }
  for (const name of only ? [only] : attributes) {
    if (name === 'content' && !element.matches('meta[name="description"]')) continue;
    const value = element.getAttribute(name);
    if (value === null) { state.delete(name); continue; }
    const previous = state.get(name);
    const source = previous && value === previous.output ? previous.source : canonical(value);
    const output = translated(source);
    state.set(name, { source, output });
    if (value !== output) element.setAttribute(name, output);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.matches('script,style,svg,code,textarea,[data-ui-preserve]'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  translateAttributes(root);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) translateText(node);
    else translateAttributes(node);
  }
}

function observe() {
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: attributes });
}

function applyLanguage(next) {
  language = next === 'ar' ? 'ar' : 'en';
  observer.disconnect();
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  select.value = language;
  translateTree(document.documentElement);
  observe();
}

export function setupLanguageControls() {
  if (started || document.documentElement.dataset.uiLanguage !== 'enabled') return;
  started = true;
  // English is the default. Do not infer a different choice from the browser.
  try { if (localStorage.getItem(storageKey) === 'ar') language = 'ar'; } catch {}
  const section = document.createElement('section');
  section.className = 'language-setting'; section.setAttribute('aria-label', 'Language settings');
  const label = document.createElement('label');
  label.htmlFor = 'ui-language'; label.textContent = 'Language:';
  select = document.createElement('select'); select.id = 'ui-language';
  select.setAttribute('aria-label', 'Interface language');
  // Endonyms remain recognizable in either interface language.
  for (const [value, title] of [['en', 'English'], ['ar', 'العربية']]) {
    const option = new Option(title, value);
    option.dataset.uiPreserve = ''; select.append(option);
  }
  section.append(label, select);
  document.querySelector('.book-settings-heading').after(section);
  observer = new MutationObserver(records => {
    // Disconnect while writing translations; do not observe our own edits or
    // repeatedly traverse the Quran when a single status/counter changes.
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'characterData') translateText(record.target);
      else if (record.type === 'attributes') translateAttributes(record.target, record.attributeName);
      else for (const node of record.addedNodes) translateTree(node);
    }
    observe();
  });
  select.addEventListener('change', () => {
    const next = select.value;
    try { localStorage.setItem(storageKey, next); } catch {}
    applyLanguage(next);
  });
  applyLanguage(language);
  window.addEventListener('storage', event => {
    if (event.key === storageKey) applyLanguage(event.newValue);
  });
}
