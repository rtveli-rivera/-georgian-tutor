// views/progress.js — streak, level map, per-skill stats, free-talk archive.
import { el, clear, fmtDate } from '../ui.js';
import { DATA } from '../data.js';
import { getState, getAll } from '../db.js';
import { currentWeek, getStreak } from '../lesson.js';
import { allCards } from '../cards.js';
import { listRecordings, playBlob, deleteRecording } from '../recorder.js';

export async function renderProgressView(container) {
  clear(container);
  const week = await currentWeek();
  const streak = await getStreak();
  const cards = await allCards();
  const skillStats = await getState('skillStats', {});
  const lessonLog = await getState('lessonLog', {});
  const speakerLogs = await getAll('speakerLog');
  const reviews = await getAll('reviews');

  const mature = cards.filter(c => c.srs.interval >= 21).length;
  const young = cards.filter(c => c.srs.reps > 0 && c.srs.interval < 21).length;
  const lessonsDone = Object.keys(lessonLog).length;
  const missionsDone = speakerLogs.filter(l => l.done).length;

  container.append(el('div', { class: 'card' },
    el('h2', {}, '📈 Progress'),
    el('div', { class: 'statgrid' },
      stat(`🔥 ${streak.count}`, 'day streak'),
      stat(String(lessonsDone), 'lessons done'),
      stat(String(cards.length), 'cards total'),
      stat(String(mature), 'mature (21d+)'),
      stat(String(young), 'learning'),
      stat(String(missionsDone), 'speaker missions'),
      stat(String(reviews.length), 'total reviews'))));

  // per-skill accuracy
  const skills = ['pronunciation', 'grammar', 'listening', 'speaking', 'writing'];
  container.append(el('div', { class: 'card' },
    el('h2', {}, 'Per-skill accuracy'),
    el('div', { class: 'statgrid' }, skills.map(s => {
      const st = skillStats[s] || { right: 0, total: 0 };
      const pct = st.total ? Math.round((st.right / st.total) * 100) : null;
      return stat(pct === null ? '—' : pct + '%', `${s} (${st.right}/${st.total})`);
    })),
    el('p', { class: 'small muted' }, 'Speaking-task completion: ', String(missionsDone), ' / ', String(DATA.speakerTasks.length), ' missions')));

  // level map
  const map = el('div', { class: 'level-map' });
  for (let w = 1; w <= 52; w++) {
    const cls = w < week ? 'done' : w === week ? 'current' : '';
    const cw = DATA.curriculum[w - 1];
    map.append(el('div', { class: `level-cell ${cls}`, title: cw ? `W${w}: ${cw.title}` : `Week ${w}` }, String(w)));
  }
  const cw = DATA.curriculum[week - 1];
  container.append(el('div', { class: 'card' },
    el('h2', {}, '🗺️ Level map — 52 weeks to conversational'),
    map,
    el('p', { class: 'small muted', style: 'margin-top:8px' }, `Now: week ${week} — ${cw ? cw.title : ''}`)));

  // free talk archive
  const recs = await listRecordings('freetalk');
  const recCard = el('div', { class: 'card' },
    el('h2', {}, '🎙 Free-talk archive'),
    el('p', { class: 'small muted' }, recs.length
      ? 'Your 60-second recordings, newest first. Listen to an old one — hear the difference.'
      : 'No recordings yet. The Saturday lesson includes your weekly 60-second free talk.'));
  for (const r of recs) {
    recCard.append(el('div', { class: 'list-row' },
      el('span', {}, `${fmtDate(r.date)} — ${r.label}`),
      el('span', { class: 'row' },
        el('button', { class: 'btn secondary small', onclick: () => playBlob(r.blob) }, '▶'),
        el('button', {
          class: 'btn secondary small', onclick: async (e) => {
            if (!confirm('Delete this recording?')) return;
            await deleteRecording(r.id);
            e.target.closest('.list-row').remove();
          },
        }, '🗑'))));
  }
  container.append(recCard);
}

function stat(big, label) {
  return el('div', { class: 'stat' }, el('b', {}, big), el('span', {}, label));
}
