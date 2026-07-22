// views/library.js — browse & extend the content: vocab, dialogues, verbs, grammar.
// Add words your in-laws teach you; flag/unflag "verify with speaker".
import { el, clear, audioBtn, mdToHtml } from '../ui.js';
import { DATA, loadData } from '../data.js';
import { put, getAll, del } from '../db.js';
import { renderDialogue } from './today.js';
import { PERSONS, PERSONS_DATIVE, SCREEVE_LABELS } from '../conjugation.js';

export async function renderLibraryView(container) {
  clear(container);
  const tabs = ['Vocabulary', 'Dialogues', 'Verbs', 'Grammar', 'Add word'];
  let active = 'Vocabulary';
  const tabRow = el('div', { class: 'row', style: 'margin-bottom:10px' });
  const body = el('div');
  container.append(el('div', { class: 'card' },
    el('h2', {}, '📚 Library'),
    el('p', { class: 'small muted' }, 'All seed content lives in editable JSON files in the app’s data/ folder — edit them freely. Words you add here are stored locally.'),
    tabRow), body);

  function renderTabs() {
    clear(tabRow);
    for (const t of tabs) {
      tabRow.append(el('button', {
        class: 'btn small ' + (t === active ? '' : 'secondary'),
        onclick: () => { active = t; renderTabs(); renderBody(); },
      }, t));
    }
  }

  async function renderBody() {
    clear(body);
    if (active === 'Vocabulary') return renderVocab();
    if (active === 'Dialogues') return renderDialogues();
    if (active === 'Verbs') return renderVerbs();
    if (active === 'Grammar') return renderGrammar();
    if (active === 'Add word') return renderAdd();
  }

  function renderVocab() {
    const search = el('input', { type: 'text', placeholder: 'Search ქართული or English…' });
    const list = el('div', { class: 'card' });
    body.append(el('div', { class: 'card' }, search), list);
    const draw = () => {
      clear(list);
      const q = search.value.trim().toLowerCase();
      const rows = DATA.vocab.filter(v => !q || v.ka.includes(q) || (v.en || '').toLowerCase().includes(q)).slice(0, 100);
      list.append(el('p', { class: 'small muted' }, `${rows.length} shown (of ${DATA.vocab.length})`));
      for (const v of rows) {
        list.append(el('div', { class: 'list-row' },
          el('div', {},
            el('span', { class: 'ka-md' }, v.ka), ' ', audioBtn(v.ka),
            el('div', { class: 'en small' }, `${v.en} · ${v.pos} · week ${v.week}`, v.pron ? ` · 🗣 ${v.pron}` : '')),
          el('span', {
            class: 'verify-flag', style: v.verify ? '' : 'opacity:.35',
            title: 'Toggle: confirm this with your native speakers',
            onclick: async (e) => {
              v.verify = !v.verify;
              e.target.style.opacity = v.verify ? '1' : '.35';
              if (String(v.id).startsWith('u')) await put('customVocab', v);
            },
          }, '⚑ verify')));
      }
    };
    search.addEventListener('input', draw);
    draw();
  }

  function renderDialogues() {
    for (const d of DATA.dialogues) {
      const wrap = el('details', { class: 'lesson-detail card' });
      wrap.append(el('summary', {}, `W${d.week} · ${d.title_ka} — ${d.title_en}`));
      wrap.append(renderDialogue(d));
      body.append(wrap);
    }
  }

  function renderVerbs() {
    const search = el('input', { type: 'text', placeholder: 'Search verbs…' });
    const list = el('div');
    body.append(el('div', { class: 'card' }, search), list);
    const draw = () => {
      clear(list);
      const q = search.value.trim().toLowerCase();
      const rows = DATA.verbs.filter(v => !q || v.masdar.includes(q) || (v.en || '').toLowerCase().includes(q));
      for (const v of rows.slice(0, 30)) {
        const persons = v.type === 'indirect' ? PERSONS_DATIVE : PERSONS;
        const t = el('table', { class: 'conj' });
        t.append(el('tr', {}, el('th', {}, ''), ...Object.keys(SCREEVE_LABELS).map(s =>
          el('th', {}, SCREEVE_LABELS[s], (v.verify || []).includes(s) ? ' ⚑' : ''))));
        for (let p = 0; p < 6; p++) {
          t.append(el('tr', {}, el('th', {}, persons[p]),
            ...Object.keys(SCREEVE_LABELS).map(s => {
              const forms = v.screeves && v.screeves[s];
              return el('td', {}, forms && forms[p] ? forms[p] : '—');
            })));
        }
        const wrap = el('details', { class: 'lesson-detail card' });
        wrap.append(
          el('summary', {}, `${v.masdar} — ${v.en}`,
            (v.verify || []).length ? el('span', { class: 'verify-flag' }, `⚑ verify: ${v.verify.join(', ')}`) : ''),
          el('p', { class: 'small muted' }, `${v.type}${v.preverb ? ' · preverb ' + v.preverb : ''}${v.notes ? ' · ' + v.notes : ''}`),
          t,
          v.objNotes ? el('p', { class: 'small muted' }, '🎯 object markers: ', v.objNotes) : '');
        list.append(wrap);
      }
      if (rows.length > 30) list.append(el('p', { class: 'small muted' }, `…and ${rows.length - 30} more — refine your search.`));
    };
    search.addEventListener('input', draw);
    draw();
  }

  function renderGrammar() {
    for (const g of DATA.grammar) {
      const wrap = el('details', { class: 'lesson-detail card' });
      wrap.append(el('summary', {}, `W${g.week} · ${g.title}`),
        el('div', { class: 'markdown', html: mdToHtml(g.explain_md) }),
        el('h3', {}, 'Examples'),
        ...g.examples.map(ex => el('div', { class: 'dialogue-line' },
          el('span', { class: 'ka-md' }, ex.ka), audioBtn(ex.ka), el('span', { class: 'en small' }, ex.en))));
      body.append(wrap);
    }
  }

  async function renderAdd() {
    const ka = el('input', { type: 'text', class: 'ka-input', placeholder: 'ქართული სიტყვა/ფრაზა' });
    const en = el('input', { type: 'text', placeholder: 'English meaning' });
    const s1ka = el('input', { type: 'text', class: 'ka-input', placeholder: 'Example sentence 1 (ქართულად)' });
    const s1en = el('input', { type: 'text', placeholder: 'Sentence 1 English' });
    const s2ka = el('input', { type: 'text', class: 'ka-input', placeholder: 'Example sentence 2 (ქართულად)' });
    const s2en = el('input', { type: 'text', placeholder: 'Sentence 2 English' });
    const msg = el('div');
    body.append(el('div', { class: 'card stack' },
      el('h3', { style: 'margin-top:0' }, '➕ Add a word your speakers taught you'),
      el('p', { class: 'small muted' }, 'Two example sentences required — sentence cards beat word cards. Ask your speaker for the sentences; that’s half the fun.'),
      ka, en, s1ka, s1en, s2ka, s2en,
      el('button', {
        class: 'btn', onclick: async () => {
          clear(msg);
          if (!ka.value.trim() || !en.value.trim() || !s1ka.value.trim() || !s2ka.value.trim()) {
            msg.append(el('p', { style: 'color:var(--accent)' }, 'Need the word + both example sentences.'));
            return;
          }
          const custom = await getAll('customVocab');
          const id = 'u' + String(custom.length + 1).padStart(3, '0') + '-' + Date.now().toString(36);
          const item = {
            id, rank: 9000, ka: ka.value.trim(), en: en.value.trim(), pos: 'phrase',
            week: 1, tags: ['from-speakers'], pron: null, verify: false,
            sentences: [
              { ka: s1ka.value.trim(), en: s1en.value.trim() },
              { ka: s2ka.value.trim(), en: s2en.value.trim() },
            ],
          };
          await put('customVocab', item);
          await loadData();
          msg.append(el('p', { style: 'color:var(--green)' }, `✓ Added ${item.ka} — cards appear in your next lesson's new-material step (it counts as week-1 material, so it introduces immediately).`));
          [ka, en, s1ka, s1en, s2ka, s2en].forEach(i => i.value = '');
        },
      }, 'Add word'),
      msg));

    const custom = await getAll('customVocab');
    if (custom.length) {
      const listCard = el('div', { class: 'card' }, el('h3', { style: 'margin-top:0' }, 'Your added words'));
      for (const v of custom) {
        listCard.append(el('div', { class: 'list-row' },
          el('span', { class: 'ka-md' }, v.ka, el('span', { class: 'en small' }, ` — ${v.en}`)),
          el('button', {
            class: 'btn secondary small', onclick: async (e) => {
              await del('customVocab', v.id);
              await loadData();
              e.target.closest('.list-row').remove();
            },
          }, '🗑')));
      }
      body.append(listCard);
    }
  }

  renderTabs();
  renderBody();
}
