// views/practice.js — free practice: pick any exercise type, endless rounds.
import { el, clear } from '../ui.js';
import { EXERCISE_TYPES, generate } from '../exercises.js';
import { renderExercise } from './exercise.js';
import { currentWeek } from '../lesson.js';
import { getState, setState } from '../db.js';

export async function renderPracticeView(container) {
  clear(container);
  const week = await currentWeek();
  const picker = el('div', { class: 'card' },
    el('h2', {}, '🏋️ Practice — pick a drill'),
    el('p', { class: 'small muted' }, `Exercises draw from everything introduced up to week ${week}.`),
    el('div', { class: 'row' }, EXERCISE_TYPES.map(t =>
      el('button', { class: 'btn secondary small', onclick: () => start(t.id) }, `${t.label}`))));
  const arena = el('div');
  container.append(picker, arena);

  let score = { right: 0, total: 0 };

  async function start(typeId) {
    score = { right: 0, total: 0 };
    round(typeId);
  }

  function round(typeId) {
    clear(arena);
    const scoreChip = el('span', { class: 'chip' }, `✓ ${score.right}/${score.total}`);
    const host = el('div', { class: 'card' });
    arena.append(el('div', { class: 'row spread', style: 'margin-bottom:8px' },
      el('h2', { style: 'margin:0' }, EXERCISE_TYPES.find(t => t.id === typeId).label), scoreChip), host);
    const spec = generate(typeId, week, Math.random);
    renderExercise(host, spec, async (r) => {
      score.total++;
      if (r.ok) score.right++;
      await bumpSkill(EXERCISE_TYPES.find(t => t.id === typeId).skill, !!r.ok);
      host.append(el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn', onclick: () => round(typeId) }, 'Next round →'),
        el('button', { class: 'btn secondary', onclick: () => clear(arena) }, 'Stop')));
    });
  }
}

export async function bumpSkill(skill, ok) {
  const stats = await getState('skillStats', {});
  if (!stats[skill]) stats[skill] = { right: 0, total: 0 };
  stats[skill].total++;
  if (ok) stats[skill].right++;
  await setState('skillStats', stats);
}
