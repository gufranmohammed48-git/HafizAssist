// The account service never receives speech, transcripts, or per-word history.
// App integration supplies explicit Quran coordinates instead of a display cursor.
const API = '/api/account';
const GUEST_KEY = 'recitealquran-guest-progress-v1';
const ACCOUNT_PREFIX = 'recitealquran-account-progress-v1:';
const LAST_ACCOUNT_KEY = 'recitealquran-last-account-v1';
const SYNC_DELAY = 15000;
const labels = {
  ar: {
    'Sign in': 'تسجيل الدخول', 'Your account': 'حسابك', 'Close account': 'إغلاق الحساب', 'Privacy': 'الخصوصية',
    'Continue with Google': 'المتابعة باستخدام Google', 'Continue as a guest': 'المتابعة كزائر',
    'Save your place': 'احفظ موضعك', 'Sign in to save your place and resume on another device.': 'سجّل الدخول لحفظ موضعك والمتابعة من جهاز آخر.',
    'Reading and practice remain available without an account.': 'يمكنك القراءة والمراجعة دون حساب.',
    'Resume saved position': 'المتابعة من الموضع المحفوظ', 'Resume this device’s position': 'المتابعة من موضع هذا الجهاز',
    'Sign out': 'تسجيل الخروج', 'Delete account': 'حذف الحساب', 'Delete my account': 'حذف حسابي',
    'Cancel': 'إلغاء', 'Keep this device’s position': 'الاحتفاظ بموضع هذا الجهاز',
    'Use account position': 'استخدام موضع الحساب', 'Choose where to continue': 'اختر موضع المتابعة',
    'This device and your account have different saved positions. Choose which one to keep before syncing.': 'الموضع المحفوظ في هذا الجهاز يختلف عن موضع حسابك. اختر الموضع الذي تريد الاحتفاظ به قبل المزامنة.',
    'This device': 'هذا الجهاز', 'Account': 'الحساب', 'Checking account…': 'جارٍ التحقق من الحساب…',
    'Saved on this device': 'محفوظ على هذا الجهاز', 'Saved to your account': 'محفوظ في حسابك',
    'Saving…': 'جارٍ الحفظ…', 'Waiting to sync': 'بانتظار المزامنة',
    'Offline · saved on this device': 'دون اتصال · محفوظ على هذا الجهاز',
    'Pause the microphone before changing accounts or resuming a saved position.': 'أوقف الميكروفون قبل تغيير الحساب أو المتابعة من موضع محفوظ.',
    'Connect to the internet to sign in.': 'اتصل بالإنترنت لتسجيل الدخول.',
    'Accounts are not configured on this server yet. Your device copy is available.': 'لم تُفعّل الحسابات على هذا الخادم بعد. نسختك المحفوظة على الجهاز متاحة.',
    'Could not reach the account service. Your device copy is available.': 'تعذّر الاتصال بخدمة الحسابات. نسختك المحفوظة على الجهاز متاحة.',
    'Please sign in again. Your device copy is available.': 'يرجى تسجيل الدخول مجددًا. نسختك المحفوظة على الجهاز متاحة.',
    'Your Google account changed in another tab. Sign in to connect this reading session.': 'تغيّر حساب Google في علامة تبويب أخرى. سجّل الدخول لربط جلسة القراءة هذه.',
    'Sign-in did not finish. Please try again.': 'لم يكتمل تسجيل الدخول. يرجى المحاولة مجددًا.',
    'This position could not be opened. Your current practice is unchanged.': 'تعذّر فتح هذا الموضع. بقي موضع مراجعتك الحالي كما هو.',
    'This removes your account and its saved progress from the service and this browser. Guest practice is kept separately.': 'سيُحذف حسابك والتقدّم المحفوظ فيه من الخدمة ومن هذا المتصفح. تبقى مراجعة الزائر محفوظة بشكل منفصل.',
    'Account deleted. Guest practice is still available.': 'حُذف الحساب. لا تزال مراجعة الزائر متاحة.',
    'Your browser could not save a local copy. Keep this tab open until account sync finishes.': 'تعذّر حفظ نسخة محلية في المتصفح. اترك علامة التبويب مفتوحة حتى تكتمل مزامنة الحساب.',
    'Choose a saved position to finish connecting this device.': 'اختر موضعًا محفوظًا لإكمال ربط هذا الجهاز.',
    'No saved position yet. Start reading to save your place.': 'لا يوجد موضع محفوظ بعد. ابدأ القراءة لحفظ موضعك.',
    'Progress from another device is available.': 'يوجد تقدّم محفوظ من جهاز آخر.',
  },
};
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function copy(progress) {
  if (!progress || progress.schema !== 1 || !progress.position || !progress.totals) return null;
  const { page, surah, ayah, word, bismillah } = progress.position;
  if (![page, surah, ayah, word].every(Number.isInteger) || page < 1 || page > 604 ||
      surah < 1 || surah > 114 || ayah < 1 || ayah > 286 || word < 0 || word > 300) return null;
  return { schema: 1, position: { page, surah, ayah, word, bismillah: Boolean(bismillah) },
    totals: { correct: Math.max(0, Math.floor(Number(progress.totals.correct) || 0)),
      reviewed: Math.max(0, Math.floor(Number(progress.totals.reviewed) || 0)) },
    updatedAt: Number.isSafeInteger(progress.updatedAt) ? progress.updatedAt : Date.now() };
}
const signature = progress => progress ? JSON.stringify([progress.position, progress.totals]) : '';

