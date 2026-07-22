// tests.js — browser test runner for the SRS scheduler and conjugation checker.
// Open tests.html; the <title> flips to PASS/FAIL and #summary shows counts.
import { newSrsState, schedule, buildQueue, DAY } from './srs.js';
import { normalize, acceptableForms, checkForm, pronounFor, allowedScreeves, randomSlot, PERSONS_ERGATIVE } from './conjugation.js';

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e.message }); }
}
function assert(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }
function assertEq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const NOW = 1_800_000_000_000; // fixed clock

// ---------- SRS scheduler ----------
test('new card state', () => {
  const s = newSrsState(NOW);
  assertEq(s.reps, 0); assertEq(s.ease, 2.5); assertEq(s.interval, 0); assertEq(s.due, NOW);
});

test('first Good → 1 day', () => {
  const s = schedule(newSrsState(NOW), 3, NOW);
  assertEq(s.reps, 1); assertEq(s.interval, 1);
  assertEq(s.due, NOW + DAY);
});

test('first Easy → 4 days', () => {
  const s = schedule(newSrsState(NOW), 4, NOW);
  assertEq(s.interval, 4);
});

test('second Good → 6 days', () => {
  let s = schedule(newSrsState(NOW), 3, NOW);
  s = schedule(s, 3, NOW + DAY);
  assertEq(s.reps, 2); assertEq(s.interval, 6);
});

test('third Good multiplies by ease', () => {
  let s = schedule(newSrsState(NOW), 3, NOW);
  s = schedule(s, 3, NOW);
  const easeBefore = s.ease;
  s = schedule(s, 3, NOW);
  assertEq(s.interval, Math.round(6 * easeBefore), 'interval should be prev * ease;');
});

test('Again resets reps, counts lapse, requeues in ~10min', () => {
  let s = schedule(newSrsState(NOW), 3, NOW);
  s = schedule(s, 3, NOW);
  s = schedule(s, 1, NOW);
  assertEq(s.reps, 0); assertEq(s.lapses, 1); assertEq(s.interval, 1);
  assert(s.due === NOW + 10 * 60 * 1000, 'relearn due in 10 minutes');
});

test('ease never drops below 1.3', () => {
  let s = newSrsState(NOW);
  for (let i = 0; i < 12; i++) s = schedule(s, 1, NOW);
  assert(s.ease >= 1.3, `ease ${s.ease} < 1.3`);
});

test('Easy raises ease, Again lowers it', () => {
  const base = newSrsState(NOW);
  assert(schedule(base, 4, NOW).ease > base.ease, 'easy up');
  assert(schedule(base, 1, NOW).ease < base.ease, 'again down');
});

test('Hard grows slower than Good', () => {
  let a = schedule(newSrsState(NOW), 3, NOW); a = schedule(a, 3, NOW); a = schedule(a, 3, NOW);
  let b = schedule(newSrsState(NOW), 3, NOW); b = schedule(b, 3, NOW); b = schedule(b, 2, NOW);
  assert(b.interval < a.interval, `hard ${b.interval} should be < good ${a.interval}`);
});

test('interval capped at 365', () => {
  let s = newSrsState(NOW);
  for (let i = 0; i < 30; i++) s = schedule(s, 4, NOW);
  assert(s.interval <= 365);
});

test('invalid grade throws', () => {
  let threw = false;
  try { schedule(newSrsState(NOW), 5, NOW); } catch { threw = true; }
  assert(threw);
});

test('schedule is pure (no mutation)', () => {
  const s = newSrsState(NOW);
  const copy = JSON.stringify(s);
  schedule(s, 3, NOW);
  assertEq(JSON.stringify(s), copy);
});

test('buildQueue: overdue reviews before new; caps respected', () => {
  const mk = (id, srs, week = 1) => ({ id, week, suspended: false, srs });
  const cards = [
    mk('new1', newSrsState(NOW)),
    mk('new2', newSrsState(NOW), 2),
    mk('due-old', { ...newSrsState(NOW), reps: 3, due: NOW - 5 * DAY, lastGrade: 3 }),
    mk('due-new', { ...newSrsState(NOW), reps: 2, due: NOW - DAY, lastGrade: 3 }),
    mk('not-due', { ...newSrsState(NOW), reps: 2, due: NOW + 5 * DAY, lastGrade: 3 }),
  ];
  const q = buildQueue(cards, NOW, 10, 1);
  assertEq(q[0].id, 'due-old', 'oldest due first;');
  assertEq(q[1].id, 'due-new');
  assertEq(q.length, 3, 'newCap=1 → 2 due + 1 new;');
  assertEq(q[2].id, 'new1', 'lower week first;');
  assert(!q.find(c => c.id === 'not-due'));
});

