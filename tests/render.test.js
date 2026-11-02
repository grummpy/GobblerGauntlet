import assert from "node:assert/strict";
import { test } from "node:test";
import { DT } from "../src/core/constants.js";
import { defaultBindings } from "../src/core/input.js";
import { createMatch, stepMatch } from "../src/core/match.js";
import { render } from "../src/ui/render.js";

const BOTS = [{ mode: "bot" }, { mode: "bot" }, { mode: "bot" }, { mode: "bot" }];

function fakeContext() {
  const gradient = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get() {
        return (...args) => {
          if (args.length === 6) return gradient;
          return gradient;
        };
      },
    },
  );
}

function viewFor(phase, match, extra = {}) {
  return {
    phase,
    menuIndex: 0,
    slots: ["bot", "bot", "bot", "bot"],
    bindings: match ? null : extra.bindings,
    settings: { volume: 0.8, muted: false, rounds: 4, bindings: extra.bindings },
    match,
    race: match?.race ?? null,
    countdown: 2.2,
    standings: [],
    usingGamepad: [false, false, false, true],
    uiTime: 1.5,
    shake: 0.2,
    particles: [{ x: 100, y: 400, life: 0.2, max: 0.35 }],
    cover: { complete: false },
    icon: { complete: false },
    controlIndex: 3,
    remap: true,
    message: "Muted",
    regions: [],
    ...extra,
  };
}

test("every screen renders without throwing", () => {
  const bindings = defaultBindings();
  const match = createMatch({ seed: 5, rounds: 1, slots: BOTS });
  const ctx = fakeContext();
  const phases = ["title", "join", "settings", "controls", "countdown", "race", "pause"];
  for (const phase of phases) {
    const view = viewFor(phase, match, { bindings });
    render(ctx, view);
    assert.ok(Array.isArray(view.regions));
  }
  for (let i = 0; i < 30; i += 1) stepMatch(match, [], DT);
  render(ctx, viewFor("race", match, { bindings }));
  while (match.phase === "racing" && match.race.time < 120) stepMatch(match, [], DT);
  render(ctx, viewFor("round", match, { bindings }));
  match.phase = "complete";
  match.winners = [0];
  const done = viewFor("match", match, { bindings });
  done.standings = [
    { id: 0, score: 5, firsts: 1, mode: "bot" },
    { id: 1, score: 3, firsts: 0, mode: "bot" },
    { id: 2, score: 0, firsts: 0, mode: "bot" },
    { id: 3, score: 0, firsts: 0, mode: "off" },
  ];
  render(ctx, done);
  assert.ok(done.regions.some((region) => region.id === "rematch"));
});
