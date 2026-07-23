// exercises.js — the exercise bank. Each generator returns a plain spec object;
// rendering happens in the UI layer. Every spec: {type, skill, ...payload}.
import { DATA, sentencePool } from './data.js';
import { normalize, randomSlot, pronounFor, SCREEVE_LABELS } from './conjugation.js';

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function goodSentences(week, minWords = 3, maxWords = 9) {
  return sentencePool(week).filter(s => {
    const n = s.ka.split(/\s+/).length;
    return n >= minWords && n <= maxWords;
  });
}

// --- English → Georgian translation (accepts alternates via "/" in seed data) ---
export function genTranslate(week, rng) {
  const pool = goodSentences(week, 3, 8);
  if (!pool.length) return null;
  const s = pick(pool, rng);
  return {
    type: 'translate', skill: 'grammar',
    en: s.en, answers: s.ka.split('/').map(x => x.trim()), ka: s.ka,
  };
}

// --- Conjugation slot machine ---
export function genConjSlot(week, rng) {
  const poolSize = week < 3 ? 6 : week < 8 ? 20 : week < 14 ? 40 : DATA.verbs.length;
  const verbs = DATA.verbs.slice(0, poolSize);
  if (!verbs.length) return null;
  const slot = randomSlot(verbs, week, rng);
  if (!slot) return null;
  return {
    type: 'conj-slot', skill: 'grammar',
    verbId: slot.verb.id, masdar: slot.verb.masdar, en: slot.verb.en,
    screeve: slot.screeve, screeveLabel: SCREEVE_LABELS[slot.screeve],
    personIdx: slot.personIdx,
    pronoun: pronounFor(slot.verb, slot.screeve, slot.personIdx),
    verify: (slot.verb.verify || []).includes(slot.screeve),
  };
}

// --- Scrambled sentence reordering ---
export function genScramble(week, rng) {
  const pool = goodSentences(week, 4, 8);
  if (!pool.length) return null;
  const s = pick(pool, rng);
  const words = s.ka.replace(/[.,!?]/g, '').split(/\s+/);
  let scrambledWords = shuffled(words, rng);
  if (scrambledWords.join(' ') === words.join(' ')) scrambledWords = shuffled(words, rng);
  return { type: 'scramble', skill: 'grammar', words, scrambled: scrambledWords, en: s.en, ka: s.ka };
}

// (Listen & type removed — TTS-dependent; see backup/pre-voice-removal/)

// --- Fill the gap, WRITING it (workbook-style, à la Javakhidze) ---
// Half the items come from the curated grammar drills (typed instead of
// multiple-choice), half are vocab sentences with the headword blanked out.
export function genGapFill(week, rng) {
  const fromGrammar = rng() < 0.5 ? gapFromGrammar(week, rng) : null;
  return fromGrammar || gapFromSentence(week, rng) || gapFromGrammar(week, rng);
}

function gapFromGrammar(week, rng) {
  const items = [];
  for (const g of DATA.grammar) {
    if (g.week > week) continue;
    for (const it of (g.drill && g.drill.items) || []) items.push({ ...it, lessonTag: g.tag });
  }
  if (!items.length) return null;
  const it = pick(items, rng);
  return {
    type: 'gap-fill', skill: 'writing',
    prompt: it.prompt, answers: it.answer.split('/').map(a => a.trim()),
    en: it.en, hint: `grammar: ${it.lessonTag}`,
  };
}

function gapFromSentence(week, rng) {
  const pool = [];
  for (const v of DATA.vocab) {
    if ((v.week || 1) > week) continue;
    const stem = v.ka.slice(0, Math.max(2, v.ka.length - 2));
    for (const s of v.sentences || []) {
      const words = s.ka.split(/\s+/);
      const idx = words.findIndex(w => w.replace(/[.,!?]/g, '').startsWith(stem));
      if (idx === -1 || words.length < 3) continue;
      const answer = words[idx].replace(/[.,!?]/g, '');
      pool.push({ prompt: words.map((w, i) => i === idx ? w.replace(answer, '___') : w).join(' '), answer, en: s.en, hint: v.en });
    }
  }
  if (!pool.length) return null;
  const it = pick(pool, rng);
  return { type: 'gap-fill', skill: 'writing', prompt: it.prompt, answers: [it.answer], en: it.en, hint: it.hint };
}

