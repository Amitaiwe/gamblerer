# GAMBLERER

An endless gambling-survival browser game. Mobile-first, dark-casino aesthetic, virtual money only — **no real-money deposits, withdrawals, or gambling mechanics of any kind.**

Start with $1,000. At every station, two characters offer two different bets. Pick one, the die decides, your balance updates. Every second station is **ALL-IN**: both offers risk your entire balance. Survive as many stations as you can and beat your own record.

---

## 1. Files created

```
gamblerer/
├── index.html                  Entry point — open this to play
├── README.md                   This file
├── css/
│   └── style.css               All styling (dark-casino theme, responsive)
├── js/
│   ├── main.js                 Boots the game, orchestrates the full
│   │                           select → roll → result → walk → next-station
│   │                           sequence
│   ├── gameState.js            Central game state + transitions
│   │                           (pure functions, no DOM)
│   ├── diceLogic.js            Fair dice roll + payout math
│   │                           (pure, unit-tested functions)
│   ├── offerGenerator.js       Data-driven offer templates + economic
│   │                           scaling, ordinary + ALL-IN
│   ├── characterConfig.js      Character roster, color palette,
│   │                           character/color selection logic
│   ├── recolor.js              Canvas-based clothing recoloring engine
│   ├── records.js              localStorage persistent records
│   ├── sound.js                Modular WebAudio sound effects (no
│   │                           external audio files needed)
│   └── ui.js                   DOM rendering (cards, dice, results,
│                                walking transition, game over)
└── assets/
    └── characters/
        ├── <character>.png         12 cropped, transparent-background
        │                           character illustrations
        └── <character>_mask.png    12 grayscale clothing-recolor masks
```

No build step, no backend, no external API calls during gameplay, no authentication.

---

## 2. How to run the game

**Locally:** modern browsers block ES module imports from `file://` URLs, so serve the folder over HTTP. From inside `gamblerer/`:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

