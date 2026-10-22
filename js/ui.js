/**
 * ui.js
 * ------------------------------------------------------------------
 * DOM rendering + animation orchestration. Reads game state and
 * renders it; does not mutate game state itself (main.js wires
 * event handlers to gameState/diceLogic functions).
 * ------------------------------------------------------------------
 */

import { getCharacterById, getColorById } from './characterConfig.js';
import { getRecoloredImage, prewarmRecolor } from './recolor.js';

export function formatUSD(amount) {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
}

const el = (id) => document.getElementById(id);

/* ---------------- TOP BAR / PROGRESS ---------------- */

export function renderTopBar(state) {
  el('statBalance').textContent = formatUSD(state.balance);
  el('statStation').textContent = String(state.station);
  el('statBest').textContent = String(state.bestStation);

  const badge = el('stationBadge');
  if (state.isAllIn) {
    badge.textContent = 'ALL-IN STATION';
    badge.classList.add('is-allin');
  } else {
    badge.textContent = 'ORDINARY BET';
    badge.classList.remove('is-allin');
  }
}

/* ---------------- OFFER CARDS ---------------- */

function buildOutcomeRows(offer, isAllIn) {
  // Group identical payouts across dice faces for compact display.
  const groups = new Map(); // payoutDisplay -> [faces]
  for (let face = 1; face <= 6; face++) {
    let payoutAmount;
    let payoutLabel;
    if (isAllIn) {
      const mult = offer.payoutMultipliers[String(face)];
      payoutAmount = mult; // store multiplier, resolved to $ at render using cost
      payoutLabel = mult === 0 ? 'BUST' : `${mult}× stake`;
    } else {
      payoutAmount = offer.payouts[String(face)];
      payoutLabel = formatUSD(payoutAmount);
    }
    const key = payoutLabel;
    if (!groups.has(key)) groups.set(key, { faces: [], payoutAmount, isAllIn });
    groups.get(key).faces.push(face);
  }

  const rows = [];
  for (const [label, { faces, payoutAmount }] of groups.entries()) {
    const facesStr = faces.join(', ');
    let netText = '';
    let netClass = '';
    if (isAllIn) {
      const net = payoutAmount - 1; // relative to stake multiplier of 1.0
      netText = net >= 0 ? `+${Math.round(net * 100)}%` : `${Math.round(net * 100)}%`;
      netClass = net >= 0 ? 'net-positive' : 'net-negative';
    } else {
      const net = payoutAmount - offer.cost;
      netText = net >= 0 ? `+${formatUSD(net)}` : `-${formatUSD(Math.abs(net))}`;
      netClass = net >= 0 ? 'net-positive' : 'net-negative';
    }
    rows.push({ facesStr, faces, label, netText, netClass });
  }
  return rows;
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

    const rows = buildOutcomeRows(offer, state.isAllIn);
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'offerCard__outcome';
      const chipClass = r.netClass === 'net-positive' ? 'win' : 'lose';
      const chips = r.faces.map((f) => `<span class="faceChip ${chipClass}">${f}</span>`).join('');
      li.innerHTML = `<span class="dice-faces">${chips}</span><span class="${r.netClass}">${r.netText}</span>`;
      outcomesList.appendChild(li);
    });

    selectBtn.disabled = state.locked;
    selectBtn.addEventListener('click', () => onSelect(offer.id));

    renderOfferCardArt(img, offer);

    container.appendChild(node);
  });
}

/* ---------------- DICE (3D cube with pips) ---------------- */

const PIP_CELLS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACE_TRANSFORM = {
  1: 'rotateY(0deg)', 6: 'rotateY(180deg)', 3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)', 2: 'rotateX(90deg)', 5: 'rotateX(-90deg)',
};
// Cube rotation [x, y] that brings face N to the front.
const FACE_FINAL = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

const ROLL_SECONDS = 3;
let dieBuilt = false;
let dieRaf = null;
let dieSkip = null;

function ensureDie() {
  if (dieBuilt) return;
  const cube = el('dieCube');
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
  dieBuilt = true;
}

