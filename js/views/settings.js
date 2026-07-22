// views/settings.js — week override, TTS check, data export/reset.
import { el, clear } from '../ui.js';
import { getState, setState, getAll, openDB } from '../db.js';
import { currentWeek } from '../lesson.js';
import { hasKaVoice, speak, NO_VOICE_MSG } from '../tts.js';

export async function renderSettingsView(container) {
  clear(container);
  const week = await currentWeek();
  const override = await getState('weekOverride');
  const startDate = await getState('startDate');

  const weekSel = el('select', {});
  weekSel.append(el('option', { value: '' }, 'automatic (from start date)'));
  for (let w = 1; w <= 52; w++) weekSel.append(el('option', { value: String(w), selected: override === w ? 'true' : null }, `week ${w}`));

  container.append(el('div', { class: 'card stack' },
    el('h2', {}, '⚙️ Settings'),
    el('div', {},
      el('h3', {}, 'Curriculum week'),
      el('p', { class: 'small muted' }, `Started ${startDate || 'today'} · currently week ${week}. Override if the pace feels wrong — the curriculum won’t judge you.`),
      weekSel,
      el('button', {
        class: 'btn small', style: 'margin-top:8px', onclick: async () => {
          await setState('weekOverride', weekSel.value ? Number(weekSel.value) : null);
          alert('Saved. New lessons use the new week.');
        },
      }, 'Save week')),
    el('div', {},
      el('h3', {}, 'Georgian voice (TTS)'),
      hasKaVoice()
        ? el('p', { class: 'small', style: 'color:var(--green)' }, '✓ Georgian (ka-GE) voice found.')
        : el('p', { class: 'small muted' }, NO_VOICE_MSG),
      el('button', { class: 'btn secondary small', onclick: () => speak('გამარჯობა! მე შენი ქართული მასწავლებელი ვარ.') }, '🔊 Test voice')),
    el('div', {},
      el('h3', {}, 'Your data'),
      el('p', { class: 'small muted' }, 'Everything is local: IndexedDB in this browser + the JSON seed files. Export your learning state as a backup.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn secondary small', onclick: exportData }, '⬇ Export state (JSON)'),
        el('button', {
          class: 'btn secondary small', onclick: async () => {
            if (!confirm('Reset ALL progress (cards, reviews, streak, logs)? Seed data files are untouched. This cannot be undone.')) return;
            indexedDB.deleteDatabase('kartuli');
            location.reload();
          },
        }, '🗑 Reset progress'))),
  ));

  async function exportData() {
    const dump = {};
    for (const store of ['cards', 'reviews', 'state', 'speakerLog', 'customVocab']) {
      dump[store] = await getAll(store);
    }
    const blob = new Blob([JSON.stringify(dump, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kartuli-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }
}
