// Move controls before loading the shared app; all layouts keep shared behavior.
function setupBookLayout() {
  const settings = document.createElement('dialog');
  settings.id = 'book-settings';
  settings.setAttribute('aria-label', 'Search and reading settings');
  settings.innerHTML = '<div class="book-settings-heading"><button type="button" class="icon-button" id="book-close" aria-label="Close reading settings">×</button></div>';
  document.body.append(settings);
  const section = (title, element) => {
    const group = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = title; group.append(heading, element); settings.append(group);
  };
  section('Go to a passage', document.querySelector('.search-surah-row'));
  const recorder = document.querySelector('.recorder-main');
  const record = document.getElementById('record');
  const visibility = document.getElementById('visibility');
  const practiceActions = document.querySelector('.practice-actions');
  practiceActions.insertBefore(document.getElementById('theme'), document.querySelector('.font-controls'));
  document.getElementById('theme').title = 'Switch color theme';
  section('Practice & text size', practiceActions);
  // Keep audio status available to assistive technology without a settings block.
  const teacherStatus = document.createElement('p');
  teacherStatus.id = 'teacher-status'; teacherStatus.className = 'sr-only';
  teacherStatus.setAttribute('role', 'status');
  document.body.append(teacherStatus);
  const teacherFeedback = document.createElement('aside');
  teacherFeedback.id = 'teacher-feedback'; teacherFeedback.hidden = true;
  teacherFeedback.setAttribute('popover', 'manual');
  teacherFeedback.setAttribute('aria-label', 'Teacher feedback');
  teacherFeedback.setAttribute('aria-live', 'polite');
  teacherFeedback.innerHTML = '<div class="teacher-feedback-heading"><span id="teacher-feedback-label"></span><button id="teacher-dismiss" type="button" class="icon-button" aria-label="Dismiss teacher feedback">×</button></div><p id="teacher-feedback-word" lang="ar" dir="rtl"></p><p id="teacher-feedback-detail"></p><button id="teacher-replay" type="button">Replay word</button>';
  document.body.append(teacherFeedback);
  const session = document.createElement('div');
  session.className = 'book-session';
  session.append(document.querySelector('.recitation-counts'), document.querySelector('.session-inline'));
  section('This recitation', session);
  settings.append(document.querySelector('.history'), document.querySelector('.privacy-note'), document.querySelector('main > footer'));
  const svg = paths => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const control = (id, label, icon) => {
    const button = document.createElement('button');
    button.id = id; button.type = 'button'; button.className = 'icon-button book-control';
    button.setAttribute('aria-label', label); button.title = label; button.innerHTML = icon;
    return button;
  };
  // Original, simple teacher silhouette with a board and a raised pointer.
  const teacherSymbol = off => `<svg class="teacher-symbol" width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect x="31" y="5" width="29" height="28" rx="2.5" fill="var(--teacher-board)" stroke="var(--teacher-line)" stroke-width="2.5"/>
    <path d="M45.5 33v8m-7 0h14" fill="none" stroke="var(--teacher-line)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="17" r="8.5" fill="var(--teacher-figure)"/>
    <path d="M4 57V40c0-7 5-12 12-12s12 5 12 12v17Z" fill="var(--teacher-figure)"/>
    <path d="m25 35 11-8" fill="none" stroke="var(--teacher-figure)" stroke-width="6" stroke-linecap="round"/>
    <path d="m36 28 13-17" fill="none" stroke="var(--teacher-accent)" stroke-width="2.8" stroke-linecap="round"/>
    ${off ? '<path d="M48 24h7" fill="none" stroke="var(--teacher-mark)" stroke-width="2.2" stroke-linecap="round"/>' : '<path d="m47 23 3 3 5-6" fill="none" stroke="var(--teacher-mark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'}
  </svg>`;
  const teacherToggle = control('teacher-enabled', 'Turn Teacher on',
    `<span id="teacher-icon-on" hidden>${teacherSymbol(false)}</span><span id="teacher-icon-off">${teacherSymbol(true)}</span>`);
  teacherToggle.setAttribute('aria-pressed', 'false');
  const teacherHelp = 'When Teacher is on, a five-second quiet pause plays the next word. If a word is flagged as a possible mistake, Teacher recites it correctly so you can listen and try again.';
  teacherToggle.dataset.help = teacherHelp;
  teacherToggle.removeAttribute('title'); // Use one styled tooltip, without a second native bubble.
  const teacherTooltip = document.createElement('span');
  teacherTooltip.id = 'teacher-tooltip'; teacherTooltip.className = 'book-teacher-tooltip';
  teacherTooltip.setAttribute('role', 'tooltip'); teacherTooltip.textContent = teacherHelp;
  teacherToggle.append(teacherTooltip);
  teacherToggle.setAttribute('aria-describedby', teacherTooltip.id);
  const searchButton = control('book-search', 'Find a verse by voice', svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'));
  const menu = control('book-menu', 'Open reading settings', svg('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--card)"/><circle cx="15" cy="12" r="2" fill="var(--card)"/><circle cx="9" cy="18" r="2" fill="var(--card)"/>'));
  for (const button of [searchButton, menu]) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
  }
  menu.setAttribute('aria-controls', settings.id);
  searchButton.setAttribute('aria-controls', 'voice-dialog');
  searchButton.disabled = true;
  record.classList.add('book-control'); visibility.classList.add('book-control');
  recorder.append(record, teacherToggle, visibility, searchButton, menu);
  // Browser zoom, sidebars and font size all change the available gutter.
  // Measure the centered page instead of assigning a desktop breakpoint.
  const reader = document.querySelector('.reader');
  let placementFrame;
  function placeControls() {
    const mobile = document.documentElement.dataset.layout === 'mobile';
    const narrow = document.documentElement.clientWidth <= 600;
    const hasGutter = reader.getBoundingClientRect().left >= 78;
    document.body.classList.toggle('book-controls-top', mobile || narrow || !hasGutter);
  }
  function schedulePlacement() {
    cancelAnimationFrame(placementFrame);
    placementFrame = requestAnimationFrame(placeControls);
  }
  placeControls();
  new ResizeObserver(schedulePlacement).observe(reader);
  window.addEventListener('resize', schedulePlacement);
  let settingsOpener = menu;
  function openSettings(opener, target) {
    settingsOpener = opener;
    if (!settings.open) {
      if (!document.body.classList.contains('book-controls-top')) settings.show();
      else settings.showModal();
      document.body.classList.add('book-settings-open');
      menu.setAttribute('aria-expanded', 'true');
    }
    target.focus();
  }
  searchButton.addEventListener('click', () => {
    const voiceOpen = document.getElementById('voice-open');
    if (!voiceOpen.disabled) voiceOpen.click();
  });
  menu.addEventListener('click', () => {
    if (settings.open) { settings.close(); return; }
    openSettings(menu, document.getElementById('book-close'));
  });
  settings.addEventListener('close', () => {
    document.body.classList.remove('book-settings-open');
    menu.setAttribute('aria-expanded', 'false');
    if (settings.contains(document.activeElement)) settingsOpener.focus();
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
  // Close before the shared handler opens voice search.
  document.getElementById('voice-open').addEventListener('click', () => settings.close());
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
      dismissVoicePending = false; voiceClose.click();
    }
  }).observe(voiceClose, { attributes: true, attributeFilter: ['disabled'] });
  voiceDialog.addEventListener('close', () => { dismissVoicePending = false; searchButton.setAttribute('aria-expanded', 'false'); });
  new MutationObserver(() => searchButton.setAttribute('aria-expanded', String(voiceDialog.open)))
    .observe(voiceDialog, { attributes: true, attributeFilter: ['open'] });
  // Successful navigation closes the panel; invalid queries remain visible.
  const passageObserver = new MutationObserver(() => { if (settings.open) settings.close(); });
  passageObserver.observe(document.getElementById('ayahs'), { childList: true });
}

// Surface module-load errors instead of leaving the original loading message.
(() => {
  const passage = document.getElementById('ayahs');
  if (location.protocol === 'file:') {
    const page = location.pathname.split('/').pop() || 'index.html';
    passage.textContent = `Open this page through your local server: http://localhost:5173/${page}. Opening the HTML file directly cannot load the Quran app.`;
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



