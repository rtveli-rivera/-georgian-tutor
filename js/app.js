// app.js — shell: load data, init voice, route between views.
const APP_VERSION = '1.0.10';
export { APP_VERSION };
import { loadData, DATA } from './data.js';
import { initServiceWorker, startReminderLoop } from './reminders.js';
import { initAzureTts } from './azuretts.js';
import { voicesReady } from './tts.js';
import { el, clear } from './ui.js';
import { getStreak } from './lesson.js';
import { renderTodayView } from './views/today.js';
import { renderReviewView } from './views/review.js';
import { renderPracticeView } from './views/practice.js';
import { renderPronView } from './views/pronunciation.js';
import { renderSpeakView } from './views/speak.js';
import { renderProgressView } from './views/progress.js';
import { renderLibraryView } from './views/library.js';
import { renderSettingsView } from './views/settings.js';

const VIEWS = {
  today: renderTodayView,
  review: renderReviewView,
  practice: renderPracticeView,
  pron: renderPronView,
  speak: renderSpeakView,
  progress: renderProgressView,
  library: renderLibraryView,
  settings: renderSettingsView,
};

const main = document.getElementById('view');

async function boot() {
  main.append(el('div', { class: 'card' }, el('p', { class: 'muted' }, 'იტვირთება… loading…')));
  await Promise.all([loadData(), voicesReady(), initAzureTts()]);

  // (No-voice warning banner removed by request — voice status now lives
  //  only in Settings. The banner element still surfaces data-load errors.)
  if (DATA.loadErrors.length) {
    const b = document.getElementById('tts-banner');
    b.classList.remove('hidden');
    b.textContent = `⚠ Some seed files failed to load: ${DATA.loadErrors.join('; ')}`;
  }

  const streak = await getStreak();
  document.getElementById('streak-chip').textContent = `🔥 ${streak.count}`;

  // PWA: offline cache + update banner + daily reminder loop.
  initServiceWorker((apply) => {
    const bar = document.getElementById('update-banner');
    bar.classList.remove('hidden');
    bar.append(
      el('span', {}, '🍇 A new version is ready — '),
      el('button', { class: 'btn small', onclick: apply }, 'Update'));
  });
  startReminderLoop();

  document.querySelectorAll('#nav button').forEach(btn => {
    btn.addEventListener('click', () => show(btn.dataset.view));
  });
  show('today');
}

async function show(name) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  clear(main);
  try {
    await VIEWS[name](main);
  } catch (e) {
    console.error(e);
    main.append(el('div', { class: 'banner' }, `Something broke rendering “${name}”: ${e.message}`));
  }
}

boot();
