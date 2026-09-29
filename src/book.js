// Preview-only layout. Move the existing controls so the shared app keeps all
// its event handlers, state, model cache, and microphone behavior.
function setupBookLayout() {
const settings = document.createElement('dialog');
settings.id = 'book-settings';
settings.setAttribute('aria-label', 'Search and reading settings');
settings.innerHTML = `<div class="book-settings-heading"><button type="button" class="icon-button" id="book-close" aria-label="Close reading settings">×</button></div>`;
document.body.append(settings);
const section = (title, element) => {
  const group = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  group.append(heading, element);
  settings.append(group);
};
section('Go to a passage', document.querySelector('.search-surah-row'));
document.querySelector('.practice-actions').insertBefore(document.getElementById('theme'), document.querySelector('.font-controls'));
document.getElementById('theme').title = 'Switch color theme';
section('Practice & text size', document.querySelector('.practice-actions'));
const session = document.createElement('div');
session.className = 'book-session';
session.append(document.querySelector('.recitation-counts'), document.querySelector('.session-inline'));
section('This recitation', session);
settings.append(document.querySelector('.history'), document.querySelector('.privacy-note'), document.querySelector('main > footer'));
const standard = document.createElement('a');
standard.href = './index.html'; standard.textContent = 'Return to the standard view';
standard.className = 'book-standard-link'; settings.append(standard);

const menu = document.createElement('button');
menu.id = 'book-menu'; menu.type = 'button'; menu.className = 'icon-button';
menu.setAttribute('aria-label', 'Open search and reading settings');
menu.setAttribute('aria-haspopup', 'dialog'); menu.setAttribute('aria-controls', settings.id);
menu.title = 'Search & settings';
menu.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--card)"/><circle cx="15" cy="12" r="2" fill="var(--card)"/><circle cx="9" cy="18" r="2" fill="var(--card)"/></svg>`;
document.querySelector('.recorder-main').append(menu);
menu.setAttribute('aria-expanded', 'false');
menu.addEventListener('click', () => {
  if (settings.open) { settings.close(); return; }
  // On wide screens the panel shares the space with the page and microphone.
  // Narrow screens use a modal drawer with native focus containment.
  if (matchMedia('(min-width:1000px)').matches) settings.show();
  else settings.showModal();
  document.body.classList.add('book-settings-open');
  menu.setAttribute('aria-expanded', 'true');
  document.getElementById('book-close').focus();
});
settings.addEventListener('close', () => {
  document.body.classList.remove('book-settings-open');
  menu.setAttribute('aria-expanded', 'false');
  if (settings.contains(document.activeElement)) menu.focus();
});
settings.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); settings.close(); }
});
document.getElementById('book-close').addEventListener('click', () => settings.close());
settings.addEventListener('click', event => {
  if (event.target !== settings) return;
  const bounds = settings.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) settings.close();
});
// Close before the shared handler opens the voice-search dialog.
document.getElementById('voice-open').addEventListener('click', () => settings.close());
// Use the existing close action so dismissing voice search also stops its mic
// and restores practice state. If the engine is starting, finish that first.
const voiceDialog = document.getElementById('voice-dialog');
const voiceClose = document.getElementById('voice-close');
let dismissVoicePending = false;
voiceDialog.addEventListener('click', event => {
  if (event.target !== voiceDialog) return;
  const bounds = voiceDialog.getBoundingClientRect();
  if (event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) return;
  dismissVoicePending = voiceClose.disabled;
  if (!dismissVoicePending) voiceClose.click();
});
new MutationObserver(() => {
  if (dismissVoicePending && !voiceClose.disabled && voiceDialog.open) {
    dismissVoicePending = false;
    voiceClose.click();
  }
}).observe(voiceClose, { attributes: true, attributeFilter: ['disabled'] });
voiceDialog.addEventListener('close', () => { dismissVoicePending = false; });
// Successful navigation closes the panel; invalid queries remain visible.
const passageObserver = new MutationObserver(() => { if (settings.open) settings.close(); });
passageObserver.observe(document.getElementById('ayahs'), { childList: true });
}

// Keep layout errors separate from loading the Quran, and surface module-load
// errors that would otherwise leave the original loading message forever.
(() => {
  const passage = document.getElementById('ayahs');
  if (location.protocol === 'file:') {
    passage.textContent = 'Open this page through your local server: http://localhost:5173/test.html. Opening the HTML file directly cannot load the Quran app.';
    return;
  }
  try { setupBookLayout(); }
  catch (error) { console.error('Book layout setup failed:', error); }
  import('./app.js').catch(error => {
    passage.replaceChildren();
    const message = document.createElement('p');
    message.textContent = 'The Quran app could not start: ' + error.message;
    const help = document.createElement('p');
    help.textContent = 'Please copy this error when reporting the problem.';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Reload page';
    retry.addEventListener('click', () => location.reload());
    passage.append(message, help, retry);
    console.error('Quran app startup failed:', error);
  });
})();
