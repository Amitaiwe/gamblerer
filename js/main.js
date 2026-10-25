/**
 * main.js
 * ------------------------------------------------------------------
 * Boots the game: wires gameState + diceLogic + offerGenerator to
 * the UI rendering layer and handles the full station-resolution
 * sequence (select -> roll -> result -> walk -> next station).
 * ------------------------------------------------------------------
 */

import {
  createInitialState,
  selectOffer,
  resolveSelectedOffer,
  advanceStation,
  stationsSurvived,
} from './gameState.js';
import { rollDice } from './diceLogic.js';
import { finalizeRun, loadRecords, saveDailyResult } from './records.js';
import { CHARACTERS, COLOR_PALETTE } from './characterConfig.js';
import { Sound } from './sound.js';
import {
  renderTopBar,
  renderOffers,
  setDieRolling,
  setDiceFaces,
  playDiceRoll,
  showRollStage,
  hideRollStage,
  showPlayerSelect,
  setDiceHint,
  renderResult,
  hideResult,
  playWalkingTransition,
  showGameOver,
  hideGameOver,
  renderSoundIcon,
  shakeScreen,
  resetBalanceDisplay,
  onModeClick,
  prewarmAllCharacterArt,
} from './ui.js';
import { getLang, setLang, applyStatic, t } from './i18n.js';

let state = createInitialState();

const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RESULT_PAUSE_MS = prefersReducedMotion ? 150 : 1100;

function render() {
  renderTopBar(state);
  renderOffers(state, handleSelectOffer);
  hideResult();
  hideRollStage();
  setDiceHint(state.isAllIn ? t('allInChoose') : t('chooseOffer'));
  setDiceFaces(null);
}

async function handleSelectOffer(offerId) {
  if (state.locked) return;
  Sound.cardSelect();
  state = selectOffer(state, offerId);
  renderOffers(state, handleSelectOffer); // re-render to show disabled/selected styling

  await runDiceSequence();
}

function runDiceSequence() {
  return new Promise((resolve) => {
    // Resolve the ACTUAL result up front via the pure game-logic
    // function. The animation below only displays faces; it never
    // influences or rerolls this value.
    const roll = rollDice(); // { dieA, dieB, isDouble, result }

    setDieRolling(true);
    setDiceHint(t('rolling'));
    showRollStage();

    // The animation only displays the two rolled dice (about 3 s, tap to skip).
    playDiceRoll(roll, { reducedMotion: prefersReducedMotion }).then(async () => {
      setDieRolling(false);
      setDiceFaces(roll);
      setDiceHint(
        roll.isDouble
          ? (getLang() === 'he' ? `דאבל ${roll.dieA}! בונוס +${roll.dieA * 10}%` : `DOUBLE ${roll.dieA}! +${roll.dieA * 10}% bonus`)
          : `${roll.dieA} ${t('vsWord')} ${roll.dieB} - ${roll.result} ${t('countsWord')}`
      );

      const balanceBefore = state.balance;
      state = resolveSelectedOffer(state, roll);
      const outcome = state.lastOutcome;

      renderTopBar(state);
      renderResult(outcome);
      outcome.won ? Sound.win() : Sound.lose();

      await wait(RESULT_PAUSE_MS);

      if (state.gameOver) {
        shakeScreen();
        await wait(prefersReducedMotion ? 0 : 700);
        await handleGameOver();
        resolve();
        return;
      }

      Sound.walking();
      await playWalkingTransition({ reducedMotion: prefersReducedMotion, balanceFrom: balanceBefore, balanceTo: state.lastOutcome.newBalance });

      state = advanceStation(state);
      render();
      resolve();
    });
  });
}

function wait(ms) {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function handleGameOver() {
  Sound.gameOver();
  const survived = stationsSurvived(state);
  const records = finalizeRun({
    stationsSurvived: survived,
    highestBalanceThisRun: state.highestBalanceThisRun,
    allInSurvivedThisRun: state.allInSurvivedThisRun,
  });

  const daily = state.mode === 'daily'
    ? saveDailyResult(state.dateKey, state.highestBalanceThisRun)
    : null;
  // Aggregate-only global counters: 3 numbers, no IDs. Fire-and-forget.
  fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stations: survived,
      peak: Math.round(state.highestBalanceThisRun),
      allins: state.allInSurvivedThisRun,
    }),
  }).catch(() => {});
  showGameOver({
    stationsSurvived: survived,
    highestBalance: state.highestBalanceThisRun,
    bestStation: records.bestStation,
    history: state.history,
    records,
    daily,
  });
}

function startRun(mode) {
  hideGameOver();
  state = createInitialState(mode);
  resetBalanceDisplay(state.balance);
  render();
}

function restartGame() {
  askPlayerThenStart(state.mode);
}

// Back to the main HE/SHE screen; the run starts only after a fresh pick.
function askPlayerThenStart(mode) {
  hideGameOver();
  showPlayerSelect(() => startRun(mode));
}

function initSoundToggle() {
  renderSoundIcon(Sound.isMuted());
  document.getElementById('soundToggle').addEventListener('click', () => {
    const muted = Sound.toggleMuted();
    renderSoundIcon(muted);
  });
}

function initSettings() {
  const panel = document.getElementById('settingsPanel');
  const btnHe = document.getElementById('langHe');
  const btnEn = document.getElementById('langEn');
  const refresh = () => {
    btnHe.classList.toggle('is-current', getLang() === 'he');
    btnEn.classList.toggle('is-current', getLang() === 'en');
  };
  const apply = (l) => { setLang(l); applyStatic(); render(); refresh(); };
  document.getElementById('settingsBtn').addEventListener('click', () => { panel.hidden = !panel.hidden; });
  panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });
  btnHe.addEventListener('click', () => apply('he'));
  btnEn.addEventListener('click', () => apply('en'));
  setLang(getLang());
  applyStatic();
  refresh();
}

function init() {
  initSettings();
  document.getElementById('playAgainBtn').addEventListener('click', restartGame);
  document.getElementById('playDailyBtn').addEventListener('click', () => askPlayerThenStart('daily'));
  onModeClick(() => startRun(state.mode === 'daily' ? 'free' : 'daily'));
  initSoundToggle();
  document.getElementById('playerBtn').addEventListener('click', () => showPlayerSelect());
  // Nothing is persisted, so every visit starts on the player-select screen.
  showPlayerSelect();
  render();
  // Warm the recolor cache in the background so later cards render instantly.
  prewarmAllCharacterArt(CHARACTERS, COLOR_PALETTE);
}

init();
