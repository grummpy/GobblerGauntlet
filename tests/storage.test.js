import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSettings, saveSettings } from "../src/ui/storage.js";

function memory() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

test("settings round-trip through storage and reject bad values", () => {
  const store = memory();
  assert.equal(loadSettings(store).rounds, 4);
  assert.equal(loadSettings(store).volume, 0.8);
  saveSettings({ volume: 2, muted: true, rounds: 99, bindings: null }, store);
  const loaded = loadSettings(store);
  assert.equal(loaded.volume, 1);
  assert.equal(loaded.muted, true);
  assert.equal(loaded.rounds, 8);
  assert.equal(loaded.bindings[0].action, "KeyF");
  store.setItem("gobbler-gauntlet-settings-v1", "{");
  assert.equal(loadSettings(store).rounds, 4);
});
