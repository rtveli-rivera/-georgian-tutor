// lesson.js — the ~25-minute daily lesson generator.
// Structure: warm-up shadowing (2') → SRS (8') → new material (8') →
// production exercise (5') → speaker task (2').
import { DATA, vocabForWeek, grammarForWeek, dialoguesForWeek, sentencePool } from './data.js';
import { getState, setState, getAll } from './db.js';
import { allCards, reviewsSince, introduceVocab } from './cards.js';
import { buildQueue, DAY } from './srs.js';

export function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Deterministic per-day RNG so the lesson doesn't reshuffle on every reload.
export function seededRng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function currentWeek() {
  const manual = await getState('weekOverride');
  if (manual) return manual;
  let start = await getState('startDate');
  if (!start) {
    start = dayKey();
    await setState('startDate', start);
  }
  const days = Math.floor((Date.now() - new Date(start + 'T00:00:00').getTime()) / DAY);
  return Math.min(52, Math.max(1, Math.floor(days / 7) + 1));
}

// Rotation of production exercises by weekday (Sun..Sat).
// Wednesday = weekly cluster ladder; Saturday = weekly 60s free talk.
const PRODUCTION_ROTATION = [
  'translate',      // Sun
  'conj-slot',      // Mon
  'gap-fill',       // Tue — write the missing word (workbook-style)
  'cluster-ladder', // Wed
  'qa',             // Thu — answer the question in writing
  'register',       // Fri
  'free-talk',      // Sat
];

export async function generateToday() {
  const week = await currentWeek();
  const today = dayKey();
  const rng = seededRng(today);
  const dow = new Date().getDay();

  // --- 1. Warm-up: 3 sentences from yesterday's reviews (fallback: this week's dialogue) ---
  const since = Date.now() - 36 * 60 * 60 * 1000;
  const recent = await reviewsSince(since);
  let warmup = dedupe(recent.filter(r => r.front && r.front.includes(' ')).map(r => r.front)).slice(0, 3);
  if (warmup.length < 3) {
    const dial = dialoguesForWeek(week)[0] || DATA.dialogues[0];
    if (dial) warmup = warmup.concat(dial.lines.slice(0, 3 - warmup.length).map(l => l.ka));
  }

  // --- 2. SRS queue ---
  const cards = await allCards();
  const queue = buildQueue(cards, Date.now(), 30, 10);

  // --- 3. New material: alternate grammar / vocab days ---
  const doneGrammar = new Set(await getState('doneGrammar', []));
  const introduced = new Set(await getState('introducedVocab', []));
  const pendingGrammar = [];
  for (let w = 1; w <= week; w++) {
    for (const g of grammarForWeek(w)) if (!doneGrammar.has(g.id)) pendingGrammar.push(g);
  }
  const pendingVocab = [];
  for (let w = 1; w <= week; w++) {
    for (const v of vocabForWeek(w)) if (!introduced.has(v.id)) pendingVocab.push(v);
  }
  const grammarDay = (dow === 1 || dow === 4) && pendingGrammar.length > 0; // Mon & Thu
  let newMaterial;
  if (grammarDay) {
    const g = pendingGrammar[0];
    newMaterial = { kind: 'grammar', lesson: g, dialogue: pickDialogue(g.tag, week) };
  } else if (pendingVocab.length) {
    const batch = pendingVocab.slice(0, 7);
    newMaterial = { kind: 'vocab', items: batch, dialogue: bestDialogueFor(batch, week) };
  } else if (pendingGrammar.length) {
    const g = pendingGrammar[0];
    newMaterial = { kind: 'grammar', lesson: g, dialogue: pickDialogue(g.tag, week) };
  } else {
    newMaterial = { kind: 'none' };
  }

  // --- 4. Production exercise ---
  const production = PRODUCTION_ROTATION[dow];

  // --- 5. Speaker task ---
  const speakerTask = await pickSpeakerTask(week, rng);

  return { date: today, week, dow, warmup, queue, newMaterial, production, speakerTask };
}

function dedupe(arr) { return [...new Set(arr)]; }

function pickDialogue(tag, week) {
  const match = DATA.dialogues.find(d => d.week <= week && (d.grammar || []).includes(tag));
  return match || dialoguesForWeek(week)[0] || null;
}

function bestDialogueFor(vocabBatch, week) {
  // Prefer the dialogue (≤ current week) containing the most of the new words.
  const words = vocabBatch.map(v => v.ka);
  let best = null, bestScore = -1;
  for (const d of DATA.dialogues) {
    if (d.week > week) continue;
    const text = d.lines.map(l => l.ka).join(' ');
    const score = words.filter(w => text.includes(w.slice(0, Math.max(2, w.length - 2)))).length;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

async function pickSpeakerTask(week, rng) {
  const logs = await getAll('speakerLog');
  const doneIds = new Set(logs.filter(l => l.done).map(l => l.taskId));
  const notes = logs.filter(l => l.trippedUp && l.trippedUp.trim()).slice(-5);
  const pool = DATA.speakerTasks.filter(t => t.minWeek <= week);
  if (!pool.length) return null;

  // Feed past struggles into selection: prefer a task sharing a tag with recent notes.
  const noteTags = new Set(notes.flatMap(n => n.tags || []));
  let candidates = pool.filter(t => !doneIds.has(t.id));
  if (!candidates.length) candidates = pool; // all done → recycle
  const tagged = candidates.filter(t => (t.tags || []).some(tag => noteTags.has(tag)));
  const pickFrom = tagged.length && rng() < 0.5 ? tagged : candidates;
  const task = pickFrom[Math.floor(rng() * pickFrom.length)];
  return { task, recentNotes: notes };
}

export async function markGrammarDone(id) {
  const done = await getState('doneGrammar', []);
  if (!done.includes(id)) { done.push(id); await setState('doneGrammar', done); }
}

export async function markVocabIntroduced(items) {
  const done = await getState('introducedVocab', []);
  const ids = new Set(done);
  for (const v of items) ids.add(v.id);
  await setState('introducedVocab', [...ids]);
  await introduceVocab(items);
}

// --- streak ---
export async function bumpStreak() {
  const s = await getState('streak', { count: 0, lastDay: null });
  const today = dayKey();
  if (s.lastDay === today) return s;
  const yesterday = dayKey(new Date(Date.now() - DAY));
  s.count = s.lastDay === yesterday ? s.count + 1 : 1;
  s.lastDay = today;
  await setState('streak', s);
  return s;
}

export async function getStreak() {
  const s = await getState('streak', { count: 0, lastDay: null });
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - DAY));
  if (s.lastDay !== today && s.lastDay !== yesterday) return { ...s, count: 0 };
  return s;
}
