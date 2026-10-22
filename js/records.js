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
  saveRecords(records);
  return records;
}
