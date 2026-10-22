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
    rows.push({ facesStr, label, netText, netClass });
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
    costValue.textContent = state.isAllIn ? `Entire Balance (${formatUSD(offer.cost)})` : formatUSD(offer.cost);

    const rows = buildOutcomeRows(offer, state.isAllIn);
    rows.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'offerCard__outcome';
      li.innerHTML = `<span class="dice-faces">🎲 ${r.facesStr}</span><span>${r.label}</span><span class="${r.netClass}">${r.netText}</span>`;
      outcomesList.appendChild(li);
    });

    selectBtn.disabled = state.locked;
    selectBtn.addEventListener('click', () => onSelect(offer.id));

    renderOfferCardArt(img, offer);

    container.appendChild(node);
  });
}

/* ---------------- DICE ---------------- */

const DIE_FACE_SYMBOLS = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

export function setDieRolling(isRolling) {
  const die = el('die');
  const hint = el('diceHint');
  if (isRolling) {
    die.classList.add('is-rolling');
    hint.textContent = 'Rolling...';
  } else {
    die.classList.remove('is-rolling');
  }
}

export function setDieFace(value) {
  el('dieFace').textContent = DIE_FACE_SYMBOLS[value] || '?';
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

/* ---------------- WALKING TRANSITION ---------------- */

export function playWalkingTransition({ reducedMotion } = {}) {
  return new Promise((resolve) => {
    const overlay = el('walkOverlay');
    const skipBtn = el('skipWalkBtn');
    overlay.hidden = false;

    const duration = reducedMotion ? 50 : 1000;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      overlay.hidden = true;
      skipBtn.removeEventListener('click', finish);
      resolve();
    };

    skipBtn.addEventListener('click', finish);
    window.setTimeout(finish, duration);
  });
}

/* ---------------- GAME OVER ---------------- */

export function showGameOver({ stationsSurvived, highestBalance, bestStation }) {
  const screen = el('gameOverScreen');
  el('goStations').textContent = String(stationsSurvived);
  el('goHighest').textContent = formatUSD(highestBalance);
  el('goBest').textContent = String(bestStation);
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
