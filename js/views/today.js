// views/today.js — the ~25 minute daily lesson wizard.
import { el, clear, audioBtn, slowBtn, mdToHtml, feedback } from '../ui.js';
import { generateToday, markGrammarDone, markVocabIntroduced, bumpStreak, seededRng, dayKey } from '../lesson.js';
import { reviewSession } from './review.js';
import { renderExercise, recordCompare } from './exercise.js';
import { generate } from '../exercises.js';
import { DATA } from '../data.js';
import { getState, setState, add } from '../db.js';
import { speak } from '../tts.js';

const STEP_META = [
  { key: 'warmup', label: 'Warm-up: shadowing', mins: 2 },
  { key: 'review', label: 'Reviews', mins: 8 },
  { key: 'new', label: 'New material', mins: 8 },
  { key: 'production', label: 'Production', mins: 5 },
  { key: 'speaker', label: 'Speaker mission', mins: 2 },
];

export async function renderTodayView(container) {
  clear(container);
  const plan = await generateToday();
  const rng = seededRng(plan.date + ':prod');
  const doneLog = await getState('lessonLog', {});

  // Resume where you left off: the day's position survives closing the app,
  // navigating away, or reloading. Card grades were always saved per swipe.
  const saved = await getState('dayProgress', null);
  const resume = !!(saved && saved.date === plan.date);
  let step = resume ? Math.min(saved.step || 0, STEP_META.length) : 0;
  let maxStep = resume ? Math.max(saved.maxStep || 0, step) : 0;
  const stats = (resume && saved.stats) ? saved.stats : { reviews: null, production: null };

  function persist() {
    setState('dayProgress', { date: plan.date, step, maxStep, stats });
  }

  const header = el('div', { class: 'card' });
  const body = el('div');
  container.append(header, body);

  function renderHeader() {
    clear(header);
    const cw = DATA.curriculum[plan.week - 1];
    header.append(
      el('div', { class: 'row spread' },
        el('div', {},
          el('div', { class: 'step-badge' }, `Week ${plan.week} · ${cw ? cw.phase : ''}`),
          el('h2', { style: 'margin:4px 0' }, cw ? cw.title : `Week ${plan.week}`),
          el('div', { class: 'small muted' }, cw ? cw.focus : '')),
        doneLog[plan.date] ? el('span', { class: 'chip' }, '✅ done today') : null),
      el('div', { class: 'row', style: 'margin-top:10px;gap:6px' },
        STEP_META.map((s, idx) => {
          const done = idx < maxStep || (doneLog[plan.date] && doneLog[plan.date].completed);
          return el('button', {
            class: 'chip small step-chip',
            style: idx === step ? 'background:var(--accent);color:#fff;border-color:var(--accent)' : (done ? 'opacity:.65' : ''),
            title: 'Jump to this step',
            onclick: () => { step = idx; persist(); renderStep(); },
          }, `${done && idx !== step ? '✓ ' : s.mins + "' "}${s.label}`);
        })),
      el('div', { class: 'small muted', style: 'margin-top:6px' },
        'Tap any step to jump around — your place is saved all day, even if you close the app.'));
  }

  function next() { step++; maxStep = Math.max(maxStep, step); persist(); renderStep(); }

  function renderStep() {
    renderHeader();
    clear(body);
    const host = el('div', { class: 'card' });
    body.append(host);
    switch (STEP_META[step] && STEP_META[step].key) {
      case 'warmup': return stepWarmup(host);
      case 'review': return stepReview(host);
      case 'new': return stepNew(host);
      case 'production': return stepProduction(host);
      case 'speaker': return stepSpeaker(host);
      default: return stepDone(host);
    }
  }

  // --- 1. Warm-up: shadow 3 sentences ---
  function stepWarmup(host) {
    host.append(
      el('h2', {}, "2' · Warm-up: yesterday, out loud"),
      el('p', { class: 'small muted' }, 'Read each sentence aloud three times — full speed, like you mean it — then record one take and listen back.'));
    for (const s of plan.warmup) {
      host.append(el('div', { style: 'margin:14px 0' },
        el('div', { class: 'ka-md' }, s, ' ', audioBtn(s), slowBtn(s)),
        recordCompare(s)));
    }
    host.append(el('div', { class: 'row', style: 'margin-top:16px' },
      el('button', { class: 'btn', onclick: next }, 'Next → Reviews')));
  }

  // --- 2. SRS ---
  function stepReview(host) {
    if (!plan.queue.length) {
      host.append(el('h2', {}, "8' · Reviews"), el('p', { class: 'muted' }, 'No cards due yet — they arrive as material is introduced.'),
        el('button', { class: 'btn', onclick: next }, 'Next → New material'));
      return;
    }
    host.append(el('h2', {}, `8' · Reviews (${plan.queue.length})`));
    const inner = el('div');
    host.append(inner);
    reviewSession(inner, plan.queue, (r) => {
      stats.reviews = r;
      host.append(el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', { class: 'btn', onclick: next }, 'Next → New material')));
    });
  }

  // --- 3. New material ---
  async function stepNew(host) {
    const nm = plan.newMaterial;
    if (nm.kind === 'none') {
      host.append(el('h2', {}, "8' · New material"),
        el('p', { class: 'muted' }, 'You are fully caught up with the curriculum. Enjoy a lighter day!'),
        el('button', { class: 'btn', onclick: next }, 'Next → Production'));
      return;
    }
    if (nm.kind === 'grammar') {
      const g = nm.lesson;
      host.append(
        el('h2', {}, `8' · Grammar: ${g.title}`),
        el('div', { class: 'markdown', html: mdToHtml(g.explain_md) }),
        el('h3', {}, 'Examples'),
        ...g.examples.map(ex => el('div', { class: 'dialogue-line' },
          el('span', { class: 'ka-md' }, ex.ka), audioBtn(ex.ka), el('span', { class: 'en small' }, ex.en))));
      if (nm.dialogue) host.append(renderDialogue(nm.dialogue, []));
      // mini-drill
      host.append(el('h3', {}, 'Quick drill'));
      const drillHost = el('div');
      host.append(drillHost);
      let dIdx = 0;
      const items = g.drill && g.drill.items ? g.drill.items : [];
      runDrill();
      function runDrill() {
        if (dIdx >= Math.min(4, items.length)) {
          markGrammarDone(g.id);
          drillHost.append(el('div', { class: 'row', style: 'margin-top:10px' },
            el('button', { class: 'btn', onclick: next }, 'Next → Production')));
          return;
        }
        const it = items[dIdx];
        const box = el('div', { class: 'card', style: 'margin-top:8px' });
        renderExercise(box, { type: 'cloze', prompt: it.prompt, answer: it.answer, choices: [...it.choices], en: it.en }, () => {
          dIdx++;
          setTimeout(runDrill, 900);
        });
        clear(drillHost);
        drillHost.append(box);
      }
      return;
    }
    // vocab batch through a dialogue
    const items = nm.items;
    host.append(
      el('h2', {}, `8' · ${items.length} new words`),
      el('p', { class: 'small muted' }, 'Meet each word, hear it, then see the dialogue. These become SRS cards (word + 2 sentences each).'));
    for (const v of items) {
      host.append(el('div', { class: 'list-row' },
        el('div', {},
          el('span', { class: 'ka-md' }, v.ka), ' ', audioBtn(v.ka),
          v.verify ? el('span', { class: 'verify-flag' }, '⚑ verify') : null,
          el('div', { class: 'en small' }, v.en, v.pron ? ` · 🗣 ${v.pron}` : '')),
        el('div', { class: 'small muted' }, (v.tags || []).join(' · '))));
    }
    if (nm.dialogue) host.append(renderDialogue(nm.dialogue, items.map(v => v.ka)));
    host.append(el('div', { class: 'row', style: 'margin-top:14px' },
      el('button', {
        class: 'btn', onclick: async (e) => {
          e.target.disabled = true;
          await markVocabIntroduced(items);
          next();
        },
      }, `Add ${items.length * 3} cards & continue →`)));
  }

  // --- 4. Production ---
  function stepProduction(host) {
    host.append(el('h2', {}, "5' · Production: " + plan.production));
    const inner = el('div');
    host.append(inner);
    let spec;
    if (plan.production === 'cluster-ladder') {
      const ladders = DATA.pronunciation.ladders;
      spec = ladders.length ? { type: 'cluster-ladder', ladder: ladders[Math.floor(rng() * ladders.length)] } : null;
    } else {
      spec = generate(plan.production, plan.week, rng);
    }
    let advanced = false;
    renderExercise(inner, spec, (r) => {
      if (advanced) return;
      advanced = true;
      stats.production = r;
      host.append(el('div', { class: 'row', style: 'margin-top:12px' },
        el('button', { class: 'btn', onclick: next }, 'Next → Speaker mission')));
    });
    host.append(el('div', { style: 'margin-top:8px' },
      el('button', {
        class: 'btn secondary small', onclick: () => {
          if (advanced) return;
          advanced = true;
          stats.production = { ok: null, skipped: true };
          next();
        },
      }, 'Skip this one →')));
  }

  // --- 5. Speaker task ---
  function stepSpeaker(host) {
    const st = plan.speakerTask;
    host.append(el('h2', {}, "2' · Mission for your next native-speaker chat"));
    if (!st) {
      host.append(el('p', { class: 'muted' }, 'No speaker tasks available yet.'),
        el('button', { class: 'btn', onclick: finish }, 'Finish lesson ✓'));
      return;
    }
    const t = st.task;
    if (st.recentNotes.length) {
      host.append(el('div', { class: 'banner' },
        el('b', {}, 'From your last sessions: '),
        st.recentNotes.map(n => `“${n.trippedUp}”`).join(' · '),
        ' — today’s mission leans into that.'));
    }
    const notesTa = el('textarea', { placeholder: 'What tripped you up? (feeds future lessons)' });
    host.append(
      el('div', { class: 'card', style: 'background:var(--green-soft);border-color:var(--green)' },
        el('h3', { style: 'margin-top:0' }, '🎯 ', t.mission)),
      el('h3', {}, 'Phrases you’ll likely need'),
      ...t.phrases.map(p => el('div', { class: 'dialogue-line' },
        el('span', { class: 'ka-md' }, p.ka), audioBtn(p.ka), el('span', { class: 'en small' }, p.en))),
      el('h3', {}, 'They might ask you'),
      ...t.theyMayAsk.map(p => el('div', { class: 'dialogue-line' },
        el('span', { class: 'ka-md' }, p.ka), audioBtn(p.ka), el('span', { class: 'en small' }, p.en))),
      el('h3', {}, 'After the conversation'),
      notesTa,
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', {
          class: 'btn green', onclick: async () => {
            await add('speakerLog', { taskId: t.id, date: dayKey(), done: true, trippedUp: notesTa.value.trim(), tags: t.tags || [] });
            finish();
          },
        }, '✓ Did it (log & finish)'),
        el('button', {
          class: 'btn secondary', onclick: async () => {
            await add('speakerLog', { taskId: t.id, date: dayKey(), done: false, trippedUp: notesTa.value.trim(), tags: t.tags || [] });
            finish();
          },
        }, 'Save for later & finish')));
  }

  async function finish() {
    const log = await getState('lessonLog', {});
    log[plan.date] = {
      completed: true, week: plan.week,
      reviews: stats.reviews, production: plan.production, productionResult: stats.production,
    };
    await setState('lessonLog', log);
    doneLog[plan.date] = log[plan.date];
    const s = await bumpStreak();
    step = STEP_META.length;
    maxStep = STEP_META.length;
    persist();
    renderDone(s);
    document.getElementById('streak-chip').textContent = `🔥 ${s.count}`;
  }

  function renderDone(streak) {
    renderHeader();
    clear(body);
    body.append(el('div', { class: 'card', style: 'text-align:center' },
      el('h2', {}, 'გილოცავ! Lesson complete 🎉'),
      streak ? el('p', { class: 'muted' }, `Streak: 🔥 ${streak.count} day${streak.count === 1 ? '' : 's'}`) : null,
      el('p', { class: 'ka-md' }, 'ხვალამდე! ', audioBtn('ხვალამდე!')),
      el('p', { class: 'en small' }, 'See you tomorrow! (You can still tap any step above to revisit it.)')));
  }

  function stepDone(host) {
    if (doneLog[plan.date] && doneLog[plan.date].completed) return renderDone(null);
    finish();
  }

  renderStep();
}

