/**
 * offerGenerator.js
 * ------------------------------------------------------------------
 * Data-driven, configurable offer generation with controlled
 * economic scaling. All tunable numbers live in this module.
 * ------------------------------------------------------------------
 */

import { pickTwoDistinctCharacterOffers } from './characterConfig.js';

let offerIdCounter = 0;
function nextOfferId() {
  offerIdCounter += 1;
  return `offer_${Date.now()}_${offerIdCounter}`;
}

/* ---------------------------------------------------------------- *
 * ORDINARY BET TEMPLATES
 * Each template is a function(stationNumber, balance) -> { cost, payouts }
 * payouts maps dice result 1..6 -> total payout amount.
 * Templates are grouped by risk category; station scaling is gentle
 * (sub-linear) to avoid runaway inflation.
 * ---------------------------------------------------------------- */

function scaleFactor(stationNumber) {
  // Gentle, capped growth curve. Station 1 => 1.0, asymptotically approaches ~3.2x
  return 1 + Math.min(2.2, Math.log2(1 + stationNumber) * 0.45);
}

function roundToTen(n) {
  return Math.max(10, Math.round(n / 10) * 10);
}

// Rare Jackpot 6-face multiplier. Was 9.5 (return ~1.67 per $1, far better than
// every other offer). 6.0 gives return ~1.08, in line with the other bets.
export const RARE_JACKPOT_MULT = 6.0;

// Percent-of-balance cost scaling: from this station on, each ordinary offer
// costs at least this share of the current balance (cost and payouts scale
// together, so odds and ratios stay identical). Only bites on lucky runs.
export const PCT_SCALING_FROM_STATION = 5;
export const PCT_OF_BALANCE = {
  Conservative: 0.08,
  Balanced: 0.12,
  'High-Risk': 0.16,
  'Rare Jackpot': 0.20,
};

const ORDINARY_TEMPLATES = [
  // Conservative: small, frequent, modest upside
  (station, balance) => {
    const f = scaleFactor(station);
    const cost = roundToTen(120 * f);
    return {
      cost,
      payouts: {
        1: roundToTen(cost * 0.5),
        2: roundToTen(cost * 0.5),
        3: roundToTen(cost * 1.0),
        4: roundToTen(cost * 1.3),
        5: roundToTen(cost * 1.3),
        6: roundToTen(cost * 1.8),
      },
      label: 'Conservative',
    };
  },
  // Balanced: medium risk, medium reward
  (station, balance) => {
    const f = scaleFactor(station);
    const cost = roundToTen(200 * f);
    return {
      cost,
      payouts: {
        1: 0,
        2: roundToTen(cost * 0.5),
        3: roundToTen(cost * 1.0),
        4: roundToTen(cost * 1.0),
        5: roundToTen(cost * 1.75),
        6: roundToTen(cost * 2.2),
      },
      label: 'Balanced',
    };
  },
  // High-risk: low chance, big reward, several losing faces
  (station, balance) => {
    const f = scaleFactor(station);
    const cost = roundToTen(260 * f);
    return {
      cost,
      payouts: {
        1: 0,
        2: 0,
        3: 0,
        4: roundToTen(cost * 0.9),
        5: roundToTen(cost * 1.5),
        6: roundToTen(cost * 4.0),
      },
      label: 'High-Risk',
    };
  },
  // Rare: very large potential reward on a single face
  (station, balance) => {
    const f = scaleFactor(station);
    const cost = roundToTen(400 * f);
    return {
      cost,
      payouts: {
        1: roundToTen(cost * 0.1),
        2: roundToTen(cost * 0.1),
        3: roundToTen(cost * 0.1),
        4: roundToTen(cost * 0.1),
        5: roundToTen(cost * 0.1),
        6: roundToTen(cost * RARE_JACKPOT_MULT),
      },
      label: 'Rare Jackpot',
    };
  },
];

/* ---------------------------------------------------------------- *
 * ALL-IN TEMPLATES
 * Payouts are MULTIPLIERS applied to the player's current balance
 * (the stake), since the stake itself scales with the run.
 * Two different distributions are always paired together.
 * ---------------------------------------------------------------- */

