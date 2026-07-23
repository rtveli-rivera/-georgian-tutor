// tts.js — Web Speech API text-to-speech with ka-GE voice discovery.
let _voice = null;
let _checked = false;

function findKaVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ka')) || null;
}

export function voicesReady() {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve(null);
    const v = findKaVoice();
    if (v || _checked) { _voice = v; return resolve(v); }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      _checked = true;
      _voice = findKaVoice();
      resolve(_voice);
    };
    speechSynthesis.onvoiceschanged = done;
    // Voices sometimes never fire the event; poll briefly.
    setTimeout(done, 1500);
  });
}

export function hasKaVoice() { return !!_voice; }

export function speak(text, { rate = 0.9, onend = null } = {}) {
  if (!window.speechSynthesis) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ka-GE';
  if (_voice) u.voice = _voice;
  u.rate = rate;
  if (onend) u.onend = onend;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return !!_voice;
}

export function stopSpeaking() {
  if (window.speechSynthesis) speechSynthesis.cancel();
}

export function noVoiceMsg() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return 'No Georgian voice in this phone’s text-to-speech engine (Google’s has none). ' +
      'Fix: install the free RHVoice app from the Play Store, download its Georgian voice (Natia), ' +
      'set Android Settings → Text-to-speech output → Preferred engine to RHVoice, ' +
      'then fully close and reopen this app.';
  }
  if (/iPhone|iPad/i.test(ua)) {
    return 'iOS has no Georgian text-to-speech voice, so audio buttons stay silent on this device — ' +
      'read the Mkhedruli aloud yourself (you read the script, that’s the point!).';
  }
  return 'No Georgian (ka-GE) voice is installed in this browser. ' +
    'On Windows: Settings → Time & Language → Speech → Add voices → ქართული. ' +
    'Microsoft Edge usually ships a Georgian voice out of the box. ' +
    'Until then, audio buttons will be silent — read the Mkhedruli aloud yourself.';
}

// Kept for compatibility with existing imports.
export const NO_VOICE_MSG = noVoiceMsg();

export function voiceCount() {
  return window.speechSynthesis ? speechSynthesis.getVoices().length : 0;
}
