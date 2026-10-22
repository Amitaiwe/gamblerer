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
import { rollDie } from './diceLogic.js';
import { finalizeRun, loadRecords, saveDailyResult } from './records.js';
import { CHARACTERS, COLOR_PALETTE } from './characterConfig.js';
import { Sound } from './sound.js';
import {
  renderTopBar,
  renderOffers,
  setDieRolling,
  setDieFace,
  playDieRoll,
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

let state = createInitialState();

const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RESULT_PAUSE_MS = prefersReducedMotion ? 150 : 1100;

function render() {
  renderTopBar(state);
  renderOffers(state, handleSelectOffer);
  hideResult();
  hideRollStage();
  setDiceHint(state.isAllIn ? 'ALL-IN — choose wisely' : 'Choose an offer to roll the dice');
  setDieFace(null);
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
    const actualResult = rollDie();

    setDieRolling(true);
    setDiceHint('Rolling...');
    showRollStage();

    // The animation only displays actualResult (about 3 s, tap to skip).
    playDieRoll(actualResult, { reducedMotion: prefersReducedMotion }).then(async () => {
      setDieRolling(false);
      setDieFace(actualResult);
      setDiceHint(`Result: ${actualResult}`);

      state = resolveSelectedOffer(state, actualResult);
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
      await playWalkingTransition({ reducedMotion: prefersReducedMotion });

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

function init() {
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
