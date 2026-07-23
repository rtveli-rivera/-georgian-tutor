// sw.js — service worker: offline cache + daily lesson reminder (no server).
//
// Cache strategy: cache-first for the app shell (fully static). Bump CACHE
// (via bump.py) when files change so browsers notice a new release.

const CACHE = 'kartuli-v5';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/srs.js',
  './js/conjugation.js',
  './js/cards.js',
  './js/data.js',
  './js/lesson.js',
  './js/exercises.js',
  './js/tts.js',
  './js/recorder.js',
  './js/reminders.js',
  './js/azuretts.js',
  './vendor/speech-sdk.min.js',
  './js/ui.js',
  './js/views/today.js',
  './js/views/review.js',
  './js/views/practice.js',
  './js/views/pronunciation.js',
  './js/views/exercise.js',
  './js/views/speak.js',
  './js/views/progress.js',
  './js/views/library.js',
  './js/views/settings.js',
  './data/vocab1.json',
  './data/vocab2.json',
  './data/vocab3.json',
  './data/dialogues1.json',
  './data/dialogues2.json',
  './data/verbs1.json',
  './data/verbs2.json',
  './data/grammar.json',
  './data/curriculum.json',
  './data/speaker_tasks.json',
  './data/register.json',
  './data/pronunciation.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache:'reload' so a version bump always pulls fresh files, never a
      // stale copy from the browser's HTTP cache.
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))),
    // No skipWaiting(): the new worker waits so the app can show an Update
    // banner instead of swapping code out from under the user.
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok && new URL(request.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});

// ---- Daily lesson reminder (no server) -----------------------------------
// The app stores everything in IndexedDB 'kartuli', store 'state' ({key, value}).
// On installed Android (Chromium) PWAs, Periodic Background Sync wakes us
// ~daily; we check whether today's lesson is done and nudge if not.
// Keep the day-key + copy logic in sync with js/reminders.js.

function idbGetState(key) {
  return new Promise((resolve) => {
    const req = indexedDB.open('kartuli');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) { resolve(null); return; }
      const g = db.transaction('state', 'readonly').objectStore('state').get(key);
      g.onsuccess = () => resolve(g.result ? g.result.value : null);
      g.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

function idbPutState(key, value) {
  return new Promise((resolve) => {
    const req = indexedDB.open('kartuli');
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) { resolve(false); return; }
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    };
    req.onerror = () => resolve(false);
  });
}

function dayKey(d = new Date()) {
  // Local-time day key so "today" matches what the learner sees.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reminderCopy(streak, missedYesterday) {
  if (streak >= 2 && missedYesterday) {
    return {
      title: '🔥 Your Georgian streak is at risk!',
      body: `You missed yesterday — do today's 25 minutes and start rebuilding. შენ შეგიძლია!`,
    };
  }
  if (streak >= 2) {
    return {
      title: `🇬🇪 დღევანდელი გაკვეთილი გელოდება!`,
      body: `Today's lesson is waiting. Keep your 🔥 ${streak}-day streak alive — it's 25 minutes.`,
    };
  }
  return {
    title: '🇬🇪 დღევანდელი გაკვეთილი გელოდება!',
    body: "Today's Georgian lesson is waiting — warm-up, reviews, and your speaker mission. 25 minutes.",
  };
}

async function runDailyLessonCheck() {
  const enabled = await idbGetState('remindersEnabled');
  if (!enabled) return;

  const today = dayKey();
  const log = (await idbGetState('lessonLog')) || {};
  if (log[today] && log[today].completed) return; // lesson already done today

  // Once per calendar day, shared with the in-app notifier.
  const notifyLog = (await idbGetState('notifyLog')) || {};
  if (notifyLog.lesson === today) return;
  notifyLog.lesson = today;
  await idbPutState('notifyLog', notifyLog);

  const streakRow = (await idbGetState('streak')) || { count: 0, lastDay: null };
  const y = new Date(); y.setDate(y.getDate() - 1);
  const missedYesterday = streakRow.lastDay !== dayKey(y) && streakRow.lastDay !== today;

  const msg = reminderCopy(streakRow.count || 0, missedYesterday);
  await self.registration.showNotification(msg.title, {
    body: msg.body,
    tag: 'kartuli-daily',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'kartuli-daily-check') event.waitUntil(runDailyLessonCheck());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow('./index.html') : undefined;
    }),
  );
});
