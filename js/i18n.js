/**
 * i18n.js (mockup preview)
 * ------------------------------------------------------------------
 * Hebrew/English UI strings + language state. Language choice is
 * remembered in localStorage ('gamblerer.lang') and applied on boot.
 * ------------------------------------------------------------------
 */

const NAMES_HE = {
  'Gnome': 'גמד', 'Pirate': 'פיראט', 'Elderly Man': 'זקן', 'Young Girl': 'ילדה',
  'Businessman': 'איש עסקים', 'Businesswoman': 'אשת עסקים', 'Knight': 'אביר',
  'Clown': 'ליצן', 'Magician': 'קוסם', 'Farmer': 'חקלאי',
  'Casino Dealer': 'דילר', 'Mysterious Traveler': 'נוסע מסתורי',
};

const LABELS_HE = {
  'Conservative': 'שמרני', 'Balanced': 'מאוזן', 'High-Risk': 'סיכון גבוה',
  'Rare Jackpot': 'ג׳קפוט נדיר', 'Steady Nerve': 'עצבים יציבים',
  'Double or Nothing': 'כפול או כלום', 'Cautious Hedge': 'גידור זהיר',
  'All or Nothing': 'הכל או כלום', 'Fifty-Fifty': 'חמישים-חמישים',
  'Lucky Sixes': 'שישיות מזל', 'Ordinary Bet': 'הימור רגיל', 'ALL-IN': 'אול-אין',
};

const STR = {
  en: {
    balance: 'Balance', station: 'Station', best: 'Best', player: 'PLAYER',
    settings: 'SETTINGS', language: 'Language',
    ordinaryBet: 'ORDINARY BET', allInStation: 'ALL-IN STATION', dailyPrefix: 'DAILY · ',
    dailyChallenge: 'DAILY CHALLENGE', freePlay: 'FREE PLAY',
    tapForFreePlay: 'tap for FREE PLAY', tapForDaily: 'tap for DAILY CHALLENGE',
    virtualOnly: 'VIRTUAL MONEY ONLY',
    chooseOffer: 'Choose an offer to roll the dice', allInChoose: 'ALL-IN — choose wisely',
    rolling: 'Rolling...', tapToSkip: 'Tap to skip', skip: 'Skip ▶',
    vsWord: 'vs', countsWord: 'counts',
    youWon: 'YOU WON', youLost: 'YOU LOST',
    payout: 'Payout', netChange: 'Net Change', newBalance: 'New Balance',
    walkingToNext: 'WALKING TO NEXT STATION', balanceCaps: 'BALANCE',
    choosePlayer: 'CHOOSE YOUR PLAYER', whoWalks: 'Who walks the corridor?',
    select: 'SELECT', changeLater: 'YOU CAN CHANGE IT LATER',
    bet: 'Bet', profitChance: 'Profit chance', lossWord: 'Loss', bust: 'BUST',
    gameOver: 'GAME OVER', houseCollects: 'The house always collects.',
    lastGameSection: 'THE GAME THAT JUST ENDED', historySection: 'YOUR HISTORY ON THIS DEVICE',
    highestBalance: 'Peak balance this game', stationsSurvived: 'Stations Survived',
    allTimeBestStation: 'Best station ever', balanceByStation: 'BALANCE BY STATION',
    shareWhatsapp: 'SHARE ON WHATSAPP', playAgain: 'PLAY AGAIN',
    playDaily: "PLAY TODAY'S DAILY CHALLENGE",
    runsPlayed: 'Runs played', avgHighest: 'Average highest balance',
    avgStations: 'Average stations survived', allTimeHighest: 'All-time highest balance',
    allInsSurvived: 'ALL-INs survived (total)',
    startWord: 'Start', peakWord: 'Peak', stationWord: 'station', logScale: 'log scale',
  },
  he: {
    balance: 'יתרה', station: 'תחנה', best: 'שיא', player: 'שחקן',
    settings: 'הגדרות', language: 'שפה',
    ordinaryBet: 'הימור רגיל', allInStation: 'תחנת אול-אין', dailyPrefix: 'אתגר יומי · ',
    dailyChallenge: 'אתגר יומי', freePlay: 'משחק חופשי',
    tapForFreePlay: 'מעבר למשחק חופשי', tapForDaily: 'מעבר לאתגר היומי',
    virtualOnly: 'כסף וירטואלי בלבד',
    chooseOffer: 'בחר הצעה כדי להטיל את הקוביות', allInChoose: 'אול-אין - בחר בחוכמה',
    rolling: 'מטיל...', tapToSkip: 'הקש לדילוג', skip: 'דילוג ▶',
    vsWord: 'מול', countsWord: 'קובע',
    youWon: 'ניצחת', youLost: 'הפסדת',
    payout: 'תשלום', netChange: 'שינוי נטו', newBalance: 'יתרה חדשה',
    walkingToNext: 'הולכים לתחנה הבאה', balanceCaps: 'יתרה',
    choosePlayer: 'בחר שחקן', whoWalks: 'מי ילך במסדרון?',
    select: 'בחירה', changeLater: 'אפשר להחליף אחר כך',
    bet: 'הימור', profitChance: 'סיכוי לרווח', lossWord: 'הפסד', bust: 'הפסדת',
    gameOver: 'המשחק נגמר', houseCollects: 'הבית תמיד גובה.',
    lastGameSection: 'המשחק שזה עתה נגמר', historySection: 'ההיסטוריה שלך במכשיר הזה',
    highestBalance: 'יתרת שיא במשחק', stationsSurvived: 'תחנות ששרדת',
    allTimeBestStation: 'שיא תחנות אי־פעם', balanceByStation: 'יתרה לפי תחנה',
    shareWhatsapp: 'שיתוף בוואטסאפ', playAgain: 'שחק שוב',
    playDaily: 'שחק באתגר היומי',
    runsPlayed: 'משחקים', avgHighest: 'יתרת שיא ממוצעת',
    avgStations: 'ממוצע תחנות', allTimeHighest: 'יתרת שיא מכל הזמנים',
    allInsSurvived: 'אול-אינים ששרדו (סה״כ)',
    startWord: 'התחלה', peakWord: 'שיא', stationWord: 'תחנה', logScale: 'סקלה לוגריתמית',
  },
};

let lang = 'en';
try { lang = window.localStorage.getItem('gamblerer.lang') === 'he' ? 'he' : 'en'; } catch (e) { /* ignore */ }

export function getLang() { return lang; }

export function setLang(l) {
  lang = l === 'he' ? 'he' : 'en';
  try { window.localStorage.setItem('gamblerer.lang', lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export function t(key) {
  const v = STR[lang][key];
  return v !== undefined ? v : (STR.en[key] !== undefined ? STR.en[key] : key);
}

export function charName(en) { return lang === 'he' ? (NAMES_HE[en] || en) : en; }
export function offerLabel(en) { return lang === 'he' ? (LABELS_HE[en] || en) : en; }

/** Apply translations to every static element tagged with data-i18n. */
export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
}
