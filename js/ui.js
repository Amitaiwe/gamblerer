/**
 * ui.js
 * ------------------------------------------------------------------
 * DOM rendering + animation orchestration. Reads game state and
 * renders it; does not mutate game state itself (main.js wires
 * event handlers to gameState/diceLogic functions).
 * ------------------------------------------------------------------
 */

import { getCharacterById, getColorById } from './characterConfig.js';
import { RESULT_PROBS, summarizeRisk } from './diceLogic.js';
import { getRecoloredImage, prewarmRecolor } from './recolor.js';

export function formatUSD(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
}

const el = (id) => document.getElementById(id);

/* ---------------- TOP BAR / PROGRESS ---------------- */

let shownBalance = null;
let balanceRaf = null;
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateBalance(target) {
  const node = el('statBalance');
  if (balanceRaf) cancelAnimationFrame(balanceRaf);
  if (shownBalance === null || shownBalance === target || reduceMotion) {
    shownBalance = target;
    node.textContent = formatUSD(target);
    return;
  }
  const from = shownBalance;
  const up = target > from;
  node.classList.remove('flash-up', 'flash-down');
  void node.offsetWidth; // restart the CSS animation
  node.classList.add(up ? 'flash-up' : 'flash-down');
  const start = performance.now();
  const dur = 700;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    shownBalance = Math.round(from + (target - from) * eased);
    node.textContent = formatUSD(shownBalance);
    if (t < 1) balanceRaf = requestAnimationFrame(tick);
    else shownBalance = target;
  };
  balanceRaf = requestAnimationFrame(tick);
}

/** Short screen shake, used when the balance hits $0. */
export function shakeScreen() {
  if (reduceMotion) return;
  const app = el('app');
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
  if (navigator.vibrate) { try { navigator.vibrate([80, 40, 160]); } catch (e) { /* ignore */ } }
}

export function resetBalanceDisplay(balance) {
  shownBalance = balance;
  if (balanceRaf) cancelAnimationFrame(balanceRaf);
  el('statBalance').textContent = formatUSD(balance);
}

export function renderTopBar(state) {
  animateBalance(state.balance);
  el('statStation').textContent = String(state.station);
  el('statBest').textContent = String(state.bestStation);

  const badge = el('stationBadge');
  const daily = state.mode === 'daily' ? 'DAILY · ' : '';
  if (state.isAllIn) {
    badge.textContent = daily + 'ALL-IN STATION';
    badge.classList.add('is-allin');
  } else {
    badge.textContent = daily + 'ORDINARY BET';
    badge.classList.remove('is-allin');
  }

  // Mode switch only before the first bet of a run
  const row = el('modeRow');
  row.hidden = !(state.station === 1 && !state.locked);
  el('modeBtn').textContent =
    state.mode === 'daily'
      ? `DAILY CHALLENGE ${state.dateKey} · tap for FREE PLAY`
      : 'FREE PLAY · tap for DAILY CHALLENGE';
}

export function onModeClick(handler) {
  el('modeBtn').onclick = handler;
}

/* ---------------- OFFER CARDS ---------------- */

