// Saving: one localStorage slot. Cash, the job reached, and which jobs are
// done. Loading a save restores the same numbers the title screen shows.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: G.cash,
        jobIndex: G.missions.jobIndex,
        jobsDone: G.jobsDone,
        health: G.health,
        savedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.jobIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
