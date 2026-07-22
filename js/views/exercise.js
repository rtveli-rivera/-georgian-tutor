// views/exercise.js — renders one exercise spec and reports the result.
import { el, clear, audioBtn, slowBtn, feedback } from '../ui.js';
import { normalize, checkForm } from '../conjugation.js';
import { DATA } from '../data.js';
import { scoreKeywords } from '../exercises.js';
import { speak } from '../tts.js';
import { startRecording, stopRecording, isRecording, playBlob, saveRecording } from '../recorder.js';

// onDone({ok: bool|null, score?: string}) — called once when the learner finishes.
export function renderExercise(container, spec, onDone) {
  clear(container);
  if (!spec) {
    container.append(el('p', { class: 'muted' }, 'Not enough material introduced yet for this exercise — do a few daily lessons first.'));
    onDone({ ok: null });
    return;
  }
  const done = once(onDone);
  switch (spec.type) {
    case 'translate': return rTranslate(container, spec, done);
    case 'conj-slot': return rConjSlot(container, spec, done);
    case 'scramble': return rScramble(container, spec, done);
    case 'listen-type': return rListenType(container, spec, done);
    case 'register': return rRegister(container, spec, done);
    case 'cloze': return rCloze(container, spec, done);
    case 'dialogue-completion': return rDialogueCompletion(container, spec, done);
    case 'describe': return rDescribe(container, spec, done);
    case 'free-talk': return rFreeTalk(container, spec, done);
    case 'cluster-ladder': return rClusterLadder(container, spec, done);
    default:
      container.append(el('p', {}, `Unknown exercise: ${spec.type}`));
      done({ ok: null });
  }
}

function once(fn) { let called = false; return (r) => { if (!called) { called = true; fn(r); } }; }

function answerBox(placeholder = 'ქართულად…') {
  return el('input', { type: 'text', class: 'ka-input', placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'ka' });
}

function checkBtn(label, fn) { return el('button', { class: 'btn', onclick: fn }, label); }

// --- English → Georgian ---
function rTranslate(c, spec, done) {
  const input = answerBox();
  const out = el('div');
  c.append(
    el('p', { class: 'en', style: 'font-size:1.15rem' }, '🇬🇧 ', spec.en),
    input,
    el('div', { class: 'row', style: 'margin-top:10px' },
      checkBtn('Check', check),
      el('button', { class: 'btn secondary', onclick: reveal }, 'Show answer')),
    out);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  input.focus();
  function check() {
    const ok = spec.answers.some(a => normalize(a) === normalize(input.value));
    clear(out);
    if (ok) {
      out.append(feedback(true, `✓ ${spec.ka}`));
      done({ ok: true });
    } else {
      out.append(feedback(false, 'Not a listed answer — compare with the model, then self-grade:'),
        el('div', { class: 'ka-md', style: 'margin:8px 0' }, spec.ka, ' ', audioBtn(spec.ka)),
        el('div', { class: 'row' },
          el('button', { class: 'btn green small', onclick: () => { out.append(feedback(true, 'Counted as correct.')); done({ ok: true }); } }, 'Mine was right/close'),
          el('button', { class: 'btn secondary small', onclick: () => done({ ok: false }) }, 'Mine was wrong')));
    }
  }
  function reveal() {
    clear(out);
    out.append(el('div', { class: 'ka-md' }, spec.ka, ' ', audioBtn(spec.ka)));
    done({ ok: false });
  }
}

// --- Conjugation slot machine ---
function rConjSlot(c, spec, done) {
  const verb = DATA.verbsById.get(spec.verbId);
  const input = answerBox('ზმნის ფორმა…');
  const out = el('div');
  c.append(
    el('div', { class: 'row' },
      el('span', { class: 'ka-md' }, '🎰 ', spec.pronoun, ' + '),
      el('span', { class: 'ka-md', style: 'color:var(--accent)' }, spec.masdar),
      el('span', { class: 'chip' }, spec.screeveLabel)),
    el('p', { class: 'small muted' }, spec.en, spec.verify ? ' · ⚑ this form is flagged “verify with speaker”' : ''),
    input,
    el('div', { class: 'row', style: 'margin-top:10px' }, checkBtn('Check', check)),
    out);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  input.focus();
  function check() {
    const res = checkForm(verb, spec.screeve, spec.personIdx, input.value);
    clear(out);
    out.append(res.ok
      ? feedback(true, `✓ ${res.expected}`)
      : feedback(false, `✗ Expected: ${res.expected}`));
    out.append(el('div', { class: 'row', style: 'margin-top:6px' }, audioBtn(res.expected)));
    done({ ok: res.ok });
  }
}