function compactMoney(n) {
  const a = Math.abs(n);
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '+';
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e4) return `${sign}${Math.round(a / 1e3)}K`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(a)}`;
}

/** Net result per die face (1..6): $ for ordinary bets, fraction of stake for ALL-IN. */
function faceNets(offer, isAllIn) {
  const nets = [];
  for (let face = 1; face <= 6; face++) {
    if (isAllIn) nets.push(offer.payoutMultipliers[String(face)] - 1);
    else nets.push(offer.payouts[String(face)] - offer.cost);
  }
  return nets;
}

function faceLabel(net, isAllIn) {
  if (isAllIn) return net <= -1 ? 'BUST' : `${net >= 0 ? '+' : '-'}${Math.abs(Math.round(net * 100))}%`;
  return compactMoney(net);
}

// Result probabilities and the exact profit/loss split live in
// diceLogic.js so the game logic and the display can never drift apart.
export { RESULT_PROBS };

/** Risk line: probability of ending the bet in profit / in loss. */
export function riskSummary(offer, isAllIn) {
  return summarizeRisk(offer, isAllIn);
}

async function renderOfferCardArt(imgEl, offer) {
  const character = getCharacterById(offer.characterId);
  const color = getColorById(offer.colorId);
  if (!character) return;
  imgEl.alt = character.name;
  try {
    const dataUrl = await getRecoloredImage(character.asset, character.mask, color.hex);
    imgEl.src = dataUrl;
  } catch (e) {
    imgEl.src = character.asset;
  }
}

/**
 * Render the two offer cards. onSelect(offerId) is called when the
 * player taps a SELECT button.
 */
export function renderOffers(state, onSelect) {
  const container = el('offersArea');
  const template = el('offerCardTemplate');
  container.innerHTML = '';

  state.offers.forEach((offer) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.offerCard');
    const img = node.querySelector('.offerCard__img');
    const name = node.querySelector('.offerCard__name');
    const label = node.querySelector('.offerCard__label');
    const costValue = node.querySelector('.offerCard__costValue');
    const outcomesList = node.querySelector('.offerCard__outcomes');
    const selectBtn = node.querySelector('.offerCard__select');

    const character = getCharacterById(offer.characterId);

    if (state.isAllIn) card.classList.add('is-allin');
    if (state.locked && state.selectedOfferId !== offer.id) {
      card.classList.add('is-disabled');
    }
    if (state.selectedOfferId === offer.id) {
      card.classList.add('is-selected');
    }

    name.textContent = character ? character.name : offer.characterId;
    label.textContent = offer.label || (state.isAllIn ? 'ALL-IN' : 'Ordinary Bet');
    costValue.textContent = formatUSD(offer.cost);

    const risk = riskSummary(offer, state.isAllIn);
    const riskEl = node.querySelector('.offerCard__risk');
    riskEl.innerHTML =
      `Profit chance <b class="net-positive">${risk.profitPct}%</b>` +
      ` · Loss <b class="net-negative">${risk.lossPct}%</b>`;

    const nets = faceNets(offer, state.isAllIn);
    nets.forEach((net, i) => {
      const li = document.createElement('li');
      const cls = net > 0 ? 'win' : net < 0 ? 'lose' : 'even';
      li.className = `faceCell ${cls}${RESULT_PROBS[i + 1] === 0 ? ' faceCell--impossible' : ''}`;
      li.innerHTML = `<span class="faceCell__n">${i + 1}</span><span class="faceCell__v">${faceLabel(net, state.isAllIn)}</span>`;
      outcomesList.appendChild(li);
    });

    selectBtn.disabled = state.locked;
    selectBtn.addEventListener('click', () => onSelect(offer.id));

    renderOfferCardArt(img, offer);

    container.appendChild(node);
  });
}

/* ---------------- DICE (two 3D cubes with pips) ---------------- */

const PIP_CELLS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACE_TRANSFORM = {
  1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)', 2: 'rotateX(90deg)', 5: 'rotateX(-90deg)',
};
// Cube rotation [x, y] that brings face N to the front.
const FACE_FINAL = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

const ROLL_SECONDS = 3;
const dieState = {}; // sceneId -> { built, raf }

function dieParts(sceneId) {
  const scene = el(sceneId);
  return { scene, cube: scene.querySelector('.dieCube'), shadow: scene.querySelector('.dieShadow') };
}

function ensureDie(sceneId) {
  dieState[sceneId] = dieState[sceneId] || { built: false, raf: null };
  if (dieState[sceneId].built) return;
  const { cube } = dieParts(sceneId);
  for (let n = 1; n <= 6; n++) {
    const f = document.createElement('div');
    f.className = 'dieFace3d';
    f.style.transform = `${FACE_TRANSFORM[n]} translateZ(60px)`;
    for (let k = 0; k < 9; k++) {
      const cell = document.createElement('span');
      if (PIP_CELLS[n].includes(k)) cell.innerHTML = '<i></i>';
      f.appendChild(cell);
    }
    cube.appendChild(f);
  }
  dieState[sceneId].built = true;
}

function ensureDice() {
  ensureDie('die');
  ensureDie('die2');
}

function poseDie(sceneId, rx, ry, rz, lift) {
  const { cube, shadow } = dieParts(sceneId);
  cube.style.transform =
    `translateY(${-lift}px) scale(${1 + lift / 500}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  shadow.style.opacity = String(Math.max(0, 1 - lift / 260));
  shadow.style.transform = `scale(${1 - lift / 400})`;
}

