// views/settings.js — week override, TTS check, data export/reset.
import { el, clear } from '../ui.js';
import { getState, setState, getAll, openDB } from '../db.js';
import { currentWeek } from '../lesson.js';
import { hasKaVoice, speak, noVoiceMsg, voiceCount } from '../tts.js';
import { remindersEnabled, setRemindersEnabled, checkForUpdate, reminderDiagnostics, sendTestNotification } from '../reminders.js';
import { APP_VERSION } from '../app.js';
import { AZURE_VOICES, azureCfg, azureEnabled, saveAzureCfg, azureTest } from '../azuretts.js';
import { playBlob } from '../recorder.js';

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
      el('h3', {}, 'Daily lesson reminder'),
      el('p', { class: 'small muted' },
        'One nudge a day (never more) until the lesson is done. Works while the app is open on any device; installed as an Android app it also fires in the background ~once a day. iPhones only remind when you open the app — Apple allows no more without a cloud server.'),
      await reminderToggle(),
      await reminderStatus()),
    el('div', {},
      el('h3', {}, 'Georgian voice (TTS)'),
      hasKaVoice()
        ? el('p', { class: 'small', style: 'color:var(--green)' }, '✓ Georgian (ka-GE) voice found.')
        : el('p', { class: 'small muted' }, noVoiceMsg()),
      el('p', { class: 'small muted' }, `${voiceCount()} voice${voiceCount() === 1 ? '' : 's'} available in this browser in total. Installed a new voice? Fully close and reopen the app — browsers only refresh the voice list on restart.`),
      el('button', { class: 'btn secondary small', onclick: () => speak('გამარჯობა! მე შენი ქართული მასწავლებელი ვარ.') }, '🔊 Test voice')),
    el('div', {},
      el('h3', {}, 'Natural Georgian voice (optional, free Azure key)'),
      el('p', { class: 'small muted' },
        'The same neural voices desktop Edge uses (ეკა & გიორგი), on any device. ',
        'Get a free key: portal.azure.com → Create a resource → “Speech service” → Free F0 tier → copy Key 1 and the Region. ',
        'The key stays in this browser only; each sentence is fetched from Microsoft once, then cached locally and works offline. ',
        'Your daily use fits comfortably inside the free 500,000 characters/month.'),
      azureSection()),
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
    el('div', { class: 'row' },
      el('span', { class: 'small muted' }, `Kartuli Coach v${APP_VERSION}`),
      updateChecker()),
  ));

  function updateChecker() {
    const msg = el('span', { class: 'small muted' });
    const btn = el('button', {
      class: 'btn secondary small', onclick: async () => {
        btn.disabled = true;
        msg.textContent = ' checking…';
        const r = await checkForUpdate();
        btn.disabled = false;
        if (r === 'update-ready') msg.textContent = ' New version found — use the Update banner at the top ↑';
        else if (r === 'latest') msg.textContent = ' ✓ You’re on the latest version.';
        else msg.textContent = ' Updates unavailable here (no service worker — plain http?).';
      },
    }, '⟳ Check for updates');
    return el('span', { class: 'row' }, btn, msg);
  }

  function azureSection() {
    const cfg = azureCfg() || { enabled: false, region: '', key: '', voice: AZURE_VOICES[0].id };
    const region = el('input', { type: 'text', placeholder: 'Region (e.g. westeurope)', value: cfg.region || '', autocapitalize: 'off', spellcheck: 'false' });
    const key = el('input', { type: 'password', placeholder: 'Azure Speech key', value: cfg.key || '', autocomplete: 'off' });
    const voiceSel = el('select', {}, AZURE_VOICES.map(v =>
      el('option', { value: v.id, selected: cfg.voice === v.id ? 'true' : null }, v.label)));
    const msg = el('p', { class: 'small' });
    const wrap = el('div', { class: 'stack' }, region, key, voiceSel,
      el('div', { class: 'row' },
        el('button', {
          class: 'btn small', onclick: async (e) => {
            e.target.disabled = true;
            msg.textContent = 'Testing…';
            await saveAzureCfg({ enabled: true, region: region.value.trim(), key: key.value.trim(), voice: voiceSel.value });
            const r = await azureTest();
            e.target.disabled = false;
            if (r.ok) {
              msg.textContent = '✓ Working — that’s ' + (voiceSel.value.includes('Eka') ? 'ეკა' : 'გიორგი') + ' you’re hearing. All audio buttons now use this voice.';
              msg.style.color = 'var(--green)';
              playBlob(r.blob);
            } else {
              await saveAzureCfg({ ...azureCfg(), enabled: false });
              msg.textContent = '✗ ' + r.message + ' — check the key and region, then try again.';
              msg.style.color = 'var(--accent)';
            }
          },
        }, 'Save & test'),
        azureEnabled() ? el('button', {
          class: 'btn secondary small', onclick: async (e) => {
            await saveAzureCfg({ ...azureCfg(), enabled: false });
            msg.textContent = 'Natural voice off — using the device voice again.';
            e.target.remove();
          },
        }, 'Turn off') : null),
      msg);
    return wrap;
  }

  async function reminderStatus() {
    const d = await reminderDiagnostics();
    const line = (label, value, good) => el('div', { class: 'small' },
      el('span', { class: 'muted' }, label + ': '),
      el('span', { style: good ? 'color:var(--green)' : 'color:var(--gold)' }, value));
    const msg = el('span', { class: 'small muted' });
    return el('div', { style: 'margin-top:10px' },
      line('Notification permission', d.permission, d.permission === 'granted'),
      line('Background daily check (Android, installed app)', d.periodicSync,
        d.periodicSync === 'registered'),
      line('Last reminder shown', d.lastNotified, d.lastNotified !== 'never'),
      d.periodicSync !== 'registered'
        ? el('p', { class: 'small muted' },
          'Background checks register once the app is installed to the home screen and used a few times — Android grants them based on engagement, and decides the exact delivery moment (usually while charging or on Wi-Fi). Until then, reminders fire when you open the app.')
        : null,
      el('div', { class: 'row', style: 'margin-top:6px' },
        el('button', {
          class: 'btn secondary small', onclick: async () => {
            const r = await sendTestNotification();
            msg.textContent = r === 'sent' ? ' ✓ Sent — did it appear?'
              : r === 'denied' ? ' Notifications are blocked for this app in Android settings.'
              : ' ' + r;
          },
        }, '🔔 Send test notification'), msg));
  }

  async function reminderToggle() {
    const on = await remindersEnabled();
    const msg = el('span', { class: 'small muted' });
    const btn = el('button', {
      class: 'btn small ' + (on ? 'green' : 'secondary'),
      onclick: async () => {
        const wasOn = await remindersEnabled();
        const result = await setRemindersEnabled(!wasOn);
        if (result === 'on') { btn.textContent = '🔔 Reminders on'; btn.className = 'btn small green'; msg.textContent = ''; }
        if (result === 'off') { btn.textContent = '🔕 Reminders off'; btn.className = 'btn small secondary'; msg.textContent = ''; }
        if (result === 'denied') msg.textContent = ' Notifications are blocked for this site — allow them in your browser/site settings, then try again.';
        if (result === 'unsupported') msg.textContent = ' This browser does not support notifications.';
      },
    }, on ? '🔔 Reminders on' : '🔕 Reminders off');
    return el('div', { class: 'row' }, btn, msg);
  }

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
