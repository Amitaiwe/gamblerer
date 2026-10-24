/**
 * diceLogic.js
 * ------------------------------------------------------------------
 * Pure, testable game-logic functions. No DOM access here.
 * ------------------------------------------------------------------
 */

/** Fair uniform random integer 1..6. */
function rollSingleDie() {
  return 1 + Math.floor(Math.random() * 6);
}

/**
 * Resolve a pair of dice into a game result.
 * The higher die counts. A double keeps its own number (it does NOT
 * count as 6) and adds a bonus on top of the regular payout
 * (see doubleBonus).
 * Returns { dieA, dieB, isDouble, result }.
 */
export function resolveRoll(dieA, dieB) {
  const isDouble = dieA === dieB;
  return { dieA, dieB, isDouble, result: isDouble ? dieA : Math.max(dieA, dieB) };
}

/**
 * Roll two dice. The higher die is the result; a double keeps its own
 * number and pays a bonus. Returns { dieA, dieB, isDouble, result }.
 */
export function rollDice() {
  return resolveRoll(rollSingleDie(), rollSingleDie());
}

/** Double bonus: a double-d adds d * 10% of the stake (10% .. 60%). */
export const DOUBLE_BONUS_PER_PIP = 0.10;

/** Bonus amount added to the payout for a double, given the stake. */
export function doubleBonus(roll, stake) {
  if (!roll || !roll.isDouble) return 0;
  return Math.round(stake * roll.dieA * DOUBLE_BONUS_PER_PIP);
}

/**
 * Probability of each final result (1..6) under the two-dice rule:
 * the higher die counts and a double keeps its own number. Out of the
 * 36 equally likely pairs, result d occurs in 2d-1 pairs:
 * 1 -> 1, 2 -> 3, 3 -> 5, 4 -> 7, 5 -> 9, 6 -> 11.
 */
export const RESULT_PROBS = { 1: 1 / 36, 2: 3 / 36, 3: 5 / 36, 4: 7 / 36, 5: 9 / 36, 6: 11 / 36 };

/**
 * Exact profit/loss/even percentages for an offer under the full
 * two-dice + double-bonus rule, computed over all 36 equally likely
 * pairs. ALL-IN nets are fractions of the stake (balance unknown at
 * display time); ordinary nets are exact dollars.
 */
export function summarizeRisk(offer, isAllIn) {
  let profit = 0;
  let loss = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const roll = resolveRoll(a, b);
      let net;
      if (isAllIn) {
        net = offer.payoutMultipliers[String(roll.result)] - 1
          + (roll.isDouble ? roll.dieA * DOUBLE_BONUS_PER_PIP : 0);
      } else {
        net = offer.payouts[String(roll.result)] - offer.cost
          + doubleBonus(roll, offer.cost);
      }
      if (net > 0) profit++;
      else if (net < 0) loss++;
    }
  }
  const profitPct = Math.round((profit / 36) * 100);
  const lossPct = Math.round((loss / 36) * 100);
  return { profitPct, lossPct, evenPct: Math.max(0, 100 - profitPct - lossPct) };
}

/**
 * Resolve the payout for a given offer and dice roll.
 * offer.payouts is a map { "1": number, "2": number, ..., "6": number }
 * Payouts are TOTAL amounts returned (including any equivalent to stake).
 */
export function resolvePayout(offer, rollResult) {
  if (!offer || !offer.payouts) return 0;
  const payout = offer.payouts[String(rollResult)];
  return typeof payout === 'number' ? Math.max(0, Math.round(payout)) : 0;
}

/**
 * Apply an ordinary bet to a balance.
 * Deduct cost first, then add payout. Never allow negative balance.
 */
export function applyOrdinaryBet(balance, offer, rollResult, bonus = 0) {
  const cost = offer.cost;
  if (cost > balance) {
    throw new Error('Insufficient balance for ordinary bet');
  }
  const afterCost = balance - cost;
  const payout = resolvePayout(offer, rollResult) + bonus;
  const newBalance = Math.max(0, afterCost + payout);
  return {
    newBalance,
    cost,
    payout,
    netChange: newBalance - balance,
  };
}

/**
 * Apply an ALL-IN bet. The entire current balance is staked.
 * A payout of 0 means total loss (balance becomes 0 -> game over upstream).
 */
export function applyAllInBet(balance, offer, rollResult, bonus = 0) {
  const stake = balance;
  const afterStake = 0; // entire balance deducted
  const payoutMultiplier = offer.payoutMultipliers
    ? offer.payoutMultipliers[String(rollResult)]
    : null;

  let payout;
  if (typeof payoutMultiplier === 'number') {
    payout = Math.max(0, Math.round(stake * payoutMultiplier));
  } else {
    payout = resolvePayout(offer, rollResult);
  }
  payout += bonus;

  const newBalance = Math.max(0, afterStake + payout);
  return {
    newBalance,
    cost: stake,
    payout,
    netChange: newBalance - balance,
  };
}

export function isGameOver(balance) {
  return balance <= 0;
}
