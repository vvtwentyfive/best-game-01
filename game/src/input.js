// Keyboard + mouse input. Keys are polled each frame; clicks and presses are
// queued as one-shot actions the state machine consumes.
export const ACTION_START = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_DASH = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 300;
  let mouseDown = false;
  let clickX = -1;
  let clickY = -1;
  let clickQueued = false;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') actions |= ACTION_START;
    if (key === 'escape' || key === 'p') actions |= ACTION_PAUSE;
    if (key === 'm') actions |= ACTION_MUTE;
    if (key === 'r') actions |= ACTION_RESTART;
    if (key === 'shift') actions |= ACTION_DASH;
  }
  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }
  function onMouseMove(event) {
    const p = canvasPoint(event);
    mouseX = p.x;
    mouseY = p.y;
  }
  function onMouseDown(event) {
    const p = canvasPoint(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    clickX = p.x;
    clickY = p.y;
    clickQueued = true;
    if (event.button === 2) actions |= ACTION_DASH;
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    isFiring() {
      return mouseDown || keys.has(' ');
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      if (!clickQueued) return null;
      clickQueued = false;
      return { x: clickX, y: clickY };
    },
    numberPressed() {
      if (keys.has('1')) return 1;
      if (keys.has('2')) return 2;
      if (keys.has('3')) return 3;
      if (keys.has('4')) return 4;
      return 0;
    },
    consumeNumber() {
      keys.delete('1');
      keys.delete('2');
      keys.delete('3');
      keys.delete('4');
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
