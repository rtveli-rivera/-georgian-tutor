// srs.js — SM-2 spaced-repetition scheduler (pure functions; day-granularity).
// Grades: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy  (keyboard 1-4)
// Classic SM-2 with the 4-button mapping q = grade + 1  (2,3,4,5).

export const DAY = 24 * 60 * 60 * 1000;

export function newSrsState(now = Date.now()) {
  return { reps: 0, ease: 2.5, interval: 0, due: now, lapses: 0, lastGrade: null };
}

// Pure: returns a NEW state object, never mutates.
export function schedule(state, grade, now = Date.now()) {
  if (![1, 2, 3, 4].includes(grade)) throw new Error('grade must be 1-4');
  const q = grade + 1; // SM-2 quality 2..5
  const s = { ...state };
  s.lastGrade = grade;

  // Ease update (always applied per SM-2), clamped at 1.3.
  s.ease = Math.max(1.3, round2(s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));

  if (q < 3) {
    // Failure: reset repetition count, card comes back within the session,
    // then again tomorrow.
    s.reps = 0;
    s.lapses = (s.lapses || 0) + 1;
    s.interval = 1;
    s.due = now + 10 * 60 * 1000; // 10 min relearn inside today's session
    return s;
  }

  s.reps += 1;
  if (s.reps === 1) {
    s.interval = grade === 4 ? 4 : 1;
  } else if (s.reps === 2) {
    s.interval = grade === 4 ? 10 : 6;
  } else {
    let mult = s.ease;
    if (grade === 2) mult = Math.max(1.2, s.ease * 0.5 + 0.6); // Hard grows slower
    if (grade === 4) mult = s.ease * 1.3;                      // Easy bonus
    s.interval = Math.max(s.interval + 1, Math.round(s.interval * mult));
  }
  s.interval = Math.min(s.interval, 365);
  s.due = now + s.interval * DAY;
  return s;
}

export function isDue(state, now = Date.now()) {
  return state.due <= now;
}

// Order a review queue: overdue reviews first (oldest due first), then new cards.
export function buildQueue(cards, now = Date.now(), cap = 30, newCap = 10) {
  const due = cards.filter(c => !c.suspended && c.srs.reps > 0 && c.srs.due <= now)
    .sort((a, b) => a.srs.due - b.srs.due);
  const learning = cards.filter(c => !c.suspended && c.srs.reps === 0 && c.srs.lastGrade !== null && c.srs.due <= now)
    .sort((a, b) => a.srs.due - b.srs.due);
  const fresh = cards.filter(c => !c.suspended && c.srs.reps === 0 && c.srs.lastGrade === null)
    .sort((a, b) => (a.week - b.week) || (a.id < b.id ? -1 : 1))
    .slice(0, newCap);
  return [...due, ...learning, ...fresh].slice(0, cap);
}

function round2(x) { return Math.round(x * 100) / 100; }
