import assert from "node:assert/strict";
import { test } from "node:test";
import { DT, PLACE_POINTS } from "../src/core/constants.js";
import { blankCourse } from "../src/core/course.js";
import {
  acknowledgeRace,
  computeWinners,
  createMatch,
  standings,
  stepMatch,
} from "../src/core/match.js";
import { createRace, runRace } from "../src/core/race.js";

const BOTS = [{ mode: "bot" }, { mode: "bot" }, { mode: "bot" }, { mode: "bot" }];

test("most points wins and race wins break a points tie", () => {
  const match = {
    slots: [{ mode: "human" }, { mode: "human" }, { mode: "bot" }, { mode: "off" }],
    scores: [8, 8, 5, 99],
    firsts: [0, 2, 1, 0],
  };
  assert.deepEqual(computeWinners(match), [1]);
  const shared = {
    slots: [{ mode: "bot" }, { mode: "bot" }, { mode: "bot" }, { mode: "bot" }],
    scores: [5, 5, 3, 1],
    firsts: [1, 1, 0, 0],
  };
  assert.deepEqual(computeWinners(shared), [0, 1]);
  const rows = standings(shared);
  assert.deepEqual(rows.map((row) => row.id), [0, 1, 2, 3]);
});

test("a short race awards finish places and leaves the eliminated on zero", () => {
  const slots = [{ mode: "human" }, { mode: "human" }, { mode: "human" }, { mode: "human" }];
  const match = createMatch({ seed: 3, rounds: 2, slots });
  match.race = createRace(blankCourse(1000), slots, { startY: 200 });
  match.phase = "racing";
  match.race.players[0].y = 980;
  match.race.players[1].y = 760;
  match.race.players[2].y = 520;
  match.race.players[3].y = 20;
  match.race.cameraBottom = 400;
  const sprint = { up: true, left: false, right: false, down: false, action: false, secondary: false };
  runRace(match.race, () => [sprint, sprint, sprint, sprint]);
  match.race.phase = "done";
  stepMatch(match, [], DT);
  assert.equal(match.phase, "between");
  assert.equal(match.scores[0], PLACE_POINTS[1]);
  assert.equal(match.scores[1], PLACE_POINTS[2]);
  assert.equal(match.scores[2], PLACE_POINTS[3]);
  assert.equal(match.scores[3], 0);
  assert.equal(match.history.length, 1);
  const next = acknowledgeRace(match);
  assert.equal(next, "racing");
  assert.equal(match.roundIndex, 1);
  assert.notEqual(match.race.course.seed, 0);
});

test("four bot races complete a match and crown the high score", () => {
  const match = createMatch({ seed: 11, rounds: 4, slots: BOTS });
  const seeds = [];
  for (let round = 0; round < 4; round += 1) {
    seeds.push(match.race.course.seed);
    runRace(match.race);
    assert.equal(match.race.phase, "done");
    assert.ok(match.race.time > 55 && match.race.time < 95, `round ${round} time ${match.race.time}`);
    stepMatch(match, [], DT);
    const status = acknowledgeRace(match);
    assert.equal(status, round === 3 ? "complete" : "racing");
  }
  assert.equal(new Set(seeds).size, 4);
  assert.equal(match.history.length, 4);
  assert.equal(match.phase, "complete");
  const best = Math.max(...match.scores);
  assert.ok(best > 0);
  for (const id of match.winners) assert.equal(match.scores[id], best);
  const purse = match.history.reduce((sum, places) => {
    return sum + places.reduce((inner, row) => inner + (PLACE_POINTS[row.place] || 0), 0);
  }, 0);
  assert.equal(match.scores.reduce((sum, score) => sum + score, 0), purse);
});