// --- Answer the question in writing ---
export function genQA(week, rng) {
  const pool = (DATA.qa || []).filter(q => q.minWeek <= week);
  if (!pool.length) return null;
  const q = pick(pool, rng);
  return { type: 'qa', skill: 'writing', ...q };
}

// --- Register switch შენ ↔ თქვენ ---
export function genRegister(rng) {
  if (!DATA.register.length) return null;
  const item = pick(DATA.register, rng);
  const toFormal = rng() < 0.5;
  return {
    type: 'register', skill: 'speaking',
    prompt: toFormal ? item.informal : item.formal,
    answer: toFormal ? item.formal : item.informal,
    direction: toFormal ? 'შენ → თქვენ' : 'თქვენ → შენ',
    en: item.en,
  };
}

// --- Cloze from grammar drills (case endings / person markers, curated) ---
export function genCloze(week, rng) {
  const items = [];
  for (const g of DATA.grammar) {
    if (g.week > week) continue;
    for (const it of (g.drill && g.drill.items) || []) items.push({ ...it, lessonTag: g.tag });
  }
  if (!items.length) return null;
  const it = pick(items, rng);
  return {
    type: 'cloze', skill: 'grammar',
    prompt: it.prompt, answer: it.answer,
    choices: shuffled(it.choices, rng), en: it.en, lessonTag: it.lessonTag,
  };
}

// --- Dialogue completion ---
export function genDialogueCompletion(week, rng) {
  const pool = DATA.dialogues.filter(d => d.week <= week && d.lines.length >= 4);
  if (!pool.length) return null;
  const d = pick(pool, rng);
  const idx = 1 + Math.floor(rng() * (d.lines.length - 2)); // never blank the first line
  const correct = d.lines[idx].ka;
  const others = DATA.dialogues.filter(x => x.id !== d.id && x.week <= week)
    .flatMap(x => x.lines.map(l => l.ka))
    .filter(l => Math.abs(l.length - correct.length) < 15);
  const distractors = shuffled(others, rng).slice(0, 2);
  if (distractors.length < 2) return null;
  return {
    type: 'dialogue-completion', skill: 'listening',
    dialogue: d, blankIdx: idx, answer: correct,
    choices: shuffled([correct, ...distractors], rng),
  };
}

// --- Free response with keyword coverage scoring ---
const DESCRIBE_TOPICS = [
  { minWeek: 1, topic: 'Describe your morning', topicKa: 'აღწერე შენი დილა', keywords: ['დილას', 'ყავა', 'ჩაი', 'ვსვამ', 'ვჭამ', 'პური', 'ვდგები', 'სამსახური', 'სახლი', 'მერე'] },
  { minWeek: 5, topic: 'Describe your family', topicKa: 'აღწერე შენი ოჯახი', keywords: ['ოჯახი', 'დედა', 'მამა', 'და', 'ძმა', 'მყავს', 'უყვარს', 'ცხოვრობს', 'მუშაობს', 'ჰქვია'] },
  { minWeek: 8, topic: 'Describe your city / neighborhood', topicKa: 'აღწერე შენი უბანი', keywords: ['ქალაქი', 'უბანი', 'ქუჩა', 'მაღაზია', 'ახლოს', 'დიდი', 'პატარა', 'ლამაზი', 'ვცხოვრობ', 'არის'] },
  { minWeek: 11, topic: 'What will you do this weekend?', topicKa: 'რას გააკეთებ შაბათ-კვირას?', keywords: ['შაბათს', 'კვირას', 'წავალ', 'ვნახავ', 'ვიყიდი', 'გავაკეთებ', 'მეგობარი', 'ერთად', 'მერე', 'სახლში'] },
  { minWeek: 14, topic: 'What did you do yesterday?', topicKa: 'რა გააკეთე გუშინ?', keywords: ['გუშინ', 'წავედი', 'ვჭამე', 'დავლიე', 'ვნახე', 'ვიყიდე', 'ვიმუშავე', 'მერე', 'საღამოს', 'დილას'] },
  { minWeek: 21, topic: 'A place you have visited in Georgia', topicKa: 'ადგილი, სადაც ყოფილხარ', keywords: ['ვყოფილვარ', 'მინახავს', 'ლამაზი', 'მთა', 'ზღვა', 'ძალიან', 'მომეწონა', 'ხალხი', 'ღვინო', 'კიდევ'] },
];

