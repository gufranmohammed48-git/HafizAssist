let registration;
let label;
function show(message) { if (label) label.textContent = message; }

export async function refreshOfflineStatus() {
  if (!registration?.active) return;
  const channel = new MessageChannel();
  const timer = setTimeout(() => { channel.port1.close(); show('Offline availability could not be confirmed. Reopen the page while connected.'); }, 10000);
  channel.port1.onmessage = ({ data }) => {
    clearTimeout(timer); channel.port1.close();
    if (!data.shell) show('Offline setup is incomplete. Reopen while connected to finish saving the app.');
    else if (!data.model) show('App saved offline · Load the speech model once to finish offline setup.');
    else show(navigator.onLine ? 'Ready offline · App, Quran, and speech model saved on this device.' : 'Offline · Quran and recitation tracking are available on this device.');
    if (registration.waiting) show(label.textContent + ' Update ready: close all HafizAssist tabs and reopen.');
  };
  registration.active.postMessage({ type: 'offline-status' }, [channel.port2]);
}

export async function setupOffline() {
  label = document.createElement('p'); label.className = 'privacy-note'; label.id = 'offline-status';
  label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  document.querySelector('.privacy-note').after(label);
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    show('Offline mode requires a browser with service workers, on HTTPS or localhost.'); return;
  }
  show('Saving the app and Quran for offline use…');
  try {
    registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { updateViaCache: 'none' });
    const watch = () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'redundant') show('Could not save the offline app. Check your connection and available browser storage.');
        if (installing.state === 'activated' || installing.state === 'installed') void refreshOfflineStatus();
      });
    };
    watch(); registration.addEventListener('updatefound', watch);
    navigator.serviceWorker.addEventListener('controllerchange', () => void refreshOfflineStatus());
    window.addEventListener('online', () => void refreshOfflineStatus());
    window.addEventListener('offline', () => void refreshOfflineStatus());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshOfflineStatus(); });
    await refreshOfflineStatus();
  } catch {
    show('Offline setup is unavailable. Allow browser storage and reopen while connected.');
  }
}
