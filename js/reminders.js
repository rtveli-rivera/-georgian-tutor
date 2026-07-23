// reminders.js — service-worker registration, update banner, and the
// no-server daily lesson reminder.
//
// How reminders work (same approach as Plant Tracker):
// - In-app: whenever the app is opened/focused (and hourly while open), if
//   reminders are on and today's lesson isn't done, show one notification.
// - Background (installed Android/Chromium PWA only): Periodic Background
//   Sync wakes sw.js ~daily and runs the same check even when the app is
//   closed. iPhone/Safari can't do background reminders without a push
//   server, so there it's open/reopen only.
// - Both paths share the 'notifyLog' day-stamp in IndexedDB, so you never
//   get more than one nudge per calendar day.
// Keep the day-key + copy logic in sync with sw.js.

import { getState, setState } from './db.js';
import { dayKey } from './lesson.js';

let _reg = null;

export async function initServiceWorker(onUpdateReady) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    _reg = await navigator.serviceWorker.register('./sw.js');
  } catch (e) {
    console.warn('SW registration failed (normal on plain http):', e.message);
    return null;
  }

  // Update flow: a new waiting worker → tell the app to show the banner (once).
  let bannerShown = false;
  const notifyIfWaiting = () => {
    if (_reg.waiting && onUpdateReady && !bannerShown) {
      bannerShown = true;
      onUpdateReady(applyUpdate);
    }
  };
  notifyIfWaiting();
  _reg.addEventListener('updatefound', () => {
    const nw = _reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) notifyIfWaiting();
    });
  });
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return;
    refreshed = true;
    location.reload();
  });

  // Check for a new version whenever the app comes to the foreground and hourly.
  // visibilitychange matters on mobile: an installed Android app usually
  // RESUMES (no reload, no focus event), so it's the only signal that fires.
  const check = () => _reg.update().catch(() => {});
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, 60 * 60 * 1000);
  return _reg;
}

function applyUpdate() {
  if (_reg && _reg.waiting) _reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

// Manual check from Settings. Returns 'update-ready' | 'latest' | 'no-sw'.
export async function checkForUpdate() {
  if (!_reg) return 'no-sw';
  try { await _reg.update(); } catch { /* offline etc. */ }
  // Give a found update a moment to reach the waiting state.
  for (let i = 0; i < 20; i++) {
    if (_reg.waiting) return 'update-ready';
    if (!_reg.installing) break;
    await new Promise(r => setTimeout(r, 250));
  }
  return _reg.waiting ? 'update-ready' : 'latest';
}

// ---- reminder preference -------------------------------------------------

export async function remindersEnabled() {
  return !!(await getState('remindersEnabled'));
}

// Returns 'on' | 'denied' | 'unsupported' | 'off'
export async function setRemindersEnabled(on) {
  if (!on) {
    await setState('remindersEnabled', false);
    return 'off';
  }
  if (!('Notification' in window)) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  await setState('remindersEnabled', true);
  await registerPeriodicSync();
  await inAppDailyCheck(); // fire today's nudge immediately if due
  return 'on';
}

// Background wake-ups on installed Android/Chromium PWAs. Harmless no-op elsewhere.
async function registerPeriodicSync() {
  try {
    if (!_reg || !('periodicSync' in _reg)) return false;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await _reg.periodicSync.register('kartuli-daily-check', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}

// ---- in-app daily check (mirrors sw.js runDailyLessonCheck) ---------------

export async function inAppDailyCheck() {
  if (!(await remindersEnabled())) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = dayKey();
  const log = await getState('lessonLog', {});
  if (log[today] && log[today].completed) return;

  const notifyLog = await getState('notifyLog', {});
  if (notifyLog.lesson === today) return;
  notifyLog.lesson = today;
  await setState('notifyLog', notifyLog);

  const streak = await getState('streak', { count: 0, lastDay: null });
  const y = new Date(); y.setDate(y.getDate() - 1);
  const missedYesterday = streak.lastDay !== dayKey(y) && streak.lastDay !== today;

  let title, body;
  if (streak.count >= 2 && missedYesterday) {
    title = '🔥 Your Georgian streak is at risk!';
    body = "You missed yesterday — do today's 25 minutes and start rebuilding. შენ შეგიძლია!";
  } else if (streak.count >= 2) {
    title = '🇬🇪 დღევანდელი გაკვეთილი გელოდება!';
    body = `Today's lesson is waiting. Keep your 🔥 ${streak.count}-day streak alive — it's 25 minutes.`;
  } else {
    title = '🇬🇪 დღევანდელი გაკვეთილი გელოდება!';
    body = "Today's Georgian lesson is waiting — warm-up, reviews, and your speaker mission. 25 minutes.";
  }

  try {
    if (_reg) await _reg.showNotification(title, { body, tag: 'kartuli-daily', icon: './icons/icon-192.png', badge: './icons/icon-192.png' });
    else new Notification(title, { body });
  } catch { /* notification blocked mid-flight; the in-app banner still shows */ }
}

export function startReminderLoop() {
  inAppDailyCheck();
  window.addEventListener('focus', inAppDailyCheck);
  setInterval(inAppDailyCheck, 60 * 60 * 1000);
}
