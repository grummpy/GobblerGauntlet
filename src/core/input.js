/** Keyboard and gamepad state to per-player actions. No DOM. */

export const DEADZONE = 0.35;

const FIELDS = ["left", "right", "up", "down", "action", "secondary"];

export function defaultBindings() {
  return [
    { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "KeyF", secondary: "KeyG" },
    { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Slash", secondary: "Period" },
    { left: "KeyJ", right: "KeyL", up: "KeyI", down: "KeyK", action: "Semicolon", secondary: "Quote" },
    { left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5", action: "Numpad0", secondary: "NumpadEnter" },
  ];
}

export function blankActions() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
    pause: false,
    usingGamepad: false,
  };
}

export function sanitizeBindings(input) {
  const defaults = defaultBindings();
  if (!Array.isArray(input)) return defaults;
  return defaults.map((def, i) => {
    const src = input[i] && typeof input[i] === "object" ? input[i] : {};
    const out = {};
    for (const key of FIELDS) {
      const value = src[key];
      out[key] = typeof value === "string" && value.length > 0 && value.length < 32 ? value : def[key];
    }
    return out;
  });
}

function buttonDown(pad, index) {
  if (!pad || !pad.buttons) return false;
  const button = pad.buttons[index];
  if (typeof button === "boolean") return button;
  if (button && typeof button === "object") return !!(button.pressed || button.value > 0.5);
  return false;
}

/**
 * @param {{ keys?: Set<string> | string[], pads?: Array<{connected?: boolean, axes?: number[], buttons?: unknown[]} | null>, bindings?: object[] }} state
 */
export function mapPlayers(state) {
  const source = state?.keys;
  const keys = source instanceof Set ? source : new Set(source || []);
  const bindings = sanitizeBindings(state?.bindings);
  const pads = state?.pads || [];
  const actions = [];
  for (let i = 0; i < 4; i += 1) {
    const pad = pads[i];
    if (pad && pad.connected) {
      const axes = pad.axes || [];
      const x = Number(axes[0]) || 0;
      const y = Number(axes[1]) || 0;
      actions.push({
        left: x < -DEADZONE || buttonDown(pad, 14),
        right: x > DEADZONE || buttonDown(pad, 15),
        up: y < -DEADZONE || buttonDown(pad, 12),
        down: y > DEADZONE || buttonDown(pad, 13),
        action: buttonDown(pad, 0),
        secondary: buttonDown(pad, 1),
        pause: buttonDown(pad, 9),
        usingGamepad: true,
      });
    } else {
      const bind = bindings[i];
      actions.push({
        left: keys.has(bind.left),
        right: keys.has(bind.right),
        up: keys.has(bind.up),
        down: keys.has(bind.down),
        action: keys.has(bind.action),
        secondary: keys.has(bind.secondary),
        pause: false,
        usingGamepad: false,
      });
    }
  }
  return actions;
}

export function keyLabel(code) {
  const named = {
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down",
    Slash: "/",
    Period: ".",
    Semicolon: ";",
    Quote: "'",
    NumpadEnter: "Num Enter",
    Space: "Space",
    Enter: "Enter",
    Escape: "Esc",
    Tab: "Tab",
  };
  if (named[code]) return named[code];
  if (typeof code !== "string") return "?";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}
