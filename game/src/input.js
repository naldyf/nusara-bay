// Keyboard and mouse. Movement is plain held state, read every frame;
// actions are edge-triggered — pressed this frame only — so E to steal and
// F to shoot fire once per press instead of once per frame.
export const ACTION_ENTER = 'enter';
export const ACTION_SHOOT = 'shoot';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';
export const ACTION_RADIO = 'radio';
export const ACTION_NOS = 'nos';

const KEY_TO_ACTION = {
  KeyE: ACTION_ENTER,
  KeyF: ACTION_SHOOT,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyM: ACTION_RADIO,
  ShiftLeft: ACTION_NOS,
  ShiftRight: ACTION_NOS,
};

const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export function createInput() {
  const held = new Set();
  const fresh = new Set();
  let mouseHeld = false;
  let mouseFresh = false;

  function press(e) {
    if (e.repeat) return;
    held.add(e.code);
    const mapped = KEY_TO_ACTION[e.code];
    if (mapped) fresh.add(mapped);
    if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
  }
  function release(e) {
    held.delete(e.code);
  }
  function clearAll() {
    held.clear();
    fresh.clear();
    mouseFresh = false;
  }
  window.addEventListener('keydown', press);
  window.addEventListener('keyup', release);
  // Alt-tabbing away must not leave a key stuck: clear everything on blur,
  // so the car cannot drive itself when focus comes back.
  window.addEventListener('blur', clearAll);
  window.addEventListener('mousedown', () => {
    mouseHeld = true;
    mouseFresh = true;
  });
  window.addEventListener('mouseup', () => {
    mouseHeld = false;
  });

  function down(code) {
    return held.has(code);
  }

  return {
    // Held movement, -1..1 on each axis (WASD and arrows).
    axis() {
      const x = (down('KeyD') || down('ArrowRight') ? 1 : 0) - (down('KeyA') || down('ArrowLeft') ? 1 : 0);
      const y = (down('KeyW') || down('ArrowUp') ? 1 : 0) - (down('KeyS') || down('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    handbrake() {
      return down('Space');
    },
    run() {
      return down('ShiftLeft') || down('ShiftRight');
    },
    mouseDown() {
      return mouseHeld;
    },
    // True once, on the frame the action happened. A click counts as shoot.
    action(name) {
      return fresh.has(name) || (name === ACTION_SHOOT && mouseFresh);
    },
    endFrame() {
      fresh.clear();
      mouseFresh = false;
    },
    // Drop every held key and pending action — used around pause/resume so
    // a key held through the pause cannot stick the car in a turn.
    clear() {
      clearAll();
    },
    // Staging hook: pretend a key is held down.
    fake(code, isDown) {
      if (isDown) held.add(code);
      else held.delete(code);
    },
    fakeAction(name) {
      fresh.add(name);
    },
  };
}
