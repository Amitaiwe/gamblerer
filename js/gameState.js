/**
 * gameState.js
 * ------------------------------------------------------------------
 * Central mutable game state + state-transition helpers.
 * Kept free of DOM access so it can be unit tested headlessly.
 * ------------------------------------------------------------------
 */

import {
  generateStationOffers,
  isAllInStation,
} from './offerGenerator.js';
import {
  applyOrdinaryBet,
  applyAllInBet,
  isGameOver,
} from './diceLogic.js';
import { loadRecords } from './records.js';

const STARTING_BALANCE = 1000;

export function createInitialState() {
  const records = loadRecords();
  const station = 1;
  const balance = STARTING_BALANCE;
  return {
    balance,
    station,
    highestBalanceThisRun: balance,
    allInSurvivedThisRun: 0,
    isAllIn: isAllInStation(station),
    offers: generateStationOffers(station, isAllInStation(station), balance),
    selectedOfferId: null,
    lastRollResult: null,
    lastOutcome: null, // { payout, netChange, newBalance, won }
    gameOver: false,
    bestStation: records.bestStation,
    locked: false, // true while an offer is being resolved (prevents double-selection)
  };
}

export function selectOffer(state, offerId) {
  if (state.locked || state.gameOver) return state;
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return state;
  return { ...state, selectedOfferId: offerId, locked: true };
}

/**
 * Resolve the currently selected offer with a given dice roll.
 * Returns a new state object with outcome details populated.
 */
export function resolveSelectedOffer(state, rollResult) {
  const offer = state.offers.find((o) => o.id === state.selectedOfferId);
  if (!offer) return state;

  const result = state.isAllIn
    ? applyAllInBet(state.balance, offer, rollResult)
    : applyOrdinaryBet(state.balance, offer, rollResult);

  const newBalance = result.newBalance;
  const won = result.netChange >= 0;
  const gameOver = isGameOver(newBalance);

  return {
    ...state,
    balance: newBalance,
    highestBalanceThisRun: Math.max(state.highestBalanceThisRun, newBalance),
    allInSurvivedThisRun:
      state.allInSurvivedThisRun + (state.isAllIn && !gameOver ? 1 : 0),
    lastRollResult: rollResult,
    lastOutcome: {
      payout: result.payout,
      cost: result.cost,
      netChange: result.netChange,
      newBalance,
      won,
      offerLabel: offer.label,
      characterId: offer.characterId,
      colorId: offer.colorId,
    },
    gameOver,
  };
}

/** Advance to the next station after a successful (non-game-over) resolution. */
export function advanceStation(state) {
  if (state.gameOver) return state;
  const nextStation = state.station + 1;
  const nextIsAllIn = isAllInStation(nextStation);
  return {
    ...state,
    station: nextStation,
    isAllIn: nextIsAllIn,
    offers: generateStationOffers(nextStation, nextIsAllIn, state.balance),
    selectedOfferId: null,
    lastRollResult: null,
    lastOutcome: null,
    locked: false,
  };
}

export function stationsSurvived(state) {
  // "stations survived" = number of stations fully completed.
  // If game over happened at station N, the player survived N-1... but
  // since they reached station N and lost there, we count completed
  // stations as (current station - 1) plus the current one only if won.
  return state.gameOver ? state.station - 1 : state.station - 1;
}
