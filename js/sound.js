/**
 * sound.js
 * ------------------------------------------------------------------
 * Lightweight, dependency-free sound system.
 *
 * No external audio files are bundled with this prototype, so all
 * effects are synthesized on the fly with the WebAudio API. This
 * keeps the system fully modular: swap any function body here for
 * an <audio> element pointing at a real asset later with no changes
 * needed anywhere else in the codebase.
 *
 * - Never autoplays: the AudioContext is created lazily on first
 *   user interaction (card selection, mute toggle, etc).
 * - Respects a mute flag persisted to localStorage.
 * ------------------------------------------------------------------
 */

const MUTE_KEY = 'gamblerer_muted_v1';

let audioCtx = null;
let muted = loadMuted();

function loadMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function persistMuted() {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch (e) {
    /* ignore */
  }
}

function ensureContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone({ freq = 440, duration = 0.12, type = 'sine', gain = 0.08, delay = 0, slideTo = null }) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  if (slideTo) {
    osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + delay + duration);
  }
  gainNode.gain.setValueAtTime(gain, ctx.currentTime + delay);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.02);
}

export const Sound = {
  isMuted() {
    return muted;
  },
  setMuted(value) {
    muted = !!value;
    persistMuted();
  },
  toggleMuted() {
    muted = !muted;
    persistMuted();
    return muted;
  },
  cardSelect() {
    tone({ freq: 320, duration: 0.08, type: 'triangle', gain: 0.07 });
  },
  diceRollTick() {
    tone({ freq: 180 + Math.random() * 220, duration: 0.05, type: 'square', gain: 0.04 });
  },
  win() {
    tone({ freq: 523, duration: 0.12, type: 'sine', gain: 0.09 });
    tone({ freq: 659, duration: 0.14, type: 'sine', gain: 0.09, delay: 0.1 });
    tone({ freq: 784, duration: 0.2, type: 'sine', gain: 0.09, delay: 0.2 });
  },
  lose() {
    tone({ freq: 220, duration: 0.3, type: 'sawtooth', gain: 0.08, slideTo: 90 });
  },
  walking() {
    tone({ freq: 140, duration: 0.07, type: 'triangle', gain: 0.03 });
  },
  gameOver() {
    tone({ freq: 196, duration: 0.25, type: 'sawtooth', gain: 0.09 });
    tone({ freq: 146, duration: 0.4, type: 'sawtooth', gain: 0.09, delay: 0.22 });
  },
};
