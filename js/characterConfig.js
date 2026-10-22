/**
 * characterConfig.js
 * ------------------------------------------------------------------
 * Modular character + color-palette configuration.
 *
 * Each character entry describes:
 *  - id:            stable identifier
 *  - name:          display name
 *  - asset:         path to the transparent-background illustration
 *  - mask:          path to the recolorable-clothing grayscale mask
 *                    (white = fully recolorable, black = untouched)
 *  - defaultColor:  fallback clothing color id if recoloring is unavailable
 *
 * To add a new character:
 *   1. Drop a transparent PNG in assets/characters/<id>.png
 *   2. (Optional) Add a matching <id>_mask.png grayscale mask that is
 *      white over the clothing region you want recolorable and black
 *      everywhere else (skin, hair, accessories, armor, etc).
 *   3. Add an entry below.
 *   4. If no mask is supplied, the character is still fully playable —
 *      it simply won't be recolored (see recolor.js fallback behavior).
 * ------------------------------------------------------------------
 */

export const CHARACTERS = [
  {
    id: 'gnome',
    name: 'Gnome',
    asset: 'assets/characters/gnome.png',
    mask: 'assets/characters/gnome_mask.png',
    defaultColor: 'green',
  },
  {
    id: 'pirate',
    name: 'Pirate',
    asset: 'assets/characters/pirate.png',
    mask: 'assets/characters/pirate_mask.png',
    defaultColor: 'blue',
  },
  {
    id: 'elderly_man',
    name: 'Elderly Man',
    asset: 'assets/characters/elderly_man.png',
    mask: 'assets/characters/elderly_man_mask.png',
    defaultColor: 'orange',
  },
  {
    id: 'young_girl',
    name: 'Young Girl',
    asset: 'assets/characters/young_girl.png',
    mask: 'assets/characters/young_girl_mask.png',
    defaultColor: 'pink',
  },
  {
    id: 'businessman',
    name: 'Businessman',
    asset: 'assets/characters/businessman.png',
    mask: 'assets/characters/businessman_mask.png',
    defaultColor: 'blue',
  },
  {
    id: 'businesswoman',
    name: 'Businesswoman',
    asset: 'assets/characters/businesswoman.png',
    mask: 'assets/characters/businesswoman_mask.png',
    defaultColor: 'purple',
  },
  {
    id: 'knight',
    name: 'Knight',
    asset: 'assets/characters/knight.png',
    mask: 'assets/characters/knight_mask.png',
    defaultColor: 'red',
  },
  {
    id: 'clown',
    name: 'Clown',
    asset: 'assets/characters/clown.png',
    mask: 'assets/characters/clown_mask.png',
    defaultColor: 'yellow',
  },
  {
    id: 'magician',
    name: 'Magician',
    asset: 'assets/characters/magician.png',
    mask: 'assets/characters/magician_mask.png',
    defaultColor: 'purple',
  },
  {
    id: 'farmer',
    name: 'Farmer',
    asset: 'assets/characters/farmer.png',
    mask: 'assets/characters/farmer_mask.png',
    defaultColor: 'orange',
  },
  {
    id: 'casino_dealer',
    name: 'Casino Dealer',
    asset: 'assets/characters/casino_dealer.png',
    mask: 'assets/characters/casino_dealer_mask.png',
    defaultColor: 'red',
  },
  {
    id: 'mysterious_traveler',
    name: 'Mysterious Traveler',
    asset: 'assets/characters/mysterious_traveler.png',
    mask: 'assets/characters/mysterious_traveler_mask.png',
    defaultColor: 'teal',
  },
];

// Independent recolor palette (>= 8 colors as required).
export const COLOR_PALETTE = [
  { id: 'green', hex: '#2ecc71' },
  { id: 'blue', hex: '#3498db' },
  { id: 'red', hex: '#e74c3c' },
  { id: 'purple', hex: '#9b59b6' },
  { id: 'yellow', hex: '#f1c40f' },
  { id: 'orange', hex: '#e67e22' },
  { id: 'pink', hex: '#ff6fa1' },
  { id: 'teal', hex: '#1abc9c' },
];

export function getCharacterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

export function getColorById(id) {
  return COLOR_PALETTE.find((c) => c.id === id) || COLOR_PALETTE[0];
}

export function randomColorId() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)].id;
}

/**
 * Pick two distinct characters, each with an independently random color,
 * while avoiding generating the exact same character+color combo twice.
 */
export function pickTwoDistinctCharacterOffers() {
  const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
  const charA = shuffled[0];
  const charB = shuffled[1];

  let colorA = randomColorId();
  let colorB = randomColorId();

  // characters already differ, but guard the (char,color) pair anyway
  // in case future configs allow repeated character slots.
  let guard = 0;
  while (charA.id === charB.id && colorA === colorB && guard < 10) {
    colorB = randomColorId();
    guard++;
  }

  return [
    { character: charA, colorId: colorA },
    { character: charB, colorId: colorB },
  ];
}