// --- Scramble ---
function rScramble(c, spec, done) {
  const picked = [];
  const answerRow = el('div', { class: 'scramble-answer ka-md' });
  const chipsRow = el('div');
  const out = el('div');
  spec.scrambled.forEach((w, idx) => {
    const chip = el('span', { class: 'word-chip', onclick: () => { picked.push(w); chip.classList.add('used'); sync(); } }, w);
    chipsRow.append(chip);
  });
  c.append(
    el('p', { class: 'en' }, '🧩 Rebuild: ', spec.en),
    answerRow, chipsRow,
    el('div', { class: 'row', style: 'margin-top:10px' },
      checkBtn('Check', check),
      el('button', { class: 'btn secondary', onclick: resetAll }, 'Reset')),
    out);
  function sync() { answerRow.textContent = picked.join(' '); }
  function resetAll() { picked.length = 0; sync(); chipsRow.querySelectorAll('.word-chip').forEach(x => x.classList.remove('used')); }
  function check() {
    const ok = picked.join(' ') === spec.words.join(' ');
    clear(out);
    out.append(ok ? feedback(true, `✓ ${spec.ka}`) : feedback(false, `✗ ${spec.ka}`),
      el('div', { class: 'row', style: 'margin-top:6px' }, audioBtn(spec.ka)));
    done({ ok });
  }
}

// --- Listen & type ---
function rListenType(c, spec, done) {
  const input = answerBox('რა გაიგონე?');
  const out = el('div');
  c.append(
    el('p', { class: 'muted' }, '🎧 Listen, then type what you hear:'),
    el('div', { class: 'row' }, audioBtn(spec.ka), slowBtn(spec.ka)),
    input,
    el('div', { class: 'row', style: 'margin-top:10px' }, checkBtn('Check', check)),
    out);
  speak(spec.ka);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  function check() {
    const ok = normalize(input.value) === normalize(spec.ka);
    clear(out);
    out.append(ok ? feedback(true, `✓ ${spec.ka}`) : feedback(false, `✗ It was: ${spec.ka}`),
      el('div', { class: 'en small' }, spec.en));
    done({ ok });
  }
}

// --- Register switch ---
function rRegister(c, spec, done) {
  const input = answerBox();
  const out = el('div');
  c.append(
    el('p', { class: 'muted' }, `🎭 Switch register: ${spec.direction}`),
    el('div', { class: 'ka-md' }, spec.prompt, ' ', audioBtn(spec.prompt)),
    el('p', { class: 'en small' }, spec.en),
    input,
    el('div', { class: 'row', style: 'margin-top:10px' }, checkBtn('Check', check)),
    out);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  input.focus();
  function check() {
    const ok = normalize(input.value) === normalize(spec.answer);
    clear(out);
    out.append(ok ? feedback(true, `✓ ${spec.answer}`) : feedback(false, `✗ Expected: ${spec.answer}`),
      el('div', { class: 'row', style: 'margin-top:6px' }, audioBtn(spec.answer)));
    done({ ok });
  }
}

// --- Cloze (choice) ---
function rCloze(c, spec, done) {
  const out = el('div');
  c.append(
    el('div', { class: 'ka-md' }, spec.prompt.replace('___', '＿＿＿')),
    el('p', { class: 'en small' }, spec.en),
    el('div', {}, spec.choices.map(ch => el('button', {
      class: 'choice-btn ka-choice',
      onclick: (e) => {
        const ok = ch === spec.answer;
        e.target.classList.add(ok ? 'correct' : 'wrong');
        clear(out);
        const full = spec.prompt.replace('___', spec.answer);
        out.append(ok ? feedback(true, `✓ ${full}`) : feedback(false, `✗ ${full}`),
          el('div', { class: 'row', style: 'margin-top:6px' }, audioBtn(full)));
        done({ ok });
      },
    }, ch))),
    out);
}

// --- Dialogue completion ---
function rDialogueCompletion(c, spec, done) {
  const out = el('div');
  const lines = spec.dialogue.lines.map((l, idx) => el('div', { class: 'dialogue-line' },
    el('span', { class: 'sp' }, l.sp),
    idx === spec.blankIdx
      ? el('span', { class: 'ka-md', style: 'color:var(--accent)' }, '＿＿＿＿＿？')
      : el('span', { class: 'ka-md' }, l.ka)));
  c.append(
    el('p', { class: 'muted' }, `💬 ${spec.dialogue.title_en} — pick the missing line:`),
    ...lines,
    el('div', {}, spec.choices.map(ch => el('button', {
      class: 'choice-btn ka-choice',
      onclick: (e) => {
        const ok = ch === spec.answer;
        e.target.classList.add(ok ? 'correct' : 'wrong');
        clear(out);
        out.append(ok ? feedback(true, `✓ ${spec.answer}`) : feedback(false, `✗ It was: ${spec.answer}`));
        done({ ok });
      },
    }, ch))),
    out);
}