const ALL_IN_TEMPLATE_PAIRS = [
  [
    // "Coin flip plus" — wide safe-ish split
    {
      label: 'Steady Nerve',
      payoutMultipliers: { 1: 0, 2: 0, 3: 1.1, 4: 1.1, 5: 1.6, 6: 1.6 },
    },
    // "High variance" — mostly bust, huge jackpot
    {
      label: 'Double or Nothing',
      payoutMultipliers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2.4, 6: 2.4 },
    },
  ],
  [
    {
      label: 'Cautious Hedge',
      payoutMultipliers: { 1: 0.5, 2: 0.5, 3: 0.9, 4: 0.9, 5: 1.4, 6: 1.4 },
    },
    {
      label: 'All or Nothing',
      payoutMultipliers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3.0 },
    },
  ],
  [
    {
      label: 'Fifty-Fifty',
      payoutMultipliers: { 1: 0, 2: 0, 3: 0, 4: 1.9, 5: 1.9, 6: 1.9 },
    },
    {
      label: 'Lucky Sixes',
      payoutMultipliers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1.1, 6: 3.6 },
    },
  ],

];

/**
 * Scale an ordinary offer down so its cost never exceeds the current balance.
 * Cost and all payouts are scaled by the same factor, so the offer's risk
 * profile (payout ratios, displayed odds) is unchanged - only the stake
 * size shrinks to fit what the player can pay.
 */
function fitOfferToBalance(cost, payouts, balance) {
  if (cost <= balance) return { cost, payouts };
  const factor = balance / cost;
  const scaledPayouts = {};
  for (const [face, amount] of Object.entries(payouts)) {
    scaledPayouts[face] = Math.round(amount * factor);
  }
  return { cost: balance, payouts: scaledPayouts };
}

function scaleUpForBalance(raw, station, balance) {
  const pct = PCT_OF_BALANCE[raw.label];
  if (station < PCT_SCALING_FROM_STATION || !pct) return raw;
  const target = Math.round(balance * pct);
  if (target <= raw.cost) return raw;
  const factor = target / raw.cost;
  const payouts = {};
  for (const [face, amount] of Object.entries(raw.payouts)) {
    payouts[face] = Math.round(amount * factor);
  }
  return { ...raw, cost: target, payouts };
}

function buildOrdinaryOffer(station, balance, character, colorId, templateFn) {
  const raw = scaleUpForBalance(templateFn(station, balance), station, balance);
  const { cost, payouts } = fitOfferToBalance(raw.cost, raw.payouts, balance);
  const label = raw.label;
  return {
    id: nextOfferId(),
    kind: 'ordinary',
    label,
    characterId: character.id,
    colorId,
    cost,
    payouts,
  };
}

function buildAllInOffer(balance, character, colorId, template) {
  return {
    id: nextOfferId(),
    kind: 'allin',
    label: template.label,
    characterId: character.id,
    colorId,
    cost: balance, // entire balance staked
    payoutMultipliers: template.payoutMultipliers,
  };
}

/** Small seeded PRNG (mulberry32) used ONLY for offers in the daily challenge. */
export function makeSeededRng(seedString) {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
  a >>>= 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate the two offers for a station.
 * @param {number} stationNumber 1-based station index
 * @param {boolean} isAllIn whether this is an ALL-IN station
 * @param {number} balance current player balance
 * @param {function} rng random source for offers only (never used for the die)
 */
export function generateStationOffers(stationNumber, isAllIn, balance, rng = Math.random) {
  const [slotA, slotB] = pickTwoDistinctCharacterOffers(rng);

  if (isAllIn) {
    const pair =
      ALL_IN_TEMPLATE_PAIRS[
        Math.floor(rng() * ALL_IN_TEMPLATE_PAIRS.length)
      ];
    // Randomize which offer goes on which side
    const [tA, tB] = rng() < 0.5 ? pair : [pair[1], pair[0]];
    return [
      buildAllInOffer(balance, slotA.character, slotA.colorId, tA),
      buildAllInOffer(balance, slotB.character, slotB.colorId, tB),
    ];
  }

  // Pick two different ordinary templates for visibly different profiles
  const idxA = Math.floor(rng() * ORDINARY_TEMPLATES.length);
  let idxB = Math.floor(rng() * ORDINARY_TEMPLATES.length);
  if (idxB === idxA) idxB = (idxB + 1) % ORDINARY_TEMPLATES.length;

  return [
    buildOrdinaryOffer(
      stationNumber,
      balance,
      slotA.character,
      slotA.colorId,
      ORDINARY_TEMPLATES[idxA]
    ),
    buildOrdinaryOffer(
      stationNumber,
      balance,
      slotB.character,
      slotB.colorId,
      ORDINARY_TEMPLATES[idxB]
    ),
  ];
}

export function isAllInStation(stationNumber) {
  // Station 1: ordinary, Station 2: ALL-IN, Station 3: ordinary, ...
  return stationNumber % 2 === 0;
}
