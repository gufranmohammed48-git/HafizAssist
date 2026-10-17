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
  if (document.documentElement.dataset.tajweedReview === 'experimental') {
    const timing = document.createElement('div'); timing.className = 'tajweed-preview-settings';
    const label = document.createElement('label'); label.htmlFor = 'tajweed-speed'; label.textContent = 'Recitation pace';
    const select = document.createElement('select'); select.id = 'tajweed-speed';
    for (const [value, text] of [['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    }
    select.value = 'normal';
    try {
      const saved = localStorage.getItem('recitealquran-tajweed-speed');
      if (['fast', 'normal', 'slow'].includes(saved)) select.value = saved;
    } catch {}
    select.addEventListener('change', () => {
      try { localStorage.setItem('recitealquran-tajweed-speed', select.value); } catch {}
    });
    const note = document.createElement('p'); note.id = 'tajweed-preview-note'; note.className = 'hint';
    note.textContent = 'Experimental timing estimates appear when you hover over a recited word. Pace changes apply to new estimates.';
    select.setAttribute('aria-describedby', note.id);
    timing.append(label, select, note); section('Tajweed preview', timing);
  }
  const tajweedColoursEnabled = document.documentElement.dataset.tajweedColors === 'preview';
  if (tajweedColoursEnabled) {
    const colours = document.createElement('div'); colours.className = 'tajweed-colour-settings';
    const legend = document.createElement('ul'); legend.className = 'tajweed-colour-legend';
    for (const [group, label] of [['madd', 'Madd'], ['ghunnah', 'Ghunnah'], ['idgham', 'Idgham'], ['ikhfa', 'Ikhfa & Iqlab'], ['qalqalah', 'Qalqalah'], ['silent', 'Silent letters']]) {
      const item = document.createElement('li'); item.dataset.tajweedColour = group;
      const swatch = document.createElement('span'); swatch.className = 'tajweed-colour-swatch'; swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch, document.createTextNode(label)); legend.append(item);
    }
    const note = document.createElement('p'); note.className = 'hint';
    note.textContent = 'Use the Tajweed button below Teacher to show or hide colours. Colours are a reading guide; they do not assess your recitation.';
    const status = document.createElement('p'); status.id = 'tajweed-colors-status'; status.className = 'hint';
    status.setAttribute('role', 'status'); status.textContent = 'Preparing Tajweed colours…';
    colours.append(legend, note, status); section('Tajweed colours', colours);
  }
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
  // Keep Settings for reading controls. Existing local practice data is
  // retained, but its history panel and explanatory footer are not shown.
  for (const selector of ['.history', '.privacy-note', 'main > footer']) {
    document.querySelector(selector)?.remove();
  }
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
  const pauseWords = document.documentElement.dataset.teacherPauseWords === '3' ? 'up to the next three words' : 'the next word';
  const teacherHelp = `When Teacher is on, a five-second quiet pause plays ${pauseWords}. If a word is flagged as a possible mistake, Teacher recites that one word correctly so you can listen and try again.`;
  teacherToggle.dataset.help = teacherHelp;
  teacherToggle.removeAttribute('title'); // Use one styled tooltip, without a second native bubble.
  const teacherTooltip = document.createElement('span');
  teacherTooltip.id = 'teacher-tooltip'; teacherTooltip.className = 'book-teacher-tooltip';
  teacherTooltip.setAttribute('role', 'tooltip'); teacherTooltip.textContent = teacherHelp;
  teacherToggle.append(teacherTooltip);
  teacherToggle.setAttribute('aria-describedby', teacherTooltip.id);
  const tajweedToggle = tajweedColoursEnabled ? control('tajweed-colors-toggle', 'Show Tajweed colours',
    '<svg class="tajweed-colour-symbol" width="28" height="28" viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8C11 5 7 5 3 6v19c4-1 8-1 13 2 5-3 9-3 13-2V6c-4-1-8-1-13 2Z" fill="var(--tajweed-icon-paper)" stroke="var(--tajweed-icon-line)" stroke-width="1.6"/><path d="M16 8v19" stroke="var(--tajweed-icon-line)" stroke-width="1.4"/><path class="tajweed-icon-madd" d="M6 11c3-1 5 0 7 1m-7 4c2-.5 4 0 7 1" stroke-width="2"/><path class="tajweed-icon-ghunnah" d="M20 11c2-1 4-1 6-1m-6 5c2-1 4-1 6-1" stroke-width="2"/><path class="tajweed-icon-qalqalah" d="M6 21c2-.5 4 0 7 1m7-2c2-1 4-1 6-1" stroke-width="2"/></svg>') : null;
  if (tajweedToggle) {
    tajweedToggle.setAttribute('aria-pressed', 'false');
    tajweedToggle.setAttribute('aria-describedby', 'tajweed-colors-status');
    tajweedToggle.disabled = true;
  }
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
  recorder.append(record, teacherToggle);
  if (tajweedToggle) recorder.append(tajweedToggle);
  recorder.append(visibility, searchButton, menu);
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
  const languageReady = document.documentElement.dataset.uiLanguage === 'enabled'
    ? import('./ui-language.js').then(module => module.setupLanguageControls()).catch(error => {
      console.error('Language settings could not load:', error);
    }) : Promise.resolve();
  languageReady.then(() => import('./app.js')).catch(error => {
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



