// views/speak.js — speaker task board: browse missions, mark done, log stumbles.
import { el, clear, audioBtn } from '../ui.js';
import { DATA } from '../data.js';
import { getAll, add } from '../db.js';
import { currentWeek, dayKey } from '../lesson.js';

export async function renderSpeakView(container) {
  clear(container);
  const week = await currentWeek();
  const logs = await getAll('speakerLog');
  const doneIds = new Set(logs.filter(l => l.done).map(l => l.taskId));

  const notes = logs.filter(l => l.trippedUp && l.trippedUp.trim()).slice(-8).reverse();
  if (notes.length) {
    container.append(el('div', { class: 'card' },
      el('h2', {}, '🧱 Things that tripped you up'),
      el('p', { class: 'small muted' }, 'These feed future lesson & mission selection.'),
      ...notes.map(n => el('div', { class: 'list-row' },
        el('span', {}, `“${n.trippedUp}”`),
        el('span', { class: 'small muted' }, `${n.date} · ${(n.tags || []).join(', ')}`)))));
  }

  const available = DATA.speakerTasks.filter(t => t.minWeek <= week);
  const upcoming = DATA.speakerTasks.filter(t => t.minWeek > week);

  const listCard = el('div', { class: 'card' },
    el('h2', {}, `🗣️ Missions unlocked (week ${week})`),
    el('p', { class: 'small muted' }, `${doneIds.size} completed · ${available.length} unlocked · ${upcoming.length} still locked`));
  container.append(listCard);

  for (const t of available) {
    const doneMark = doneIds.has(t.id);
    const body = el('div', { class: 'hidden', style: 'margin-top:10px' });
    let loaded = false;
    const row = el('div', { style: 'border-bottom:1px solid var(--border);padding:10px 0' },
      el('div', { class: 'row spread', style: 'cursor:pointer', onclick: () => { if (!loaded) { fill(); loaded = true; } body.classList.toggle('hidden'); } },
        el('div', {}, doneMark ? '✅ ' : '🎯 ', el('b', {}, t.mission.split('.')[0] + '.'),
          el('div', { class: 'small muted' }, `week ${t.minWeek}+ · ${(t.tags || []).join(', ')}`)),
        el('span', { class: 'muted' }, '▾')),
      body);
    listCard.append(row);

    function fill() {
      const notesTa = el('textarea', { placeholder: 'What tripped you up?' });
      body.append(
        el('p', {}, t.mission),
        el('h3', {}, 'Phrases'),
        ...t.phrases.map(p => el('div', { class: 'dialogue-line' },
          el('span', { class: 'ka-md' }, p.ka), audioBtn(p.ka), el('span', { class: 'en small' }, p.en))),
        el('h3', {}, 'They might ask'),
        ...t.theyMayAsk.map(p => el('div', { class: 'dialogue-line' },
          el('span', { class: 'ka-md' }, p.ka), audioBtn(p.ka), el('span', { class: 'en small' }, p.en))),
        notesTa,
        el('div', { class: 'row', style: 'margin-top:8px' },
          el('button', {
            class: 'btn green small', onclick: async (e) => {
              await add('speakerLog', { taskId: t.id, date: dayKey(), done: true, trippedUp: notesTa.value.trim(), tags: t.tags || [] });
              e.target.textContent = '✓ logged';
              e.target.disabled = true;
            },
          }, '✓ Did this one')));
    }
  }
  return;
}
