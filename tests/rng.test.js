import assert from "node:assert/strict";
import { test } from "node:test";
import { createRng, mixSeed } from "../src/core/rng.js";

test("same seed replays the same stream", () => {
  const a = createRng(123456);
  const b = createRng(123456);
  const left = [a(), a(), a(), a(), a()];
  const right = [b(), b(), b(), b(), b()];
  assert.deepEqual(left, right);
  for (const value of left) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("different seeds diverge", () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notEqual(a(), b());
});

test("known mulberry32 first value for seed 1", () => {
  const rng = createRng(1);
  const first = rng();
  assert.equal(first, 0.6270739405881613);
});

test("mixSeed is stable and changes with the round", () => {
  assert.equal(mixSeed(42, 0), mixSeed(42, 0));
  assert.notEqual(mixSeed(42, 0), mixSeed(42, 1));
  assert.equal(mixSeed(42, 3) >>> 0, mixSeed(42, 3));
});