(Any static file server works — `npx serve`, VS Code's Live Server, etc.)

**Deploy to GitHub Pages:**
1. Push the contents of `gamblerer/` to a repo (keep `index.html` at the repo root, or in `/docs` if you prefer that convention).
2. Repo Settings → Pages → set the source branch/folder.
3. Done — it's a static site, nothing else to configure.

**Deploy to Vercel:**
1. `vercel` (or connect the repo in the Vercel dashboard).
2. No framework/build settings needed — it's static HTML/CSS/JS, so leave the build command empty and the output directory as the project root.

---

## 3. Replacing placeholder characters with final art

The character art you supplied (a 12-character reference sheet) has already been processed into individual, transparent-background assets at `assets/characters/<id>.png`, one per character, with no overlap between neighbors.

To swap in new/final illustrations later:

1. Export a new transparent PNG for the character, same rough proportions as the current one.
2. Overwrite `assets/characters/<id>.png` (or add a new file and update the `asset` path in `js/characterConfig.js`).
3. If you want that character recolorable, prepare a matching grayscale **mask** image the same pixel dimensions as the art: **white = clothing to recolor, black = everything else** (skin, hair, armor, accessories). Save it as `assets/characters/<id>_mask.png`.
4. That's it — no other code changes needed. If a mask is missing or fails to load, `recolor.js` automatically falls back to rendering the character at its unmodified default colors, so the game never breaks.

## About the clothing-recoloring system

Your source art is flat, shaded raster illustration — not layered clothing. Rather than apply a blanket CSS color filter (which would also recolor skin and hair), this prototype:

1. Auto-generated a **best-effort clothing mask** per character using color/region segmentation (hue clustering seeded on the garment, with skin-tone and silhouette exclusion).
2. At render time, composites a color tint onto the art using the canvas `color` blend mode, which replaces hue/saturation while **keeping the original shading and highlights** (the backdrop's luminosity is preserved), masked so it only affects the clothing region.

**Quality varies by character** — this reflects the real difficulty of recoloring hand-painted raster art automatically:
- **Clean recoloring:** pirate (coat), businesswoman (suit), knight (tabard/sash), clown (jumpsuit), magician (robe), farmer (overalls), casino dealer (vest), mysterious traveler (cloak), gnome (vest), businessman (jacket).
- **Needs manual mask touch-up:** elderly man and young girl — their garments are low-contrast against skin tones and the auto-segmentation only partially separated them. The architecture already supports dropping in a hand-painted replacement mask for just these two (or any character) with zero code changes — see the steps above.

If you'd rather author masks by hand from the start (most reliable), open each `_mask.png` in any image editor, paint the clothing region white and everything else black, and save over the existing file.

---

## 4. Adding new characters and colors

**New character:**
1. Add a transparent PNG to `assets/characters/`.
2. (Optional) Add a matching `_mask.png`.
3. Add an entry to the `CHARACTERS` array in `js/characterConfig.js`:
   ```js
   {
     id: 'wizard',
     name: 'Wizard',
     asset: 'assets/characters/wizard.png',
     mask: 'assets/characters/wizard_mask.png', // or null
     defaultColor: 'purple',
   }
   ```
4. It's immediately in rotation — the station generator picks randomly from the full `CHARACTERS` list.

**New color:**
Add an entry to `COLOR_PALETTE` in `js/characterConfig.js`:
```js
{ id: 'crimson', hex: '#9b1d2e' }
```
It's immediately available to every character's recoloring.

**New offer templates / economic tuning:**
All bet math lives in `js/offerGenerator.js` — ordinary bet templates (`ORDINARY_TEMPLATES`) and ALL-IN template pairs (`ALL_IN_TEMPLATE_PAIRS`) are plain data/functions, independent of the rest of the game.

---

## 5. What's complete

- Full game loop: station progression, ordinary bets, alternating ALL-IN stations, fair dice (`Math.random`-based, uniform 1–6, resolved by a pure testable function and never rerolled).
- Money math: stake deducted once, payout added after, balance floored at 0, ALL-IN stakes the entire current balance.
- 12 characters extracted individually (cropped, transparent background, no overlap) from your reference sheet, each with an auto-generated recolor mask.
- 8-color independent recolor palette; two distinct character+color combos guaranteed per station.
- Data-driven offer generator with 4 ordinary risk tiers (conservative/balanced/high-risk/rare) and 3 ALL-IN template pairs, gently scaling with station number (capped growth, no runaway inflation).
- Dice roll animation (~1.3s) that visibly ticks through random faces before landing on the actual pre-computed result.
- Back-view placeholder player character with a 1-second walking transition (leg-swing + scrolling background + scale/translate), skippable, and shortened automatically under `prefers-reduced-motion`.
- Game-over screen with stations survived, highest balance this run, and best-ever station record; immediate restart.
- Persistent records via `localStorage`: best station, highest balance, total runs, total ALL-IN stations survived.
- Modular WebAudio sound effects (select, dice tick, win, lose, walking, game over) with a mute toggle that persists; no autoplay.
- Fully responsive: cards stack vertically on narrow phones, sit side-by-side from ~480px up.
- Verified with an automated unit-test pass (starting balance, station alternation, two-distinct-character offers, dice range, no-double-deduction, ALL-IN-uses-full-balance, zero-balance game over, restart, and record persistence across reload) and manual browser testing of the full play loop, including a forced game-over run.

## 6. What's incomplete / next steps

- **Elderly man and young girl clothing masks** are only partially accurate (see section 3) — recommend a quick manual touch-up pass in an image editor for these two.
- **Player walking view** is a simple geometric placeholder silhouette, as specced for this prototype — swap in a real back-view illustration by replacing the `.playerSilhouette` markup/CSS in `index.html` / `style.css` (or point it at an image) once that asset exists.
- **Sound** is synthesized (no audio files) — drop real audio files in and swap the `tone()` calls in `js/sound.js` for `<audio>` playback whenever you have final sound assets.
- No analytics, no cloud save, no multiplayer/leaderboard — all state is local to the browser, as specced for this first playable version.
