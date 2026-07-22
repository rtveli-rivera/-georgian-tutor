// recorder.js — MediaRecorder record-and-compare. All audio stays local (IndexedDB blobs).
import { add, getAll, del } from './db.js';

let _rec = null;
let _chunks = [];
let _stream = null;

export async function startRecording() {
  if (_rec) stopTracks();
  _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  _chunks = [];
  _rec = new MediaRecorder(_stream);
  _rec.ondataavailable = (e) => { if (e.data.size) _chunks.push(e.data); };
  _rec.start();
}

export function isRecording() { return _rec && _rec.state === 'recording'; }

export function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!_rec) return reject(new Error('not recording'));
    _rec.onstop = () => {
      const blob = new Blob(_chunks, { type: _rec.mimeType || 'audio/webm' });
      stopTracks();
      _rec = null;
      resolve(blob);
    };
    _rec.stop();
  });
}

function stopTracks() {
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
}

let _audio = null;
export function playBlob(blob, onend = null) {
  if (_audio) { _audio.pause(); _audio = null; }
  const url = URL.createObjectURL(blob);
  _audio = new Audio(url);
  _audio.onended = () => { URL.revokeObjectURL(url); if (onend) onend(); };
  _audio.play();
}

export async function saveRecording(kind, label, blob) {
  return add('recordings', { kind, label, blob, date: new Date().toISOString() });
}

export async function listRecordings(kind = null) {
  const all = await getAll('recordings');
  const rows = kind ? all.filter(r => r.kind === kind) : all;
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function deleteRecording(id) { return del('recordings', id); }