export function showRollStage() {
  ensureDice();
  el('rollStage').hidden = false;
}

export function hideRollStage() {
  el('rollStage').hidden = true;
}

export function setDieRolling(isRolling) {
  const hint = el('diceHint');
  el('skipRollBtn').hidden = !isRolling;
  if (isRolling) hint.textContent = 'Rolling...';
}

/** Highlight the die that counts (both on a double), dim the other. */
function markDice(roll) {
  const a = el('die');
  const b = el('die2');
  a.classList.remove('is-counted', 'is-dim');
  b.classList.remove('is-counted', 'is-dim');
  if (!roll) return;
  if (roll.isDouble) {
    a.classList.add('is-counted');
    b.classList.add('is-counted');
  } else if (roll.dieA >= roll.dieB) {
    a.classList.add('is-counted');
    b.classList.add('is-dim');
  } else {
    b.classList.add('is-counted');
    a.classList.add('is-dim');
  }
}

/** Show faces without animation. roll null = idle (both show 1, no marks). */
export function setDiceFaces(roll) {
  ensureDice();
  const finA = FACE_FINAL[roll ? roll.dieA : 1] || FACE_FINAL[1];
  const finB = FACE_FINAL[roll ? roll.dieB : 1] || FACE_FINAL[1];
  poseDie('die', finA[0], finA[1], 0, 0);
  poseDie('die2', finB[0], finB[1], 0, 0);
  markDice(roll);
}

/**
 * Animate one die for ~3 seconds and land on `face`.
 * The face is decided by rollDice() in diceLogic.js BEFORE this is
 * called. This function only displays it.
 */
function playOneDie(sceneId, face, { reducedMotion, mirror, registerFinish, seconds = ROLL_SECONDS }) {
  ensureDie(sceneId);
  const fin = FACE_FINAL[face] || FACE_FINAL[1];
  const st = dieState[sceneId];
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = null;
      poseDie(sceneId, fin[0], fin[1], 0, 0);
      resolve();
    };
    registerFinish(finish);
    if (reducedMotion) {
      window.setTimeout(finish, 300);
      return;
    }
    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      if (t >= seconds) { finish(); return; }
      // Spin at a steady pace, then settle during the final quarter of this
      // die's own duration, so the 0.5s stagger between the dice stays visible.
      const u = t / seconds;
      const e = u < 0.75 ? u : 0.75 + 0.25 * (1 - Math.pow(1 - (u - 0.75) / 0.25, 3));
      const rx = fin[0] + (1 - e) * 900;
      const ry = fin[1] + (1 - e) * 1100 * mirror;
      const rz = (1 - e) * 200 * mirror;
      let lift = 0;
      if (t < 0.7) {
        lift = Math.sin(Math.PI * t / 0.7) * 120;
      } else if (t < seconds - 0.25) {
        const bt = t - 0.7;
        const amp = 60 * Math.pow(0.35, Math.floor(bt / 0.45));
        lift = Math.sin(Math.PI * ((bt % 0.45) / 0.45)) * amp;
      }
      poseDie(sceneId, rx, ry, rz, lift);
      st.raf = requestAnimationFrame(frame);
    };
    st.raf = requestAnimationFrame(frame);
  });
}

/**
 * Animate both dice (~3 s, mirrored spins) and land on the rolled faces.
 * Tapping either die or the skip button jumps both to the landed faces.
 * Resolves when both have landed, then marks the die that counts.
 */
