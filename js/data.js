// data.js — loads seed JSON (editable files in /data) + user-added vocab from IndexedDB.
import { getAll } from './db.js';

export const DATA = {
  vocab: [],        // merged, deduped, sorted by rank
  vocabById: new Map(),
  dialogues: [],
  dialoguesByWeek: new Map(),
  verbs: [],
  verbsById: new Map(),
  grammar: [],
  grammarByWeek: new Map(),
  curriculum: [],
  speakerTasks: [],
  register: [],
  qa: [],
  pronunciation: { contrasts: [], ladders: [], minimalPairs: [] },
  loadErrors: [],
};

async function fetchJson(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } catch (e) {
    DATA.loadErrors.push(`${path}: ${e.message}`);
    return null;
  }
}

export async function loadData() {
  const [v1, v2, v3, d1, d2, k1, k2, gram, curr, st, reg, pron, qa] = await Promise.all([
    fetchJson('data/vocab1.json'), fetchJson('data/vocab2.json'), fetchJson('data/vocab3.json'),
    fetchJson('data/dialogues1.json'), fetchJson('data/dialogues2.json'),
    fetchJson('data/verbs1.json'), fetchJson('data/verbs2.json'),
    fetchJson('data/grammar.json'), fetchJson('data/curriculum.json'),
    fetchJson('data/speaker_tasks.json'), fetchJson('data/register.json'),
    fetchJson('data/pronunciation.json'), fetchJson('data/qa.json'),
  ]);

  // vocab: merge seed + custom, dedupe on headword+meaning (keep lowest rank).
  // Keying on meaning too lets true homographs coexist (და = "and" AND "sister").
  const custom = await getAll('customVocab').catch(() => []);
  const raw = [...(v1 || []), ...(v2 || []), ...(v3 || []), ...custom];
  const seen = new Map();
  for (const item of raw) {
    const ka = (item.ka || '').trim();
    if (!ka) continue;
    const key = ka + '|' + (item.en || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6);
    if (!seen.has(key) || (item.rank || 9999) < (seen.get(key).rank || 9999)) seen.set(key, item);
  }
  DATA.vocab = [...seen.values()].sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
  DATA.vocabById = new Map(DATA.vocab.map(v => [v.id, v]));

  DATA.dialogues = [...(d1 || []), ...(d2 || [])].sort((a, b) => a.week - b.week);
  DATA.dialoguesByWeek = groupBy(DATA.dialogues, d => d.week);

  DATA.verbs = [...(k1 || []), ...(k2 || [])];
  DATA.verbsById = new Map(DATA.verbs.map(v => [v.id, v]));

  DATA.grammar = gram || [];
  DATA.grammarByWeek = groupBy(DATA.grammar, g => g.week);

  DATA.curriculum = fillCurriculum(curr || []);
  DATA.speakerTasks = st || [];
  DATA.register = reg || [];
  if (pron) DATA.pronunciation = pron;
  DATA.qa = qa || [];
  return DATA;
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// Weeks 27-52 default to consolidation blocks if the curriculum file stops earlier.
function fillCurriculum(rows) {
  const byWeek = new Map(rows.map(r => [r.week, r]));
  const out = [];
  for (let w = 1; w <= 52; w++) {
    if (byWeek.has(w)) { out.push(byWeek.get(w)); continue; }
    out.push({
      week: w,
      phase: w <= 30 ? 'Deep Georgian' : 'Fluency Road',
      title: `Week ${w}: consolidation — new vocabulary + review`,
      grammar: [],
      focus: 'Vocabulary expansion, SRS depth, speaker missions, free talk.',
    });
  }
  return out;
}

// Vocabulary scheduled for a given week (seed week field drives introduction order).
export function vocabForWeek(week) {
  return DATA.vocab.filter(v => (v.week || 1) === week);
}

export function grammarForWeek(week) {
  return DATA.grammarByWeek.get(week) || [];
}

export function dialoguesForWeek(week) {
  return DATA.dialoguesByWeek.get(week) || [];
}

// All example sentences drawn from material introduced up to `week`.
export function sentencePool(week) {
  const out = [];
  for (const v of DATA.vocab) {
    if ((v.week || 1) > week) continue;
    for (const s of v.sentences || []) out.push({ ...s, source: v.id });
  }
  for (const d of DATA.dialogues) {
    if (d.week > week) continue;
    for (const l of d.lines || []) out.push({ ka: l.ka, en: l.en, source: d.id });
  }
  return out;
}