export function createAccounts({ capture, restore, isBusy = () => false, subscribe } = {}) {
  if (typeof capture !== 'function' || typeof restore !== 'function') throw new TypeError('Account progress hooks are required.');
  let user = null, csrfToken = null, configured = null, checked = false, refreshing = false;
  const lastAccountId = read(LAST_ACCOUNT_KEY);
  let localOwner = typeof lastAccountId === 'string' ? lastAccountId : null;
  const cachedAccount = localOwner ? read(ACCOUNT_PREFIX + localOwner) : null;
  let local = copy(cachedAccount?.progress) || copy(read(GUEST_KEY)), remote = null;
  let version = Number.isSafeInteger(cachedAccount?.version) ? cachedAccount.version : 0, dirty = Boolean(cachedAccount?.dirty);
  let conflict = false, resolved = false, saving = false, action = false, deleting = false;
  let baseline = null, activityGeneration = 0, timer, closeTimer, message = '', loginError = false, status = 'Checking account…', destroyed = false;
  let storageAvailable = true, resumeAvailable = Boolean(local), lastConfirmedUser = null, identityGeneration = 0, accountSwitchBlocked = false;
  const language = () => document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const text = value => labels[language()]?.[value] || value;
  const busy = () => Boolean(isBusy());
  const key = () => user || localOwner ? ACCOUNT_PREFIX + (user?.id || localOwner) : GUEST_KEY;
  const safeCapture = () => { try { return copy(capture()); } catch { return null; } };
  // Construction happens after Quran loading; the default passage is only a
  // baseline. It never replaces a position saved before this tab was opened.
  baseline = signature(safeCapture()) || null;

  const entry = document.createElement('div');
  entry.className = 'account-entry'; entry.dataset.uiPreserve = '';
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'account-open'; button.className = 'account-orb';
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<svg class="account-orb-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true"><defs><linearGradient id="account-orb-back" x1="7" y1="3" x2="43" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="var(--account-light)"/><stop offset="1" stop-color="var(--account-deep)"/></linearGradient><linearGradient id="account-orb-person" x1="14" y1="10" x2="34" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset="1" stop-color="var(--account-person)"/></linearGradient></defs><rect x="4" y="4" width="40" height="40" rx="14" fill="url(#account-orb-back)"/><path d="M8 21V17c0-5 4-9 9-9h12" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="19" r="6.5" fill="url(#account-orb-person)"/><path d="M12.5 35.5c.4-5.3 4.7-8.5 11.5-8.5s11.1 3.2 11.5 8.5c-5.9 3.8-17.1 3.8-23 0Z" fill="url(#account-orb-person)"/><path d="M19 13.5c2-1.6 5-1.8 7.5-.7" stroke="#fff" stroke-opacity=".7" stroke-width="1.3" stroke-linecap="round"/></svg><span class="account-orb-dot" aria-hidden="true"></span>';
  entry.append(button);
  const badge = document.querySelector('.app-version');
  if (badge) badge.before(entry); else (document.querySelector('.header') || document.body).append(entry);

  const dialog = document.createElement('dialog');
  dialog.id = 'account-dialog'; dialog.className = 'account-dialog'; dialog.dataset.uiPreserve = '';
  dialog.setAttribute('aria-labelledby', 'account-title');
  // User/provider strings are assigned with textContent below, never HTML.
  dialog.innerHTML = `<div class="account-dialog-inner"><div class="account-dialog-heading"><h2 id="account-title"></h2><button type="button" class="account-close" data-action="close">×</button></div>
    <div class="account-identity" hidden><span class="account-identity-avatar" aria-hidden="true"></span><div><strong class="account-name" dir="auto"></strong><span class="account-email" dir="auto"></span></div></div>
    <p class="account-intro"></p><p class="account-status" role="status"></p><p class="account-message" role="status" hidden></p>
    <div class="account-choice" hidden><h3></h3><p></p><div class="account-position-row"><span class="account-local-position"></span><span class="account-cloud-position"></span></div><button type="button" class="account-primary" data-action="local"></button><button type="button" class="account-secondary" data-action="cloud"></button></div>
    <button type="button" class="account-primary account-google" data-action="google"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.3l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14.1a6 6 0 0 1 0-4.2V7.3H3.1a10 10 0 0 0 0 9.4l3.3-2.6Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.3l3.3 2.6c.8-2.3 3-4 5.6-4Z"/></svg><span></span></button>
    <button type="button" class="account-primary" data-action="resume" hidden></button><button type="button" class="account-secondary" data-action="guest"></button>
    <div class="account-member-actions" hidden><button type="button" class="account-secondary" data-action="logout"></button><button type="button" class="account-delete-link" data-action="delete"></button></div>
    <div class="account-delete-confirm" hidden><p></p><button type="button" class="account-danger" data-action="confirm-delete"></button><button type="button" class="account-secondary" data-action="cancel-delete"></button></div>
    <p class="account-busy-note" hidden></p><a class="account-privacy" href="/privacy.html" target="_blank" rel="noopener"></a></div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const actionButton = name => $(`[data-action="${name}"]`);

  function place() {
    const bounds = badge?.getBoundingClientRect();
    entry.style.right = bounds?.width ? `${Math.max(8, innerWidth - bounds.left + 8)}px` : '10px';
    entry.style.top = bounds?.width ? `${Math.max(4, bounds.top + bounds.height / 2 - 20)}px` : '10px';
    const practice = document.querySelector('.practice');
    // Compare horizontal space only. Moving the toolbar down must not make
    // this condition disappear and send it back up on the next observation.
    const crowded = document.body.classList.contains('book-controls-top') && practice &&
      practice.getBoundingClientRect().right + 8 > entry.getBoundingClientRect().left;
    document.body.classList.toggle('account-header-room', Boolean(crowded));
  }
  const placementObserver = new ResizeObserver(place);
  if (badge) placementObserver.observe(badge);
  const practice = document.querySelector('.practice');
  if (practice) placementObserver.observe(practice);
  const layoutObserver = new MutationObserver(place);
  layoutObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', place); place();

  function describe(progress, prefix) {
    if (!progress) return text('No saved position yet. Start reading to save your place.');
    const p = progress.position;
    const n = value => new Intl.NumberFormat(language(), { useGrouping: false }).format(value);
    return language() === 'ar' ? `${text(prefix)} · الصفحة ${n(p.page)} · ${n(p.surah)}:${n(p.ayah)}` :
      `${prefix} · Page ${p.page} · ${p.surah}:${p.ayah}`;
  }
  function render() {
    if (destroyed) return;
    const occupied = busy();
    button.classList.toggle('is-signed-in', Boolean(user));
    button.classList.toggle('needs-choice', conflict);
    button.setAttribute('aria-label', text(user ? 'Your account' : 'Sign in'));
    button.title = text(user ? 'Your account' : 'Sign in');
    $('#account-title').textContent = text(user ? 'Your account' : 'Save your place');
    actionButton('close').setAttribute('aria-label', text('Close account'));
    $('.account-identity').hidden = !user;
    $('.account-name').textContent = user?.name || '';
    $('.account-email').textContent = user?.email || '';
    $('.account-identity-avatar').textContent = (user?.name || 'R').trim().slice(0, 1).toLocaleUpperCase();
    $('.account-intro').hidden = Boolean(user);
    $('.account-intro').textContent = text('Sign in to save your place and resume on another device.');
    $('.account-status').textContent = text(storageAvailable ? status : 'Your browser could not save a local copy. Keep this tab open until account sync finishes.');
    const detail = message || (loginError ? 'Sign-in did not finish. Please try again.' : '');
    $('.account-message').hidden = !detail; $('.account-message').textContent = text(detail);
    $('.account-choice').hidden = !conflict;
    $('.account-choice h3').textContent = text('Choose where to continue');
    $('.account-choice > p').textContent = text('This device and your account have different saved positions. Choose which one to keep before syncing.');
    $('.account-local-position').textContent = describe(local, 'This device');
    $('.account-cloud-position').textContent = describe(remote, 'Account');
    actionButton('local').textContent = text('Keep this device’s position');
    actionButton('cloud').textContent = text('Use account position');
    actionButton('cloud').hidden = !remote;
    actionButton('google').hidden = Boolean(user); actionButton('google').querySelector('span').textContent = text('Continue with Google');
    actionButton('google').disabled = occupied || action || refreshing || !navigator.onLine || configured === false;
    actionButton('resume').hidden = conflict || !resumeAvailable;
    actionButton('resume').textContent = text(user ? 'Resume saved position' : 'Resume this device’s position');
    actionButton('guest').hidden = Boolean(user); actionButton('guest').textContent = text('Continue as a guest');
    actionButton('guest').title = text('Reading and practice remain available without an account.');
    $('.account-member-actions').hidden = !user || deleting;
    actionButton('logout').textContent = text('Sign out'); actionButton('delete').textContent = text('Delete account');
    $('.account-delete-confirm').hidden = !deleting;
    $('.account-delete-confirm p').textContent = text('This removes your account and its saved progress from the service and this browser. Guest practice is kept separately.');
    actionButton('confirm-delete').textContent = text('Delete my account'); actionButton('cancel-delete').textContent = text('Cancel');
    for (const name of ['resume', 'local', 'cloud', 'logout', 'delete', 'confirm-delete']) actionButton(name).disabled = occupied || action || saving || refreshing || (['logout', 'delete', 'confirm-delete'].includes(name) && !navigator.onLine);
    $('.account-busy-note').hidden = !occupied;
    $('.account-busy-note').textContent = text('Pause the microphone before changing accounts or resuming a saved position.');
    $('.account-privacy').textContent = text('Privacy');
    dialog.dir = language() === 'ar' ? 'rtl' : 'ltr';
  }
  function persist() {
    if (!local) return;
    storageAvailable = write(key(), user || localOwner ? { progress: local, version, dirty } : local);
  }
  function setStatus(next, detail = '') { status = next; message = detail; render(); }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(API + path, { ...options, credentials: 'same-origin', cache: 'no-store',
        signal: controller.signal, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.method && options.method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          ...(path !== '/me' && user ? { 'X-Account-User': user.id } : {}), ...options.headers } });
      const contentType = response.headers.get('Content-Type') || '';
      // A static development server may return index.html for an unknown API.
      if (!contentType.includes('application/json')) throw Object.assign(new Error('unconfigured'), { status: 503, data: { configured: false } });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || 'account'), { status: response.status, data });
      return data;
    } finally { clearTimeout(timeout); }
  }
  function failure(error) {
    if (error.status === 401) {
      // Pending account data remains in its own key. Never copy it into a
      // guest record or the next Google account after a session expires.
      persist(); identityGeneration++;
      user = null; localOwner = null; csrfToken = null; resolved = false; conflict = false;
      local = copy(read(GUEST_KEY)); dirty = false; remote = null; version = 0;
      try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch {}
      baseline = signature(safeCapture()) || null;
      resumeAvailable = Boolean(local);
      setStatus('Saved on this device', 'Please sign in again. Your device copy is available.');
    } else if (!navigator.onLine) setStatus('Offline · saved on this device');
    else if (error.data?.configured === false) setStatus('Saved on this device', 'Accounts are not configured on this server yet. Your device copy is available.');
    else setStatus('Saved on this device', 'Could not reach the account service. Your device copy is available.');
  }
  function queue() {
    clearTimeout(timer);
    if (user && resolved && dirty && !conflict && navigator.onLine) timer = setTimeout(() => void flush(), SYNC_DELAY);
  }
  function changed({ initial = false } = {}) {
    if (destroyed) return;
    const snapshot = safeCapture();
    if (!snapshot) { render(); return; }
    const nextSignature = signature(snapshot);
    if (initial || baseline === null) { baseline = nextSignature; render(); return; }
    if (nextSignature === baseline) { render(); return; }
    baseline = nextSignature;
    activityGeneration++;
    local = { ...snapshot, updatedAt: Date.now() };
    dirty = true; resumeAvailable = true; persist();
    if (user && !resolved && remote && signature(local) !== signature(remote)) conflict = true;
    setStatus(!navigator.onLine ? 'Offline · saved on this device' : user && resolved ? 'Waiting to sync' : 'Saved on this device');
    queue();
  }
  async function getRemote() {
    const data = await request('/progress');
    remote = copy(data.progress); version = Number.isSafeInteger(data.version) ? data.version : 0;
    return data;
  }
  async function flush({ keepalive = false } = {}) {
    clearTimeout(timer);
    if (destroyed || saving || refreshing || !user || !csrfToken || !resolved || conflict || !dirty || !local || !navigator.onLine) return;
    saving = true; const snapshot = copy(local), owner = user.id, generation = identityGeneration;
    setStatus('Saving…');
    try {
      const data = await request('/progress', { method: 'PUT', keepalive,
        body: JSON.stringify({ progress: snapshot, expectedVersion: version }) });
      if (user?.id !== owner || generation !== identityGeneration) return;
      version = data.version; remote = snapshot;
      dirty = signature(local) !== signature(snapshot);
      persist(); setStatus(dirty ? 'Waiting to sync' : 'Saved to your account');
    } catch (error) {
      if (user?.id !== owner || generation !== identityGeneration) return;
      if (error.status === 409) {
        remote = copy(error.data?.progress); version = Number.isSafeInteger(error.data?.version) ? error.data.version : version;
        conflict = true; resolved = false; persist();
        setStatus('Choose a saved position to finish connecting this device.');
      } else failure(error);
    } finally { saving = false; render(); if (dirty && resolved) queue(); }
  }
  async function refresh() {
    if (destroyed || refreshing || action || saving || accountSwitchBlocked) return;
    if (!navigator.onLine) { setStatus('Offline · saved on this device'); return; }
    refreshing = true; render();
    try {
      const account = await request('/me'); configured = account.configured !== false; checked = true;
      const previousId = user?.id;
      if (previousId && account.user?.id && String(account.user.id) !== previousId) {
        // The cookie can change in a different tab. Do not quietly attach an
        // ongoing reading session to that other person's account.
        failure({ status: 401 }); accountSwitchBlocked = true;
        message = 'Your Google account changed in another tab. Sign in to connect this reading session.';
        return;
      }
      user = account.user?.id ? { id: String(account.user.id), name: String(account.user.name || 'Reader'), email: String(account.user.email || '') } : null;
      if (user?.id !== previousId) identityGeneration++;
      csrfToken = account.csrfToken || null;
      if (!user) {
        if (localOwner) {
          localOwner = null; local = copy(read(GUEST_KEY)); dirty = false; version = 0; remote = null;
          try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch {}
          baseline = signature(safeCapture()) || null;
        }
        conflict = false; resolved = false; resumeAvailable = Boolean(local || copy(read(GUEST_KEY)));
        setStatus(local ? 'Saved on this device' : 'No saved position yet. Start reading to save your place.'); return;
      }
      const firstConnection = previousId !== user.id || lastConfirmedUser !== user.id;
      const saved = firstConnection ? read(ACCOUNT_PREFIX + user.id) : null;
      let ownedLocal = localOwner === user.id;
      if (firstConnection) {
        const accountCopy = copy(saved?.progress);
        // If practice began while authentication was being checked, retain
        // that progress rather than replacing it with a stale browser copy.
        const currentPractice = activityGeneration > 0 && (!localOwner || localOwner === user.id) ? local : null;
        local = currentPractice || accountCopy || copy(read(GUEST_KEY));
        ownedLocal = Boolean(accountCopy && !currentPractice) || Boolean(currentPractice && localOwner === user.id);
        dirty = Boolean(currentPractice && dirty) || Boolean(saved?.dirty) || Boolean(local && !accountCopy);
        version = Number.isSafeInteger(saved?.version) ? saved.version : 0;
        localOwner = user.id; write(LAST_ACCOUNT_KEY, user.id);
        resolved = false;
      }
      const oldVersion = version;
      await getRemote();
      lastConfirmedUser = user.id;
      if (remote && local && signature(remote) !== signature(local) && (!ownedLocal || version !== oldVersion)) {
        conflict = true; resolved = false; resumeAvailable = true;
        setStatus('Choose a saved position to finish connecting this device.');
      } else if (remote && !local) {
        conflict = false; resolved = false; resumeAvailable = true;
        setStatus('Progress from another device is available.');
      } else {
        conflict = false; resolved = true; resumeAvailable = Boolean(remote || local);
        if (remote && local && signature(remote) === signature(local)) dirty = false;
        persist(); setStatus(dirty ? 'Waiting to sync' : remote ? 'Saved to your account' : 'No saved position yet. Start reading to save your place.');
        queue();
      }
    } catch (error) {
      if (error.data?.configured === false) configured = false;
      checked = true; failure(error);
    } finally { refreshing = false; render(); if (resolved && dirty) queue(); }
  }
  function close() {
    clearTimeout(closeTimer); dialog.classList.remove('is-visible'); button.setAttribute('aria-expanded', 'false');
    closeTimer = setTimeout(() => { if (dialog.open) dialog.close(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 190);
  }
  function open() {
    clearTimeout(closeTimer); render();
    if (!dialog.open) dialog.showModal();
    button.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { if (dialog.open) dialog.classList.add('is-visible'); });
    if (!checked || configured === false) void refresh();
  }
  async function resume(progress, accountPosition = false, chooseLocal = false) {
    if (!progress || busy() || action || refreshing || saving) return;
    action = true; render();
    try {
      const result = await restore(copy(progress));
      if (result === false) throw new Error('position');
      local = copy(progress); baseline = signature(safeCapture() || progress);
      if (accountPosition) { dirty = false; resolved = true; conflict = false; }
      if (chooseLocal) { dirty = true; resolved = true; conflict = false; }
      persist(); message = ''; loginError = false; resumeAvailable = true; close();
      if (chooseLocal) { setStatus('Waiting to sync'); void flush(); }
    } catch { message = 'This position could not be opened. Your current practice is unchanged.'; }
    finally { action = false; render(); }
  }
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { dialog.classList.remove('is-visible'); deleting = false; button.setAttribute('aria-expanded', 'false'); button.focus(); });
  button.addEventListener('click', open);
  for (const name of ['close', 'guest']) actionButton(name).addEventListener('click', close);
  actionButton('google').addEventListener('click', () => {
    if (busy() || action || !navigator.onLine) return;
    changed(); persist(); accountSwitchBlocked = false;
    const returnTo = ['/', '/index.html', '/mobile.html', '/test.html', '/test2.html'].includes(location.pathname) ? location.pathname : '/';
    location.assign(`${API}/login?returnTo=${encodeURIComponent(returnTo)}`);
  });
  actionButton('resume').addEventListener('click', () => void resume(user ? remote || local : local, Boolean(user && remote)));
  actionButton('cloud').addEventListener('click', () => void resume(remote, true));
  actionButton('local').addEventListener('click', () => void resume(local, false, true));
  actionButton('delete').addEventListener('click', () => { deleting = true; render(); });
  actionButton('cancel-delete').addEventListener('click', () => { deleting = false; render(); });
  async function leave(remove) {
    if (busy() || action || refreshing || !navigator.onLine) return;
    action = true; render();
    try {
      await flush();
      await request(remove ? '/account' : '/logout', { method: remove ? 'DELETE' : 'POST' });
      if (remove && user) { try { localStorage.removeItem(ACCOUNT_PREFIX + user.id); } catch {} }
      identityGeneration++;
      user = null; localOwner = null; csrfToken = null; resolved = false; conflict = false; deleting = false; dirty = false; version = 0; remote = null;
      try { localStorage.removeItem(LAST_ACCOUNT_KEY); } catch {}
      local = copy(read(GUEST_KEY)); baseline = signature(safeCapture()) || null; activityGeneration = 0;
      resumeAvailable = Boolean(local);
      setStatus('Saved on this device', remove ? 'Account deleted. Guest practice is still available.' : '');
    } catch (error) { failure(error); }
    finally { action = false; render(); }
  }
  actionButton('logout').addEventListener('click', () => void leave(false));
  actionButton('confirm-delete').addEventListener('click', () => void leave(true));
  const languageObserver = new MutationObserver(render);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  const online = () => { void refresh().then(() => { if (resolved) void flush(); }); };
  const offline = () => setStatus('Offline · saved on this device');
  const visibility = () => {
    if (document.hidden) { changed(); void flush({ keepalive: true }); }
    else if (!busy()) void refresh();
  };
  const pagehide = () => { changed(); void flush({ keepalive: true }); };
  window.addEventListener('online', online); window.addEventListener('offline', offline);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', pagehide);
  const unsubscribe = subscribe?.(changed);
  const url = new URL(location.href);
  if (url.searchParams.has('account')) {
    if (url.searchParams.get('account') === 'error') loginError = true;
    url.searchParams.delete('account'); history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    queueMicrotask(open);
  }
  render(); void refresh();
  return { changed, flush, refresh, open, destroy() {
    destroyed = true; clearTimeout(timer); clearTimeout(closeTimer); unsubscribe?.();
    placementObserver.disconnect(); layoutObserver.disconnect(); languageObserver.disconnect();
    window.removeEventListener('resize', place); window.removeEventListener('online', online); window.removeEventListener('offline', offline);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pagehide);
    entry.remove(); dialog.remove();
  } };
}
