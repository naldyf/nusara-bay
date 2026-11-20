// Keyboard and mouse. The game reads plain state every frame; actions are
// edge-triggered (pressed this frame) so E to steal and F to shoot fire once.
export const ACTION_ENTER = 'enter';
export const ACTION_SHOOT = 'shoot';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';
export const ACTION_RADIO = 'radio';
export const ACTION_NOS = 'nos';

const KEYMAP = {
  KeyE: ACTION_ENTER,
  KeyF: ACTION_SHOOT,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyM: ACTION_RADIO,
  ShiftLeft: ACTION_NOS,
  ShiftRight: ACTION_NOS,
};

export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mousePressed = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a) pressed.add(a);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Losing the window (alt-tab, click out) must not leave a key stuck down:
  // clear everything, so the car cannot drive itself when focus returns.
  window.addEventListener('blur', () => {
    keys.clear();
    pressed.clear();
    mousePressed = false;
  });
  window.addEventListener('mousedown', () => {
    mouseDown = true;
    mousePressed = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  return {
    // Held movement: -1..1 on each axis (WASD and arrows).
    axis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    handbrake() {
      return keys.has('Space');
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    mouseDown() {
      return mouseDown;
    },
    // True once, the frame the action happened.
    action(name) {
      return pressed.has(name) || (name === ACTION_SHOOT && mousePressed);
    },
    endFrame() {
      pressed.clear();
      mousePressed = false;
    },
    // Empty every held key and pending action — used on pause/resume so a
    // key held through the pause cannot stick the car in a turn.
    clear() {
      keys.clear();
      pressed.clear();
      mousePressed = false;
    },
    // Test/autopilot hook: pretend a key is held.
    fake(code, down) {
      if (down) keys.add(code);
      else keys.delete(code);
    },
    fakeAction(name) {
      pressed.add(name);
    },
  };
}
