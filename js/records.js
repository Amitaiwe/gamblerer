/**
 * records.js
 * ------------------------------------------------------------------
 * Persistent local records via localStorage.
 * ------------------------------------------------------------------
 */

const STORAGE_KEY = 'gamblerer_records_v1';

const DEFAULT_RECORDS = {
  bestStation: 0,
  highestBalance: 1000,
  totalRuns: 0,
  totalAllInSurvived: 0,
  trackedRuns: 0,
  sumHighest: 0,
  sumStations: 0,
};

function safeParse(json) {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_RECORDS, ...parsed };
    }
  } catch (e) {
    // ignore corrupt data
  }
  return { ...DEFAULT_RECORDS };
}

export function loadRecords() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    return safeParse(raw);
  } catch (e) {
    // localStorage unavailable (private mode, etc.) - fall back silently
    return { ...DEFAULT_RECORDS };
  }
}

export function saveRecords(records) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    // ignore write failures
  }
}

/**
 * Update records at the end of a run and persist them.
 * Returns the updated records object.
 */
export function finalizeRun({ stationsSurvived, highestBalanceThisRun, allInSurvivedThisRun }) {
  const records = loadRecords();
  records.bestStation = Math.max(records.bestStation, stationsSurvived);
  records.highestBalance = Math.max(records.highestBalance, highestBalanceThisRun);
  records.totalRuns += 1;
  records.totalAllInSurvived += allInSurvivedThisRun;
  records.trackedRuns += 1;
  records.sumHighest += highestBalanceThisRun;
  records.sumStations += stationsSurvived;
  saveRecords(records);
  return records;
}

/* ---------- Daily challenge best score (per UTC date) ---------- */
const DAILY_KEY = 'gamblerer_daily_v1';

export function loadDailyBest(dateKey) {
  try {
    const d = JSON.parse(window.localStorage.getItem(DAILY_KEY) || '{}');
    return d.date === dateKey ? d : { date: dateKey, best: 0, plays: 0 };
  } catch (e) {
    return { date: dateKey, best: 0, plays: 0 };
  }
}

export function saveDailyResult(dateKey, highestBalance) {
  const d = loadDailyBest(dateKey);
  d.best = Math.max(d.best, highestBalance);
  d.plays += 1;
  try { window.localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
  return d;
}