export function playDiceRoll(roll, { reducedMotion } = {}) {
  ensureDice();
  showRollStage();
  markDice(null);
  const finishes = [];
  const registerFinish = (f) => finishes.push(f);
  const finishAll = () => finishes.forEach((f) => f());
  const sceneA = el('die');
  const sceneB = el('die2');
  const skipBtn = el('skipRollBtn');
  sceneA.addEventListener('click', finishAll);
  sceneB.addEventListener('click', finishAll);
  skipBtn.addEventListener('click', finishAll);
  const cleanup = () => {
    sceneA.removeEventListener('click', finishAll);
    sceneB.removeEventListener('click', finishAll);
    skipBtn.removeEventListener('click', finishAll);
  };
  // Both dice spin together. Which side lands first is random on every roll,
  // independent of the rolled values; the second die lands exactly 0.5s later.
  // This is display-only timing - it never influences the result.
  const leftFirst = Math.random() < 0.5;
  const secondsA = leftFirst ? ROLL_SECONDS : ROLL_SECONDS + 0.5;
  const secondsB = leftFirst ? ROLL_SECONDS + 0.5 : ROLL_SECONDS;
  return Promise.all([
    playOneDie('die', roll.dieA, { reducedMotion, mirror: 1, registerFinish, seconds: secondsA }),
    playOneDie('die2', roll.dieB, { reducedMotion, mirror: -1, registerFinish, seconds: secondsB }),
  ]).then(() => {
    cleanup();
    markDice(roll);
  });
}

export function setDiceHint(text) {
  el('diceHint').textContent = text;
}

/* ---------------- RESULT ---------------- */

export function renderResult(outcome) {
  const area = el('resultArea');
  const banner = el('resultBanner');
  area.hidden = false;
  banner.textContent = outcome.won ? 'YOU WON' : 'YOU LOST';
  banner.classList.toggle('is-loss', !outcome.won);
  el('resultPayout').textContent = formatUSD(outcome.payout);
  el('resultNet').textContent =
    (outcome.netChange >= 0 ? '+' : '-') + formatUSD(Math.abs(outcome.netChange));
  el('resultBalance').textContent = formatUSD(outcome.newBalance);
}

export function hideResult() {
  el('resultArea').hidden = true;
}

/* ---------------- PLAYER (HE / SHE) ---------------- */

// The HE/SHE choice is kept in memory only: it is never persisted, so every
// visit and every "play again" asks for a player again. Also remove any value
// saved by older versions, so returning players are asked too.
try { window.localStorage.removeItem('gamblerer.player'); } catch (e) { /* ignore */ }

let currentPlayer = null;

export function getPlayer() {
  return currentPlayer;
}

function setPlayer(v) {
  currentPlayer = v === 'he' || v === 'she' ? v : null;
}

