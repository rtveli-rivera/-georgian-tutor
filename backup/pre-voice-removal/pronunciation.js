// views/pronunciation.js — ejective/aspirate discrimination, ყ, cluster ladders,
// record-and-compare. Georgian's hard sounds, drilled.
import { el, clear, audioBtn, slowBtn, feedback } from '../ui.js';
import { DATA } from '../data.js';
import { speak } from '../tts.js';
import { recordCompare } from './exercise.js';
import { bumpSkill } from './practice.js';

export function renderPronView(container) {
  clear(container);
  const pron = DATA.pronunciation;

  container.append(el('div', { class: 'card' },
    el('h2', {}, '👄 The sounds English doesn’t have'),
    el('p', { class: 'small muted' },
      'Ejectives (წ ჭ კ პ ტ) pop from a closed throat with zero breath; their partners (ც ჩ ქ ფ თ) are breathy like English. ',
      'ყ is made even deeper. Train your ear first, then your mouth.')));

  // --- discrimination game ---
  const game = el('div', { class: 'card' });
  container.append(game);
  renderGame(game, pron);

  // --- browse contrasts ---
  for (const c of pron.contrasts) {
    const card = el('div', { class: 'card' },
      el('h2', {}, c.pair),
      el('p', { class: 'small muted' }, c.note));
    const grid = el('div', { class: 'pair-col' });
    const n = Math.max(c.ejective.length, c.aspirate.length);
    grid.append(el('div', { class: 'small muted', style: 'text-align:center' }, c.pair.split('/')[0].trim() + ' (tight)'),
      el('div', { class: 'small muted', style: 'text-align:center' }, c.pair.split('/')[1].trim() + ' (breathy)'));
    for (let i = 0; i < n; i++) {
      grid.append(wordCell(c.ejective[i]), wordCell(c.aspirate[i]));
    }
    card.append(grid);
    if (c.minimal && c.minimal.length) {
      card.append(el('h3', {}, 'True minimal pairs'),
        ...c.minimal.map(m => el('div', { class: 'row' },
          el('span', { class: 'ka-md' }, m.a), audioBtn(m.a), el('span', { class: 'en small' }, m.enA),
          el('span', { class: 'muted' }, ' vs '),
          el('span', { class: 'ka-md' }, m.b), audioBtn(m.b), el('span', { class: 'en small' }, m.enB))));
    }
    card.append(el('h3', {}, 'Record & compare'),
      el('p', { class: 'small muted' }, 'Say the first tight word, then compare against the model:'),
      recordCompare(c.ejective[0]));
    container.append(card);
  }

  // --- ladders ---
  const lad = el('div', { class: 'card' }, el('h2', {}, '🪜 Cluster ladders'),
    el('p', { class: 'small muted' }, 'Consonant pile-ups, one rung at a time. One of these is your weekly Wednesday drill.'));
  for (const l of DATA.pronunciation.ladders) {
    lad.append(el('div', { class: 'list-row' },
      el('div', { class: 'row' },
        ...l.steps.map((s, i) => el('span', { class: 'row' },
          i ? el('span', { class: 'muted' }, '→') : null,
          el('span', { class: 'ka-md' }, s), audioBtn(s))),
      ),
      el('span', { class: 'en small' }, l.en)));
  }
  container.append(lad);
}

function wordCell(w) {
  if (!w) return el('div');
  return el('div', { class: 'pron-word', onclick: () => speak(w, { rate: 0.8 }) }, w);
}

// Minimal-pair listening discrimination: hear one word, click which column it was.
function renderGame(host, pron) {
  clear(host);
  let round = 0, right = 0;
  host.append(el('h2', {}, '🎯 Ear training: which did you hear?'),
    el('p', { class: 'small muted' }, 'Press play, then pick the word. 10 rounds.'));
  const arena = el('div');
  host.append(arena);
  nextRound();

  function nextRound() {
    clear(arena);
    if (round >= 10) {
      arena.append(feedback(right >= 7, `Score: ${right}/10 ${right >= 7 ? '— sharp ears! 🎉' : '— keep training, it comes.'}`),
        el('button', { class: 'btn secondary small', style: 'margin-top:8px', onclick: () => renderGame(host, pron) }, 'Play again'));
      bumpSkill('pronunciation', right >= 7);
      return;
    }
    const c = pron.contrasts[Math.floor(Math.random() * pron.contrasts.length)];
    const useEj = Math.random() < 0.5;
    const i = Math.floor(Math.random() * Math.min(c.ejective.length, c.aspirate.length));
    const target = useEj ? c.ejective[i] : c.aspirate[i];
    const pair = [c.ejective[i], c.aspirate[i]];
    arena.append(
      el('p', {}, `Round ${round + 1}/10 · contrast ${c.pair}`),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => speak(target, { rate: 0.8 }) }, '🔊 Play'),
        el('button', { class: 'btn secondary small', onclick: () => speak(target, { rate: 0.55 }) }, '🐢 Slow')),
      el('div', { class: 'pair-col', style: 'margin-top:10px;max-width:420px' },
        ...pair.map(w => el('div', {
          class: 'pron-word', onclick: (e) => {
            const ok = w === target;
            if (ok) right++;
            e.target.style.borderColor = ok ? 'var(--green)' : 'var(--accent)';
            round++;
            setTimeout(nextRound, 650);
          },
        }, w))));
    setTimeout(() => speak(target, { rate: 0.8 }), 300);
  }
}
