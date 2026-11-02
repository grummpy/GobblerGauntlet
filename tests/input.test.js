import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultBindings,
  keyLabel,
  mapPlayers,
  sanitizeBindings,
} from "../src/core/input.js";

function map(keys, pads, bindings) {
  return mapPlayers({ keys, pads, bindings });
}

test("default keyboard layout matches the four-player split", () => {
  const bindings = defaultBindings();
  assert.deepEqual(bindings[0], {
    left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "KeyF", secondary: "KeyG",
  });
  assert.deepEqual(bindings[1], {
    left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Slash", secondary: "Period",
  });
  assert.deepEqual(bindings[2], {
    left: "KeyJ", right: "KeyL", up: "KeyI", down: "KeyK", action: "Semicolon", secondary: "Quote",
  });
  assert.deepEqual(bindings[3], {
    left: "Numpad4", right: "Numpad6", up: "Numpad8", down: "Numpad5", action: "Numpad0", secondary: "NumpadEnter",
  });
});

test("each keyboard drives only its player", () => {
  const keys = new Set(["KeyW", "KeyA", "KeyF", "KeyG", "ArrowUp", "Slash", "KeyL", "Quote", "Numpad8", "NumpadEnter"]);
  const actions = map(keys);
  assert.deepEqual(
    actions.map((item) => [item.up, item.left, item.right, item.action, item.secondary, item.usingGamepad]),
    [
      [true, true, false, true, true, false],
      [true, false, false, true, false, false],
      [false, false, true, false, true, false],
      [true, false, false, false, true, false],
    ],
  );
});

test("connected gamepad overrides that player's keyboard", () => {
  const keys = new Set(["KeyF", "KeyW", "KeyD"]);
  const pads = [
    { connected: true, axes: [0, 0], buttons: [false, true, false, false, false, false, false, false, false, true] },
  ];
  const actions = map(keys, pads);
  assert.equal(actions[0].usingGamepad, true);
  assert.equal(actions[0].action, false);
  assert.equal(actions[0].secondary, true);
  assert.equal(actions[0].up, false);
  assert.equal(actions[0].pause, true);
  assert.equal(actions[0].right, false);
});

test("unplugging the pad falls back to the keyboard", () => {
  const keys = new Set(["KeyF", "KeyA"]);
  const connected = map(keys, [{ connected: true, axes: [1, 0], buttons: [] }]);
  assert.equal(connected[0].usingGamepad, true);
  assert.equal(connected[0].right, true);
  assert.equal(connected[0].action, false);
  const loose = map(keys, [{ connected: false, axes: [1, 0], buttons: [true] }]);
  assert.equal(loose[0].usingGamepad, false);
  assert.equal(loose[0].action, true);
  assert.equal(loose[0].left, true);
  assert.equal(loose[0].right, false);
});

test("stick deadzone, d-pad, and button objects", () => {
  const quiet = map([], [{ connected: true, axes: [0.2, -0.2], buttons: [] }]);
  assert.equal(quiet[0].left || quiet[0].right || quiet[0].up || quiet[0].down, false);
  const stick = map([], [{ connected: true, axes: [-0.8, 0.9], buttons: [] }]);
  assert.equal(stick[0].left, true);
  assert.equal(stick[0].down, true);
  assert.equal(stick[0].up, false);
  const dpad = map([], [{
    connected: true,
    axes: [0, 0],
    buttons: { 12: { pressed: true, value: 1 }, 15: { pressed: true, value: 1 }, 0: { pressed: true, value: 1 } },
  }]);
  assert.equal(dpad[0].up, true);
  assert.equal(dpad[0].right, true);
  assert.equal(dpad[0].action, true);
});

test("remapped bindings replace the defaults", () => {
  const bindings = defaultBindings();
  bindings[0] = { ...bindings[0], action: "KeyZ", secondary: "KeyX" };
  const actions = map(new Set(["KeyF", "KeyZ"]), [], bindings);
  assert.equal(actions[0].action, true);
  const onlyOld = map(new Set(["KeyF"]), [], bindings);
  assert.equal(onlyOld[0].action, false);
});

test("broken saved bindings fall back per field", () => {
  const sanitized = sanitizeBindings([
    { left: "KeyQ", up: "", action: 12 },
    null,
    { left: "Digit1", right: "Digit2", up: "Digit3", down: "Digit4", action: "Digit5", secondary: "Digit6" },
  ]);
  assert.equal(sanitized[0].left, "KeyQ");
  assert.equal(sanitized[0].up, "KeyW");
  assert.equal(sanitized[0].action, "KeyF");
  assert.equal(sanitized[1].left, "ArrowLeft");
  assert.equal(sanitized[2].action, "Digit5");
  assert.equal(sanitized.length, 4);
  assert.equal(keyLabel("Quote"), "'");
  assert.equal(keyLabel("Numpad8"), "Num 8");
});
