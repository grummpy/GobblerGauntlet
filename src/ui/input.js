/** DOM keyboard and Gamepad API polling. Hot-plug is just the next poll. */

const BLOCKED = /^(Arrow|Key|Digit|Numpad|Slash|Period|Semicolon|Quote|Enter|Escape|Space|Tab|Backquote|Minus|Equal|Bracket|Comma|Backslash)/;

export function createInput(target) {
  const keys = new Set();
  const just = new Set();

  function down(event) {
    if (event.repeat) return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey && BLOCKED.test(event.code)) event.preventDefault();
    keys.add(event.code);
    just.add(event.code);
  }

  function up(event) {
    keys.delete(event.code);
  }

  function blur() {
    keys.clear();
  }

  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  target.addEventListener("contextmenu", (event) => event.preventDefault());

  return {
    keys,
    consumeJust() {
      const copy = new Set(just);
      just.clear();
      return copy;
    },
    pads() {
      const source = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
      const pads = [];
      for (let i = 0; i < 4; i += 1) {
        const pad = source && source[i];
        if (!pad || !pad.connected) {
          pads.push({ connected: false, axes: [0, 0], buttons: [] });
          continue;
        }
        pads.push({
          connected: true,
          axes: [pad.axes[0] || 0, pad.axes[1] || 0, pad.axes[2] || 0, pad.axes[3] || 0],
          buttons: Array.from({ length: 16 }, (_, index) => {
            const button = pad.buttons[index];
            return !!(button && (button.pressed || button.value > 0.5));
          }),
        });
      }
      return pads;
    },
  };
}
