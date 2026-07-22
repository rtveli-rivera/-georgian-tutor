// ui.js — tiny DOM helpers + shared widgets.
import { speak, hasKaVoice } from './tts.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function audioBtn(text, rate = 0.9) {
  return el('button', {
    class: 'audio-btn', title: hasKaVoice() ? 'Play (ka-GE voice)' : 'No Georgian voice installed',
    onclick: (e) => { e.stopPropagation(); speak(text, { rate }); },
  }, '🔊');
}

export function slowBtn(text) {
  return el('button', {
    class: 'audio-btn', title: 'Play slowly',
    onclick: (e) => { e.stopPropagation(); speak(text, { rate: 0.6 }); },
  }, '🐢');
}

export function feedback(ok, msg) {
  return el('div', { class: `feedback ${ok ? 'good' : 'bad'}` }, msg);
}

// Minimal markdown: headings, bold, tables, line breaks. Enough for grammar lessons.
export function mdToHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc(md).split('\n');
  let html = '', inTable = false;
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;
      if (!inTable) { html += '<table>'; inTable = true; }
      html += '<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
      continue;
    }
    if (inTable) { html += '</table>'; inTable = false; }
    if (/^###\s/.test(line)) html += `<h4>${inline(line.slice(4))}</h4>`;
    else if (/^##\s/.test(line)) html += `<h3>${inline(line.slice(3))}</h3>`;
    else if (/^#\s/.test(line)) html += `<h3>${inline(line.slice(2))}</h3>`;
    else if (/^[-*]\s/.test(line)) html += `<li>${inline(line.slice(2))}</li>`;
    else if (line.trim() === '') html += '<br>';
    else html += `<p>${inline(line)}</p>`;
  }
  if (inTable) html += '</table>';
  return html;
  function inline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  }
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
