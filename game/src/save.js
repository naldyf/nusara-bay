// One localStorage slot holds the whole campaign: cash, which job Dara
// reached, how many are done, and health. A save that names a job that
// does not exist is refused, so a corrupt or future save starts fresh
// instead of starting a job the game never had.
import { SAVE_KEY } from './config.js';

// Read the raw slot, tolerating a missing key and a storage error alike.
function readSlot() {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function writeSlot(text) {
  try {
    window.localStorage.setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

// A save is valid when it names numbers for cash and jobIndex, and the job
// index is one of the eight jobs. Anything else is treated as no save.
function parseSave(raw) {
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data.cash !== 'number' || typeof data.jobIndex !== 'number') return null;
  if (!Number.isInteger(data.jobIndex) || data.jobIndex < 0 || data.jobIndex > 7) return null;
  return data;
}

export function saveGame(G) {
  const record = {
    cash: G.cash,
    jobIndex: G.missions.jobIndex,
    jobsDone: G.jobsDone,
    health: G.health,
    savedAt: Date.now(),
  };
  return writeSlot(JSON.stringify(record));
}

export function loadGame() {
  return parseSave(readSlot());
}

export function hasSave() {
  return loadGame() !== null;
}
