// Best-score persistence. localStorage only; a blocked store degrades to
// memory so the game never crashes in private windows.
const BEST_SCORE_KEY = 'dunesail.bestScore';
const BEST_LEVEL_KEY = 'dunesail.bestLevel';
const MUTED_KEY = 'dunesail.muted';
let memoryBest = 0;
let memoryLevel = 0;

function readStored(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the in-memory copy still works for this visit.
  }
}

export function loadBestScore() {
  const raw = readStored(BEST_SCORE_KEY);
  const value = raw === null ? 0 : Number.parseInt(raw, 10) || 0;
  memoryBest = Math.max(memoryBest, value);
  return memoryBest;
}

export function saveBestScore(score) {
  if (score <= memoryBest) return memoryBest;
  memoryBest = score;
  writeStored(BEST_SCORE_KEY, String(score));
  return memoryBest;
}

export function loadBestLevel() {
  const raw = readStored(BEST_LEVEL_KEY);
  memoryLevel = Math.max(memoryLevel, raw === null ? 0 : Number.parseInt(raw, 10) || 0);
  return memoryLevel;
}

export function saveBestLevel(level) {
  if (level <= memoryLevel) return memoryLevel;
  memoryLevel = level;
  writeStored(BEST_LEVEL_KEY, String(level));
  return memoryLevel;
}

export function loadMutedPreference() {
  return readStored(MUTED_KEY) === '1';
}

export function saveMutedPreference(muted) {
  writeStored(MUTED_KEY, muted ? '1' : '0');
}
