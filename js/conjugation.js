// conjugation.js — checker + helpers for the verb drill ("conjugation slot machine").

export const PERSONS = ['მე', 'შენ', 'ის', 'ჩვენ', 'თქვენ', 'ისინი'];
// Indirect ("to-me") verbs: the experiencer is dative.
export const PERSONS_DATIVE = ['მე', 'შენ', 'მას', 'ჩვენ', 'თქვენ', 'მათ'];
// Aorist transitive subjects wear the past-tense costume (-მა).
export const PERSONS_ERGATIVE = ['მე', 'შენ', 'მან', 'ჩვენ', 'თქვენ', 'მათ'];

export const SCREEVE_LABELS = { present: 'present', future: 'future', aorist: 'past', perfect: 'have-done' };

// Normalize an answer: trim, collapse whitespace, strip punctuation (keep Georgian letters).
export function normalize(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/[.,!?;:„“"'()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A stored form may offer alternates separated by "/" e.g. "ვწერ/ვწერავ".
export function acceptableForms(raw) {
  if (!raw) return [];
  return raw.split('/').map(f => normalize(f)).filter(Boolean);
}

export function checkForm(verb, screeve, personIdx, answer) {
  const forms = verb.screeves && verb.screeves[screeve];
  if (!forms || !forms[personIdx]) return { ok: false, expected: null, reason: 'no-form' };
  const expectedRaw = forms[personIdx];
  const ok = acceptableForms(expectedRaw).includes(normalize(answer));
  return { ok, expected: expectedRaw.split('/')[0], reason: ok ? 'match' : 'mismatch' };
}

export function pronounFor(verb, screeve, personIdx) {
  if (verb.type === 'indirect') return PERSONS_DATIVE[personIdx];
  if (screeve === 'aorist' && verb.type === 'transitive') return PERSONS_ERGATIVE[personIdx];
  return PERSONS[personIdx];
}

// Which screeves are unlocked at a given curriculum week.
export function allowedScreeves(week) {
  const out = ['present'];
  if (week >= 11) out.push('future');
  if (week >= 14) out.push('aorist');
  if (week >= 21) out.push('perfect');
  return out;
}

// Pick a random drillable slot. rng: () => [0,1)
export function randomSlot(verbs, week, rng = Math.random) {
  const screeves = allowedScreeves(week);
  for (let tries = 0; tries < 60; tries++) {
    const verb = verbs[Math.floor(rng() * verbs.length)];
    const screeve = screeves[Math.floor(rng() * screeves.length)];
    const forms = verb.screeves && verb.screeves[screeve];
    if (!forms) continue;
    const personIdx = Math.floor(rng() * 6);
    if (!forms[personIdx]) continue;
    return { verb, screeve, personIdx };
  }
  return null;
}
