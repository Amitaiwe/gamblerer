/**
 * diceLogic.js
 * ------------------------------------------------------------------
 * Pure, testable game-logic functions. No DOM access here.
 * ------------------------------------------------------------------
 */

/** Fair uniform random integer 1..6. */
export function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
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
export function applyOrdinaryBet(balance, offer, rollResult) {
  const cost = offer.cost;
  if (cost > balance) {
    throw new Error('Insufficient balance for ordinary bet');
  }
  const afterCost = balance - cost;
  const payout = resolvePayout(offer, rollResult);
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
export function applyAllInBet(balance, offer, rollResult) {
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