export function genDescribe(week, rng) {
  const pool = DESCRIBE_TOPICS.filter(t => t.minWeek <= week);
  const t = pool.length ? pool[pool.length - 1 - Math.floor(rng() * Math.min(2, pool.length))] : DESCRIBE_TOPICS[0];
  return { type: 'describe', skill: 'speaking', ...t };
}

export function scoreKeywords(text, keywords) {
  const norm = normalize(text);
  const hit = keywords.filter(k => norm.includes(normalize(k).slice(0, Math.max(3, k.length - 2))));
  return { hits: hit, score: hit.length, total: keywords.length };
}

// --- Free talk topics (weekly 60s recording) ---
const FREE_TALK_TOPICS = [
  'შენი ოჯახი — your family', 'შენი დღე — your day', 'ქართული საჭმელი — Georgian food',
  'შენი უბანი — your neighborhood', 'რა გიყვარს და რატომ — what you love and why',
  'გეგმები — your plans', 'გუშინდელი დღე — yesterday', 'შენი მეგობრები — your friends',
  'ამინდი და სეზონები — weather & seasons', 'მოგზაურობა — a trip you took or want to take',
];

export function genFreeTalk(week, rng) {
  return { type: 'free-talk', skill: 'speaking', topic: FREE_TALK_TOPICS[Math.floor(rng() * FREE_TALK_TOPICS.length)] };
}

// --- master generator used by the Production step & Practice tab ---
export function generate(type, week, rng) {
  switch (type) {
    case 'translate': return genTranslate(week, rng);
    case 'conj-slot': return genConjSlot(week, rng);
    case 'scramble': return genScramble(week, rng);
    case 'gap-fill': return genGapFill(week, rng);
    case 'qa': return genQA(week, rng);
    case 'register': return genRegister(rng);
    case 'cloze': return genCloze(week, rng);
    case 'dialogue-completion': return genDialogueCompletion(week, rng);
    case 'describe': return genDescribe(week, rng);
    case 'free-talk': return genFreeTalk(week, rng);
    default: return null;
  }
}

export const EXERCISE_TYPES = [
  { id: 'gap-fill', label: 'Fill the gap (write it)', skill: 'writing' },
  { id: 'qa', label: 'Answer the question (write it)', skill: 'writing' },
  { id: 'cloze', label: 'Cloze: endings & markers', skill: 'grammar' },
  { id: 'conj-slot', label: 'Conjugation slot machine', skill: 'grammar' },
  { id: 'scramble', label: 'Unscramble the sentence', skill: 'grammar' },
  { id: 'translate', label: 'English → Georgian', skill: 'grammar' },
  { id: 'describe', label: 'Describe it (keyword coverage)', skill: 'speaking' },
  { id: 'dialogue-completion', label: 'Complete the dialogue', skill: 'listening' },
  { id: 'register', label: 'Register switch შენ ↔ თქვენ', skill: 'speaking' },
];
