// azuretts.js — OPTIONAL natural Georgian voices (Microsoft Azure Speech).
//
// Off by default; the app is fully usable without it. When the user pastes
// their own free Azure Speech key in Settings, audio buttons speak with the
// neural Georgian voices (ka-GE-EkaNeural / ka-GE-GiorgiNeural) — the same
// voices desktop Edge ships. Synthesized audio is cached in IndexedDB, so a
// sentence is fetched once and then plays instantly and offline forever.
//
// Privacy: the key lives only in this browser's IndexedDB; the text of a
// sentence being spoken is sent to Microsoft's speech endpoint only on a
// cache miss. Nothing else ever leaves the device.
import { getState, setState, get, put } from './db.js';

export const AZURE_VOICES = [
  { id: 'ka-GE-EkaNeural', label: 'ეკა — Eka (female)' },
  { id: 'ka-GE-GiorgiNeural', label: 'გიორგი — Giorgi (male)' },
];

let _cfg = null; // {enabled, region, key, voice}

export async function initAzureTts() {
  _cfg = await getState('azureTts', null);
  return _cfg;
}

export function azureEnabled() {
  return !!(_cfg && _cfg.enabled && _cfg.key && _cfg.region);
}

export function azureCfg() { return _cfg; }

export async function saveAzureCfg(cfg) {
  _cfg = cfg;
  await setState('azureTts', cfg);
}

// --- SDK lazy-loader (vendored bundle; only loaded once Azure TTS is used) ---
let _sdkPromise = null;
function loadSdk() {
  if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/speech-sdk.min.js';
    s.onload = () => window.SpeechSDK ? resolve(window.SpeechSDK) : reject(new Error('SDK loaded but missing global'));
    s.onerror = () => reject(new Error('could not load speech SDK'));
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

function cacheKey(text, rate) {
  return `${_cfg.voice}|${Math.round(rate * 100)}|${text}`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function synthesize(text, rate) {
  const SDK = await loadSdk();
  const cfg = SDK.SpeechConfig.fromSubscription(_cfg.key, _cfg.region);
  cfg.speechSynthesisOutputFormat = SDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  const synth = new SDK.SpeechSynthesizer(cfg, null); // null: we play the audio ourselves
  const pct = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ka-GE">` +
    `<voice name="${_cfg.voice}"><prosody rate="${pct >= 0 ? '+' : ''}${pct}%">` +
    escapeXml(text) +
    `</prosody></voice></speak>`;
  const audioData = await new Promise((resolve, reject) => {
    synth.speakSsmlAsync(ssml, (result) => {
      synth.close();
      if (result.reason === SDK.ResultReason.SynthesizingAudioCompleted) resolve(result.audioData);
      else reject(new Error(result.errorDetails || 'synthesis failed'));
    }, (err) => { synth.close(); reject(new Error(err)); });
  });
  return new Blob([audioData], { type: 'audio/mpeg' });
}

// Returns a Blob (cache-first). Throws on failure (caller falls back to system voice).
export async function azureAudio(text, rate = 1.0) {
  if (!azureEnabled()) throw new Error('azure tts not configured');
  const key = cacheKey(text, rate);
  const hit = await get('ttsCache', key).catch(() => null);
  if (hit) return hit.blob;
  const blob = await synthesize(text, rate);
  await put('ttsCache', { key, blob, ts: Date.now() }).catch(() => {});
  return blob;
}

// Settings "Save & test": returns {ok, message}.
export async function azureTest() {
  try {
    const blob = await azureAudio('გამარჯობა! ეს ბუნებრივი ქართული ხმაა.', 0.95);
    return { ok: true, blob };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}