const HELP = {
  en: {
    dir: 'ltr', title: 'HOW TO PLAY', toggle: 'HE', close: 'GOT IT',
    lines: [
      'Virtual money only. You start with $1,000. Nothing here is real.',
      'Every station offers two bets. Pick one. It costs money up front.',
      'Then two dice are rolled. The higher number counts. The offer shows what each result pays: red means you lose money, green means you win.',
      'A double keeps its own number and always adds a bonus: double 1 adds 10% of your bet, double 2 adds 20%, and so on up to double 6, which adds 60%. The higher the double, the bigger the bonus.',
      'Every second station is ALL-IN: your whole balance is at stake.',
      'After each bet you walk to the next station. When your balance hits $0, the game is over.',
      'Daily challenge: every player gets the same offers each day (the die is still random).',
      'Your highest balance is saved and you can share it on WhatsApp.',
    ],
  },
  he: {
    dir: 'rtl', title: 'איך משחקים', toggle: 'EN', close: 'הבנתי',
    lines: [
      'כסף וירטואלי בלבד. מתחילים עם $1,000. שום דבר כאן אינו אמיתי.',
      'בכל תחנה יש שתי הצעות הימור. בוחרים אחת, והיא עולה כסף מראש.',
      'אחר כך מוטלות שתי קוביות. המספר הגבוה קובע. ההצעה מראה כמה משלמת כל תוצאה: אדום זה הפסד, ירוק זה רווח.',
      'דאבל שומר על המספר שלו ותמיד מוסיף בונוס: דאבל 1 מוסיף 10% מההימור, דאבל 2 מוסיף 20%, וכך הלאה עד דאבל 6 שמוסיף 60%. ככל שהדאבל גבוה יותר, הבונוס גדול יותר.',
      'כל תחנה שנייה היא ALL-IN: כל היתרה שלך על הכף.',
      'אחרי כל הימור הולכים לתחנה הבאה. כשהיתרה מגיעה ל-$0 המשחק נגמר.',
      'אתגר יומי: כל השחקנים מקבלים את אותן הצעות באותו יום (הקוביה נשארת אקראית).',
      'היתרה הכי גבוהה שלך נשמרת, ואפשר לשתף אותה בוואטסאפ.',
    ],
  },
};
let helpLang = 'en';
function renderHelp() {
  const h = HELP[helpLang];
  const panel = el('helpPanel');
  panel.dir = h.dir;
  panel.lang = helpLang;
  el('helpTitle').textContent = h.title;
  el('helpLang').textContent = h.toggle;
  el('helpClose').textContent = h.close;
  const body = el('helpBody');
  body.textContent = '';
  h.lines.forEach((t) => { const p = document.createElement('p'); p.textContent = t; body.appendChild(p); });
}
function initHelp() {
  el('helpBtn').onclick = () => { renderHelp(); el('helpPanel').hidden = false; };
  el('helpLang').onclick = () => { helpLang = helpLang === 'en' ? 'he' : 'en'; renderHelp(); };
  el('helpClose').onclick = () => { el('helpPanel').hidden = true; };
}

export function showPlayerSelect(onPick) {
  initHelp();
  const screen = el('playerSelect');
  ['pickHe', 'pickShe'].forEach((id) => {
    const btn = el(id);
    // No "current" highlight: the choice is not remembered between visits.
    btn.classList.remove('is-current');
    btn.onclick = () => {
      setPlayer(btn.dataset.player);
      preloadWalkFrames(btn.dataset.player);
      screen.hidden = true;
      renderHelp();
      el('helpPanel').hidden = false;
      if (onPick) onPick(btn.dataset.player);
    };
  });
  screen.hidden = false;
}

/* ---------------- WALKING TRANSITION (velvet corridor) ---------------- */

const FLOOR_BASE = 'rotateX(90deg) translateY(-3000px) translateZ(-240px)';

const WALK_FRAMES = 10;
const walkCache = {};

/** Load (and cache) the 10 walk-cycle frames for 'he' or 'she'. */
export function preloadWalkFrames(who) {
  if (walkCache[who]) return walkCache[who];
  const list = [];
  for (let i = 0; i < WALK_FRAMES; i++) {
    const img = new Image();
    img.src = `assets/player/${who}_walk${i}.webp`;
    list.push(img);
  }
  walkCache[who] = list;
  return list;
}

// Walk-cycle tuning. One cycle = 2 steps = 10 frames.
// Frame 0 = right foot contact, 2 = passing, 4 = left foot contact, 6 = passing.
const WALK = {
  duration: 1700,     // ms: 2 full cycles (4 steps); was 2800
  cycleMs: 850,       // one full 2-step cycle (was 1400)
  bobPx: 11,          // body rises at the passing poses, sinks at foot contact
  swayPx: 6,          // side-to-side shift of the body
  rollDeg: 1.1,       // slight lean toward the planted foot
  endScale: 0.88,     // walker shrinks as it walks into the corridor
  liftPx: 26,         // and its feet move up the screen
  floorSpeed: 330,    // floor units/s: one floor stripe pair (120) per step, so planted feet do not skate
};