export function renderDialogue(d, highlightWords = []) {
  const wrap = el('div', { style: 'margin-top:14px' },
    el('h3', {}, `💬 ${d.title_ka} — ${d.title_en}`,
      d.verify ? el('span', { class: 'verify-flag' }, '⚑ verify') : ''),
    el('div', { class: 'small muted', style: 'margin-bottom:8px' }, `${d.scene}${d.note ? ' · ' + d.note : ''}`));
  for (const l of d.lines) {
    let kaNode;
    const hit = highlightWords.find(w => l.ka.includes(w.slice(0, Math.max(2, w.length - 2))));
    kaNode = el('span', { class: 'ka-md' + (hit ? ' new-word' : '') }, l.ka);
    wrap.append(el('div', { class: 'dialogue-line' },
      el('span', { class: 'sp' }, l.sp), kaNode, audioBtn(l.ka),
      el('span', { class: 'en small' }, l.en)));
  }
  const allText = d.lines.map(l => l.ka).join(' ');
  wrap.append(el('div', { class: 'row' },
    el('button', { class: 'btn secondary small', onclick: () => playLines(d.lines, 0) }, '▶ Play whole dialogue')));
  return wrap;
}

function playLines(lines, i) {
  if (i >= lines.length) return;
  speak(lines[i].ka, { rate: 0.9, onend: () => setTimeout(() => playLines(lines, i + 1), 350) });
}