function poseDie(rx, ry, rz, lift) {
  const cube = el('dieCube');
  cube.style.transform =
    `translateY(${-lift}px) scale(${1 + lift / 500}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  const sh = el('dieShadow');
  sh.style.opacity = String(Math.max(0, 1 - lift / 260));
  sh.style.transform = `scale(${1 - lift / 400})`;
}

export function showRollStage() {
  ensureDie();
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

/** Show a face without animation. value null = idle. */
export function setDieFace(value) {
  ensureDie();
  const fin = FACE_FINAL[value] || FACE_FINAL[1];
  poseDie(fin[0], fin[1], 0, 0);
}

/**
 * Animate the die for ~3 seconds and land on `result`.
 * The result is decided by rollDie() in diceLogic.js BEFORE this is
 * called. This function only displays it. Tap the die area or the skip
 * button to jump to the landed face. Resolves when landed or skipped.
 */
export function playDieRoll(result, { reducedMotion } = {}) {
  ensureDie();
  showRollStage();
  const fin = FACE_FINAL[result] || FACE_FINAL[1];
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (dieRaf) cancelAnimationFrame(dieRaf);
      dieRaf = null;
      dieSkip = null;
      el('die').removeEventListener('click', finish);
      el('skipRollBtn').removeEventListener('click', finish);
      poseDie(fin[0], fin[1], 0, 0);
      resolve();
    };
    dieSkip = finish;
    if (reducedMotion) {
      window.setTimeout(finish, 300);
      return;
    }
    el('die').addEventListener('click', finish);
    el('skipRollBtn').addEventListener('click', finish);

    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      if (t >= ROLL_SECONDS) { finish(); return; }
      const e = 1 - Math.pow(1 - t / ROLL_SECONDS, 3.2);
      const rx = fin[0] + (1 - e) * 900;
      const ry = fin[1] + (1 - e) * 1100;
      const rz = (1 - e) * 200;
      let lift = 0;
      if (t < 0.7) {
        lift = Math.sin(Math.PI * t / 0.7) * 120;
      } else if (t < 2.75) {
        const bt = t - 0.7;
        const amp = 60 * Math.pow(0.35, Math.floor(bt / 0.45));
        lift = Math.sin(Math.PI * ((bt % 0.45) / 0.45)) * amp;
      }
      poseDie(rx, ry, rz, lift);
      dieRaf = requestAnimationFrame(frame);
    };
    dieRaf = requestAnimationFrame(frame);
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

const PLAYER_KEY = 'gamblerer.player';

export function getPlayer() {
  try {
    const v = window.localStorage.getItem(PLAYER_KEY);
    return v === 'he' || v === 'she' ? v : null;
  } catch (e) {
    return null;
  }
}

function savePlayer(v) {
  try { window.localStorage.setItem(PLAYER_KEY, v); } catch (e) { /* ignore */ }
}

export function showPlayerSelect(onPick) {
  const screen = el('playerSelect');
  const current = getPlayer();
  ['pickHe', 'pickShe'].forEach((id) => {
    const btn = el(id);
    btn.classList.toggle('is-current', btn.dataset.player === current);
    btn.onclick = () => {
      savePlayer(btn.dataset.player);
      screen.hidden = true;
      if (onPick) onPick(btn.dataset.player);
    };
  });
  screen.hidden = false;
}

/* ---------------- WALKING TRANSITION (velvet corridor) ---------------- */

const FLOOR_BASE = 'rotateX(90deg) translateY(-3000px) translateZ(-240px)';

export function playWalkingTransition({ reducedMotion } = {}) {
  return new Promise((resolve) => {
    const overlay = el('walkOverlay');
    const skipBtn = el('skipWalkBtn');
    const player = el('walkPlayer');
    const floor = el('walkFloor');
    const who = getPlayer() || 'he';
    player.src = `assets/player/${who}_walkL.png`;
    overlay.hidden = false;

    const duration = reducedMotion ? 50 : 1500;
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
    const frame = (now) => {
      const t = (now - start) / 1000;
      if (t * 1000 >= duration) { finish(); return; }
      const step = Math.floor(t * 3.2) % 2;
      player.src = `assets/player/${who}_walk${step ? 'R' : 'L'}.png`;
      const swing = Math.sin(t * 3.2 * Math.PI);
      const bob = Math.abs(swing) * 14;
      player.style.bottom = `${-20 + bob}px`;
      player.style.transform = `translateX(-50%) rotate(${swing * 0.9}deg)`;
      floor.style.transform = `translateZ(${t * 900}px) ${FLOOR_BASE}`;
      document.querySelectorAll('.walkCurtain').forEach((c) => {
        c.style.backgroundPositionX = `${t * -60}px`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}

/* ---------------- GAME OVER ---------------- */

export function showGameOver({ stationsSurvived, highestBalance, bestStation }) {
  const screen = el('gameOverScreen');
  el('goStations').textContent = String(stationsSurvived);
  el('goHighest').textContent = formatUSD(highestBalance);
  el('goBest').textContent = String(bestStation);
  const shown = Math.round(highestBalance).toLocaleString('en-US');
  const msg = `שחקתי gamblerer והרווחתי *${shown}$* עד ההפסד.\nנסו גם אתם: https://gamblerer.vercel.app/`;
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
