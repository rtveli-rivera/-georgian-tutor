// cards.js — SRS card creation & access. Sentence cards outrank word cards:
// every vocab item yields 1 word card + 2 sentence cards.
import { getAll, bulkPut, put, add } from './db.js';
import { newSrsState } from './srs.js';

export function cardsForVocabItem(v, now = Date.now()) {
  const cards = [];
  cards.push({
    id: `w:${v.id}`,
    type: 'vocab',
    refId: v.id,
    front: v.ka,
    back: v.en,
    hint: v.pron || null,
    week: v.week || 1,
    tags: v.tags || [],
    srs: newSrsState(now),
    suspended: false,
  });
  (v.sentences || []).forEach((s, i) => {
    cards.push({
      id: `s:${v.id}:${i}`,
      type: 'sentence',
      refId: v.id,
      front: s.ka,
      back: s.en,
      hint: null,
      week: v.week || 1,
      tags: v.tags || [],
      srs: newSrsState(now),
      suspended: false,
    });
  });
  return cards;
}

export async function introduceVocab(items) {
  const existing = new Set((await getAll('cards')).map(c => c.id));
  const fresh = [];
  const now = Date.now();
  for (const v of items) {
    for (const c of cardsForVocabItem(v, now)) {
      if (!existing.has(c.id)) fresh.push(c);
    }
  }
  if (fresh.length) await bulkPut('cards', fresh);
  return fresh.length;
}

export async function allCards() { return getAll('cards'); }

export async function saveCard(card) { return put('cards', card); }

export async function logReview(cardId, grade, front) {
  return add('reviews', { cardId, grade, front, ts: Date.now() });
}

export async function reviewsSince(ts) {
  const all = await getAll('reviews');
  return all.filter(r => r.ts >= ts);
}