// --- Describe (keyword coverage) ---
function rDescribe(c, spec, done) {
  const ta = el('textarea', { placeholder: 'დაწერე ქართულად… (write in Georgian; speaking it aloud first is even better)', lang: 'ka' });
  const out = el('div');
  c.append(
    el('h3', {}, `🗒 ${spec.topic}`),
    el('div', { class: 'ka-md' }, spec.topicKa, ' ', audioBtn(spec.topicKa)),
    el('p', { class: 'small muted' }, 'Say it out loud first, then type what you said. Scored by keyword coverage.'),
    ta,
    el('div', { class: 'row', style: 'margin-top:10px' }, checkBtn('Score me', score)),
    out);
  function score() {
    const r = scoreKeywords(ta.value, spec.keywords);
    clear(out);
    const pct = Math.round((r.score / r.total) * 100);
    out.append(
      feedback(r.score >= 3, `Keyword coverage: ${r.score}/${r.total} (${pct}%)`),
      el('p', { class: 'small muted' }, 'Covered: ', r.hits.join(', ') || '—'),
      el('p', { class: 'small muted' }, 'Worth working in: ', spec.keywords.filter(k => !r.hits.includes(k)).join(', ')));
    done({ ok: r.score >= 3, score: `${r.score}/${r.total}` });
  }
}

// --- Free talk (60s recording) ---
function rFreeTalk(c, spec, done) {
  const out = el('div');
  let timerEl = el('b', {}, '60');
  let btn;
  let ticker = null;
  btn = el('button', { class: 'btn', onclick: toggle }, '🎙 Start 60-second recording');
  c.append(
    el('h3', {}, '🎙 Weekly free talk'),
    el('p', { class: 'ka-md' }, spec.topic),
    el('p', { class: 'small muted' }, 'Talk for 60 seconds. Recordings are stored locally so you can hear month-over-month progress (Progress tab).'),
    el('p', {}, timerEl, ' seconds'),
    btn, out);
  async function toggle() {
    if (!isRecording()) {
      try { await startRecording(); } catch (e) { out.append(feedback(false, 'Microphone unavailable: ' + e.message)); return; }
      btn.textContent = '⏹ Stop';
      let left = 60;
      ticker = setInterval(() => { left--; timerEl.textContent = String(left); if (left <= 0) toggle(); }, 1000);
    } else {
      clearInterval(ticker);
      const blob = await stopRecording();
      await saveRecording('freetalk', spec.topic, blob);
      clear(out);
      out.append(feedback(true, 'Saved! 🎉'), el('button', { class: 'btn secondary small', onclick: () => playBlob(blob) }, '▶ Play it back'));
      done({ ok: true });
    }
  }
}

// --- Cluster ladder (weekly) ---
function rClusterLadder(c, spec, done) {
  const ladder = spec.ladder;
  const out = el('div');
  c.append(
    el('h3', {}, `🪜 Cluster ladder: ${ladder.name}`),
    el('p', { class: 'small muted' }, 'Climb step by step. Play each rung, repeat it aloud 3×, then record yourself on the final word and compare.'),
    ...ladder.steps.map(s => el('div', { class: 'row', style: 'margin:8px 0' },
      el('span', { class: 'ka' }, s), audioBtn(s), slowBtn(s))),
    el('p', { class: 'en small' }, ladder.en),
    recordCompare(ladder.steps[ladder.steps.length - 1], () => done({ ok: true })),
    out);
}

// Shared record-and-compare widget (model audio vs your recording).
export function recordCompare(modelText, onRecorded = null) {
  const wrap = el('div', { class: 'row', style: 'margin-top:10px' });
  let myBlob = null;
  const recBtn = el('button', { class: 'btn secondary small', onclick: toggle }, '🎙 Record me');
  const playMine = el('button', { class: 'btn secondary small', disabled: 'true', onclick: () => myBlob && playBlob(myBlob) }, '▶ Me');
  const playModel = el('button', { class: 'btn secondary small', onclick: () => speak(modelText, { rate: 0.85 }) }, '▶ Model');
  const both = el('button', { class: 'btn secondary small', disabled: 'true', onclick: playBoth }, '▶ Model → Me');
  wrap.append(playModel, recBtn, playMine, both);
  async function toggle() {
    if (!isRecording()) {
      try { await startRecording(); } catch (e) { alert('Microphone unavailable: ' + e.message); return; }
      recBtn.innerHTML = '';
      recBtn.append(el('span', { class: 'rec-dot' }), '⏹ Stop');
    } else {
      myBlob = await stopRecording();
      recBtn.textContent = '🎙 Re-record';
      playMine.removeAttribute('disabled');
      both.removeAttribute('disabled');
      if (onRecorded) onRecorded(myBlob);
    }
  }
  function playBoth() {
    speak(modelText, { rate: 0.85, onend: () => setTimeout(() => myBlob && playBlob(myBlob), 250) });
  }
  return wrap;
}
