// views/review.js — SRS flashcard session (used standalone and inside Today).
// Space = flip, 1-4 = grade.
import { el, clear, audioBtn, slowBtn } from '../ui.js';
import { schedule } from '../srs.js';
import { saveCard, logReview, allCards } from '../cards.js';
import { buildQueue } from '../srs.js';
import { DATA } from '../data.js';
import { speak } from '../tts.js';

const GRADE_LABELS = [null, 'Again', 'Hard', 'Good', 'Easy'];

// Runs a review session over `queue`; calls onFinish(stats).
export function reviewSession(container, queue, onFinish) {
  let i = 0, flipped = false;
  let good = 0, bad = 0;
  const requeued = [];
  let keyHandler = null;

  function teardown() { if (keyHandler) document.removeEventListener('keydown', keyHandler); }

  function render() {
    clear(container);
    const pending = queue.length - i + requeued.length;
    if (i >= queue.length) {
      if (requeued.length) { queue.push(...requeued.splice(0)); return render(); }
      teardown();
      container.append(el('div', { class: 'card', style: 'text-align:center' },
        el('h2', {}, 'Reviews done ✅'),
        el('p', { class: 'muted' }, `${good} passed · ${bad} lapses`)));
      onFinish({ good, bad });
      return;
    }
    const card = queue[i];
    const vocab = DATA.vocabById.get(card.refId);

    const bar = el('div', { class: 'progressbar' }, el('div', { style: `width:${(i / (queue.length + requeued.length)) * 100}%` }));
    const face = el('div', { class: 'card flashcard', onclick: flip },
      el('div', { class: 'small muted' }, card.type === 'sentence' ? 'sentence' : 'word',
        card.srs.lastGrade === null ? ' · NEW' : ''),
      el('div', { class: 'ka' }, card.front),
      el('div', { class: 'row', style: 'justify-content:center;margin-top:10px' }, audioBtn(card.front), slowBtn(card.front)),
      flipped ? el('div', { class: 'hint' },
        el('hr'),
        el('div', { class: 'en', style: 'font-size:1.15rem' }, card.back),
        card.hint ? el('div', { class: 'small muted' }, '🗣 ', card.hint) : null,
        (vocab && vocab.verify) ? el('span', { class: 'verify-flag', title: 'Seed data marked uncertain — confirm with your native speakers' }, '⚑ verify with speaker') : null,
      ) : el('div', { class: 'small muted', style: 'margin-top:14px' }, 'tap or press Space to flip'));

    const grades = el('div', { class: 'grade-row' },
      [1, 2, 3, 4].map(g => el('button', {
        class: `grade-${g}`, disabled: flipped ? null : 'true',
        onclick: () => grade(g),
      }, el('b', {}, String(g)), GRADE_LABELS[g])));

    container.append(bar, el('div', { class: 'small muted', style: 'margin-bottom:6px' }, `${pending} left`), face, flipped ? grades : el('div'));
    if (!flipped && card.type === 'sentence') speak(card.front);
  }

  function flip() { flipped = !flipped; render(); }

  async function grade(g) {
    const card = queue[i];
    card.srs = schedule(card.srs, g);
    await saveCard(card);
    await logReview(card.id, g, card.front);
    if (g === 1) { bad++; requeued.push(card); } else { good++; }
    i++; flipped = false;
    render();
  }

  keyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); flip(); }
    if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key));
  };
  document.addEventListener('keydown', keyHandler);
  render();
  return teardown;
}

// Standalone Review tab.
export async function renderReviewView(container) {
  clear(container);
  const cards = await allCards();
  const queue = buildQueue(cards, Date.now(), 60, 15);
  if (!queue.length) {
    container.append(el('div', { class: 'card' },
      el('h2', {}, 'Nothing due 🎉'),
      el('p', { class: 'muted' }, cards.length
        ? 'All caught up. Come back later, or introduce new material in Today.'
        : 'No cards yet — run your first daily lesson in the Today tab to introduce material.')));
    return;
  }
  const host = el('div');
  container.append(host);
  reviewSession(host, queue, () => {});
}
