// Keyboard and mouse, read once per frame. The world never touches the DOM: it gets
// this plain object, which is also how the screenshot autopilot steers the ship.
export const KEY_UP = ['KeyW', 'ArrowUp'];
export const KEY_DOWN = ['KeyS', 'ArrowDown'];
export const KEY_LEFT = ['KeyA', 'ArrowLeft'];
export const KEY_RIGHT = ['KeyD', 'ArrowRight'];

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    moveX: 0,
    moveY: 0,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    dash: false,
    pause: false,
    mute: false,
    confirm: false,
    choice: -1,
    anyKey: false,
  };

  function updateMove() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    state.moveX = x;
    state.moveY = y;
  }

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      pressed.add(event.code);
      state.anyKey = true;
      if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') state.dash = true;
      if (event.code === 'KeyP' || event.code === 'Escape') state.pause = true;
      if (event.code === 'KeyM') state.mute = true;
      if (event.code === 'Enter') state.confirm = true;
      if (event.code === 'Digit1') state.choice = 0;
      if (event.code === 'Digit2') state.choice = 1;
      if (event.code === 'Digit3') state.choice = 2;
    }
    keys.add(event.code);
    updateMove();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    updateMove();
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    state.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  }

  function onMouseDown(event) {
    onMouseMove(event);
    state.mouseDown = true;
    state.anyKey = true;
  }

  function onMouseUp() {
    state.mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    updateMove();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  // Edge-triggered flags are consumed by the caller once per frame.
  state.consumeEdges = function consumeEdges() {
    const edges = { dash: state.dash, pause: state.pause, mute: state.mute, confirm: state.confirm, choice: state.choice };
    state.dash = false;
    state.pause = false;
    state.mute = false;
    state.confirm = false;
    state.choice = -1;
    return edges;
  };

  state.setMove = function setMove(x, y) {
    state.moveX = x;
    state.moveY = y;
  };

  state.setMouse = function setMouse(x, y) {
    state.mouseX = x;
    state.mouseY = y;
  };

  return state;
}