test('buildQueue skips suspended', () => {
  const c = { id: 'x', week: 1, suspended: true, srs: { ...newSrsState(NOW), reps: 1, due: NOW - DAY, lastGrade: 3 } };
  assertEq(buildQueue([c], NOW).length, 0);
});

// ---------- conjugation checker ----------
const KETEBA = {
  id: 'kvX', masdar: 'კეთება', en: 'to do', type: 'transitive', preverb: 'გა-',
  screeves: {
    present: ['ვაკეთებ', 'აკეთებ', 'აკეთებს', 'ვაკეთებთ', 'აკეთებთ', 'აკეთებენ'],
    future: ['გავაკეთებ', 'გააკეთებ', 'გააკეთებს', 'გავაკეთებთ', 'გააკეთებთ', 'გააკეთებენ'],
    aorist: ['გავაკეთე', 'გააკეთე', 'გააკეთა', 'გავაკეთეთ', 'გააკეთეთ', 'გააკეთეს'],
    perfect: null,
  },
};
const MINDA = {
  id: 'kvY', masdar: 'ნდომა', en: 'to want', type: 'indirect',
  screeves: { present: ['მინდა', 'გინდა', 'უნდა', 'გვინდა', 'გინდათ', 'უნდათ'] },
};

test('normalize strips punctuation/case/space', () => {
  assertEq(normalize('  ვაკეთებ! '), 'ვაკეთებ');
  assertEq(normalize('გა–ვაკეთებ'), 'გა ვაკეთებ');
});

test('acceptableForms splits alternates', () => {
  const f = acceptableForms('ვწერ/ვწერავ');
  assertEq(f.length, 2); assert(f.includes('ვწერ') && f.includes('ვწერავ'));
});

test('checkForm accepts exact match', () => {
  assert(checkForm(KETEBA, 'present', 0, 'ვაკეთებ').ok);
});

test('checkForm accepts sloppy spacing & punctuation', () => {
  assert(checkForm(KETEBA, 'future', 2, ' გააკეთებს. ').ok);
});

test('checkForm rejects wrong person', () => {
  const r = checkForm(KETEBA, 'present', 0, 'აკეთებს');
  assert(!r.ok); assertEq(r.expected, 'ვაკეთებ');
});

test('checkForm handles missing screeve', () => {
  const r = checkForm(KETEBA, 'perfect', 0, 'x');
  assert(!r.ok); assertEq(r.reason, 'no-form');
});

test('checkForm accepts alternate forms via /', () => {
  const v = { screeves: { present: ['ვწერ/ვწერავ'] }, type: 'transitive' };
  assert(checkForm(v, 'present', 0, 'ვწერავ').ok);
  assertEq(checkForm(v, 'present', 0, 'sdf').expected, 'ვწერ');
});

test('pronoun: plain nominative in present', () => {
  assertEq(pronounFor(KETEBA, 'present', 2), 'ის');
});

test('pronoun: ergative costume in aorist for transitives', () => {
  assertEq(pronounFor(KETEBA, 'aorist', 2), 'მან');
  assertEq(PERSONS_ERGATIVE[5], 'მათ');
});

test('pronoun: dative experiencer for indirect verbs', () => {
  assertEq(pronounFor(MINDA, 'present', 2), 'მას');
});

test('allowedScreeves gates by curriculum week', () => {
  assertEq(allowedScreeves(5).join(','), 'present');
  assertEq(allowedScreeves(11).join(','), 'present,future');
  assertEq(allowedScreeves(14).join(','), 'present,future,aorist');
  assertEq(allowedScreeves(25).join(','), 'present,future,aorist,perfect');
});

test('randomSlot only yields existing forms', () => {
  let seed = 42;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 50; i++) {
    const slot = randomSlot([KETEBA, MINDA], 25, rng);
    assert(slot, 'slot found');
    const forms = slot.verb.screeves[slot.screeve];
    assert(forms && forms[slot.personIdx], 'form exists');
  }
});

// ---------- report ----------
const resEl = document.getElementById('results');
const passed = results.filter(r => r.ok).length;
for (const r of results) {
  const div = document.createElement('div');
  div.className = r.ok ? 'pass' : 'fail';
  div.textContent = `${r.ok ? '✓' : '✗'} ${r.name}${r.err ? ' — ' + r.err : ''}`;
  resEl.append(div);
}
const summary = document.getElementById('summary');
summary.textContent = `${passed}/${results.length} passed${passed === results.length ? ' — ALL GREEN ✅' : ' — FAILURES ❌'}`;
summary.style.color = passed === results.length ? '#7bd88f' : '#ff6188';
document.title = (passed === results.length ? 'PASS' : 'FAIL') + ` ${passed}/${results.length}`;