export function playWalkingTransition({ reducedMotion } = {}) {
  return new Promise((resolve) => {
    const overlay = el('walkOverlay');
    const skipBtn = el('skipWalkBtn');
    const actor = el('walkActor');
    const imgA = el('walkImgA');
    const imgB = el('walkImgB');
    const shadow = document.querySelector('.walkShadow');
    const floor = el('walkFloor');
    const who = getPlayer() || 'he';
    const frames = preloadWalkFrames(who);
    const first = frames[0];
    if (first.naturalWidth) actor.style.aspectRatio = `${first.naturalWidth} / ${first.naturalHeight}`;
    imgA.src = frames[0].src;
    imgB.src = frames[1].src;
    imgB.style.opacity = '0';
    overlay.hidden = false;

    const duration = reducedMotion ? 50 : WALK.duration;
    let resolved = false;
    let raf = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (raf) cancelAnimationFrame(raf);
      overlay.hidden = true;
      skipBtn.removeEventListener('click', finish);
      resolve();
    };
    skipBtn.addEventListener('click', finish);

    if (reducedMotion) {
      window.setTimeout(finish, duration);
      return;
    }

    const start = performance.now();
    const ease = (x) => x * x * (3 - 2 * x);
    const frame = (now) => {
      const ms = Math.max(0, now - start);
      if (ms >= duration) { finish(); return; }
      const t = ms / 1000;
      const u = ms / duration;               // 0..1 over the walk
      const ramp = Math.min(1, ms / 350);    // gentle start: steps and bob build up
      // phase in the cycle, 0..1 (starts on a foot contact)
      const phase = (ms / WALK.cycleMs) % 1;
      const pos = phase * WALK_FRAMES;
      const i0 = Math.floor(pos) % WALK_FRAMES;
      const i1 = (i0 + 1) % WALK_FRAMES;
      const frac = pos - Math.floor(pos);
      // two stacked layers, cross-fade between neighbouring frames
      if (imgA.dataset.i !== String(i0)) { imgA.src = frames[i0].src; imgA.dataset.i = String(i0); }
      if (imgB.dataset.i !== String(i1)) { imgB.src = frames[i1].src; imgB.dataset.i = String(i1); }
      // hold each pose, then blend quickly into the next (less double-image ghosting at the slower pace)
      const blend = Math.min(1, Math.max(0, (frac - 0.55) / 0.45));
      imgB.style.opacity = String(blend * blend * (3 - 2 * blend));

      // 2 steps per cycle: contact at phase 0 and 0.5 (lowest), passing at 0.25 and 0.75 (highest)
      const lift = (1 - Math.cos(phase * 4 * Math.PI)) / 2;   // 0 at contact, 1 at passing
      const bob = lift * WALK.bobPx * ramp;
      const sway = Math.sin(phase * 2 * Math.PI) * WALK.swayPx * ramp;
      const roll = Math.sin(phase * 2 * Math.PI) * WALK.rollDeg * ramp;
      const depth = ease(u);
      const scale = 1 - (1 - WALK.endScale) * depth;
      const rise = WALK.liftPx * depth;
      actor.style.transform =
        `translateX(calc(-50% + ${sway.toFixed(2)}px)) translateY(${(-rise - bob).toFixed(2)}px) rotate(${roll.toFixed(2)}deg) scale(${scale.toFixed(4)})`;

      // shadow stays on the floor under the feet: wider and darker at contact, tighter when passing
      const sw = (1 - 0.18 * lift) * scale;
      shadow.style.transform = `translateX(-50%) translateY(${(-rise).toFixed(2)}px) scale(${sw.toFixed(3)}, ${(sw * (1 - 0.15 * lift)).toFixed(3)})`;
      shadow.style.opacity = String(0.95 - 0.35 * lift);

      const dist = WALK.floorSpeed * (t < 0.3 ? (t * t) / 0.6 : t - 0.15); // eases in over 0.3 s
      floor.style.transform = `translateZ(${dist.toFixed(1)}px) ${FLOOR_BASE}`;
      document.querySelectorAll('.walkCurtain').forEach((c) => {
        c.style.backgroundPositionX = `${t * -30}px`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

/* ---------------- GAME OVER ---------------- */

function chartSvg(history) {
  const W = 300, H = 110, pad = 6;
  const max = Math.max(...history, 1000);
  const useLog = max > 5000;
  const f = (v) => (useLog ? Math.log10(Math.max(v, 1)) : v);
  const lo = useLog ? 0 : 0;
  const hi = f(max);
  const n = history.length;
  const x = (i) => pad + (n === 1 ? 0 : (i / (n - 1)) * (W - 2 * pad));
  const y = (v) => H - pad - ((f(v) - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const pts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const peakIdx = history.indexOf(Math.max(...history));
  const startY = y(history[0]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Balance by station">` +
    `<line x1="${pad}" x2="${W - pad}" y1="${startY}" y2="${startY}" class="chart__start"/>` +
    `<polyline points="${pts}" class="chart__line"/>` +
    `<circle cx="${x(peakIdx).toFixed(1)}" cy="${y(history[peakIdx]).toFixed(1)}" r="4" class="chart__peak"/>` +
    `</svg>` +
    `<div class="chart__axis"><span>Start $${history[0].toLocaleString('en-US')}</span><span>Peak ${formatUSD(history[peakIdx])} (station ${peakIdx})</span>` +
    `<span>${useLog ? 'log scale' : ''}</span></div>`;
}

export function showGameOver({ stationsSurvived, highestBalance, bestStation, history, records, daily }) {
  const screen = el('gameOverScreen');
  el('goStations').textContent = String(stationsSurvived);
  el('goHighest').textContent = formatUSD(highestBalance);
  el('goBest').textContent = String(bestStation);
  el('goChart').innerHTML = chartSvg(history || [1000]);

  const runs = records.totalRuns;
  const tracked = records.trackedRuns || 0;
  const avgHigh = tracked ? Math.round(records.sumHighest / tracked) : null;
  const avgSt = tracked ? (records.sumStations / tracked).toFixed(1) : null;
  const row = (k, v) => `<div class="gameOver__stat"><span>${k}</span><strong>${v}</strong></div>`;
  el('goAllStats').innerHTML =
    row('Runs played', String(runs)) +
    (avgHigh !== null ? row('Average highest balance', formatUSD(avgHigh)) : '') +
    (avgSt !== null ? row('Average stations survived', avgSt) : '') +
    row('All-time highest balance', formatUSD(records.highestBalance)) +
    row('ALL-INs survived (total)', String(records.totalAllInSurvived));

  const dailyEl = el('goDaily');
  if (daily) {
    dailyEl.hidden = false;
    dailyEl.textContent = `Daily challenge ${daily.date}: this run ${formatUSD(highestBalance)} · today's best ${formatUSD(daily.best)} · plays today ${daily.plays}`;
  } else {
    dailyEl.hidden = true;
  }

  const shown = Math.round(highestBalance).toLocaleString('en-US');
  const msg = daily
    ? `שחקתי באתגר היומי של gamblerer (${daily.date}) והרווחתי *${shown}$* עד ההפסד.\nאותן הצעות לכולם, נסו לנצח אותי: https://gamblerer.vercel.app/`
    : `שחקתי gamblerer והרווחתי *${shown}$* עד ההפסד.\nנסו גם אתם: https://gamblerer.vercel.app/`;
  el('shareBtn').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  screen.hidden = false;
}

export function hideGameOver() {
  el('gameOverScreen').hidden = true;
}

/* ---------------- SOUND TOGGLE ---------------- */

export function renderSoundIcon(muted) {
  el('soundIcon').textContent = muted ? '🔇' : '🔊';
}

/* ---------------- PREWARM ---------------- */

export function prewarmAllCharacterArt(characters, colorPalette) {
  const descriptors = [];
  characters.forEach((c) => {
    colorPalette.forEach((col) => {
      descriptors.push({ asset: c.asset, mask: c.mask, colorHex: col.hex });
    });
  });
  return prewarmRecolor(descriptors);
}
