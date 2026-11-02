import assert from "node:assert/strict";
import { test } from "node:test";
import { decideBot } from "../src/core/bot.js";
import { DASH_COOLDOWN, DT, PLACE_POINTS, laneCenter } from "../src/core/constants.js";
import { blankCourse, generateCourse, offsetForTractorX } from "../src/core/course.js";
import { createRace, runRace, stepRace } from "../src/core/race.js";

const HUMANS = [{ mode: "human" }, { mode: "human" }, { mode: "human" }, { mode: "human" }];
const BOTS = [{ mode: "bot" }, { mode: "bot" }, { mode: "bot" }, { mode: "bot" }];

function hold(partial = {}) {
  return { left: false, right: false, up: false, down: false, action: false, secondary: false, ...partial };
}

function frames(seconds) {
  return Math.round(seconds / DT);
}

function drive(race, partial, seconds) {
  const input = hold(partial);
  const events = [];
  for (let i = 0; i < frames(seconds); i += 1) {
    stepRace(race, [input, input, input, input], DT);
    events.push(...race.events);
  }
  return events;
}

test("strafe, sprint, and jump move a turkey", () => {
  const race = createRace(blankCourse(8000), HUMANS, { startY: 400 });
  const startX = race.players[0].x;
  drive(race, { right: true, up: true, action: true }, 0.2);
  assert.ok(race.players[0].x > startX + 40);
  assert.ok(race.players[0].z > 40);
  assert.ok(race.players[0].y > 400);
  drive(race, { up: true }, 1);
  assert.equal(race.players[0].z, 0);
});

test("hay stops a runner and a jump clears it", () => {
  const blocked = createRace(blankCourse(5000), HUMANS, { startY: 700 });
  blocked.course.obstacles.push({ id: 1, type: "hay", lane: 0, y: 800, h: 56 });
  blocked.players[0].x = laneCenter(0);
  const hits = drive(blocked, { up: true }, 1);
  assert.ok(blocked.players[0].y < 780);
  assert.ok(blocked.players[0].y > 720);
  assert.ok(hits.some((event) => event.type === "hit" && event.kind === "hay"));

  const jumped = createRace(blankCourse(5000), HUMANS, { startY: 700 });
  jumped.course.obstacles.push({ id: 1, type: "hay", lane: 0, y: 800, h: 56 });
  jumped.players[0].x = laneCenter(0);
  drive(jumped, { up: true, action: true }, 1);
  assert.ok(jumped.players[0].y > 860, `y=${jumped.players[0].y}`);
  assert.equal(jumped.players[0].state, "racing");
});

test("fence is a taller jump and mud cuts speed", () => {
  const fence = createRace(blankCourse(5000), HUMANS, { startY: 700 });
  fence.course.obstacles.push({ id: 2, type: "fence", lane: 1, y: 800, h: 34 });
  fence.players[1].x = laneCenter(1);
  drive(fence, { up: true }, 1);
  assert.ok(fence.players[1].y < 790);

  const muddy = createRace(blankCourse(8000), HUMANS, { startY: 600 });
  muddy.course.obstacles.push({ id: 3, type: "mud", lane: 0, y: 1600, h: 2200 });
  muddy.players[0].x = laneCenter(0);
  const clean = createRace(blankCourse(8000), HUMANS, { startY: 600 });
  clean.players[0].x = laneCenter(0);
  drive(muddy, { up: true }, 1);
  drive(clean, { up: true }, 1);
  const mudDistance = muddy.players[0].y - 600;
  const cleanDistance = clean.players[0].y - 600;
  assert.ok(mudDistance < cleanDistance * 0.75, `${mudDistance} vs ${cleanDistance}`);
  assert.equal(muddy.players[0].inMud, true);
});

test("corn boosts and a tractor stuns unless you are above it", () => {
  const fed = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  fed.course.obstacles.push({ id: 4, type: "corn", lane: 0, y: 500, h: 40 });
  fed.players[0].x = laneCenter(0);
  const events = drive(fed, { up: true }, 0.05);
  assert.ok(fed.players[0].boostTimer > 2);
  assert.ok(events.some((event) => event.type === "corn"));

  const boosted = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  boosted.players[0].boostTimer = 2;
  boosted.players[0].x = laneCenter(0);
  const plain = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  plain.players[0].x = laneCenter(0);
  drive(boosted, { up: true }, 0.5);
  drive(plain, { up: true }, 0.5);
  assert.ok(boosted.players[0].y - 500 > (plain.players[0].y - 500) * 1.2);

  const tractor = { id: 9, type: "tractor", y: 500, w: 86, h: 50, speed: 100, offset: 0 };
  tractor.offset = offsetForTractorX(tractor, laneCenter(1));
  const stunned = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  stunned.course.obstacles.push(tractor);
  stunned.players[1].x = laneCenter(1);
  stunned.players[1].y = 500;
  const stunEvents = drive(stunned, { up: true }, 0.05);
  assert.ok(stunned.players[1].stunTimer > 1);
  assert.ok(stunEvents.some((event) => event.type === "stun"));

  const soaring = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  soaring.course.obstacles.push({ ...tractor, id: 10 });
  soaring.players[1].x = laneCenter(1);
  soaring.players[1].y = 500;
  soaring.players[1].z = 170;
  drive(soaring, { up: true }, 0.05);
  assert.equal(soaring.players[1].stunTimer, 0);
});

test("flap-dash bumps a rival sideways and then waits out a 3s cooldown", () => {
  const race = createRace(blankCourse(8000), HUMANS, { startY: 500 });
  race.players[0].x = 250;
  race.players[0].y = 500;
  race.players[1].x = 270;
  race.players[1].y = 500;
  const before = race.players[1].x;
  let dashes = 0;
  const press = hold({ up: true, secondary: true });
  const release = hold({ up: true });
  stepRace(race, [press, release, release, release], DT);
  dashes += race.events.filter((event) => event.type === "dash" && event.playerId === 0).length;
  assert.equal(dashes, 1);
  assert.ok(race.players[1].x > before + 40, `bumped to ${race.players[1].x}`);
  assert.ok(Math.abs(race.players[0].dashCooldown - DASH_COOLDOWN) < 0.02);
  for (let i = 0; i < frames(2.9); i += 1) {
    stepRace(race, [press, release, release, release], DT);
    dashes += race.events.filter((event) => event.type === "dash" && event.playerId === 0).length;
  }
  assert.equal(dashes, 1);
  while (race.players[0].dashCooldown > 0) {
    stepRace(race, [release, release, release, release], DT);
  }
  stepRace(race, [press, release, release, release], DT);
  assert.equal(race.events.some((event) => event.type === "dash" && event.playerId === 0), true);
  assert.ok(race.time > 2.95 && race.time < 3.2, `second dash at ${race.time}`);
});

test("falling behind the camera eliminates, finish order pays the purse", () => {
  const course = blankCourse(1000);
  const race = createRace(course, HUMANS, { startY: 200, cameraBottom: 0 });
  race.players[0].y = 980;
  race.players[0].x = laneCenter(0);
  race.players[1].y = 760;
  race.players[1].x = laneCenter(1);
  race.players[2].y = 520;
  race.players[2].x = laneCenter(2);
  race.players[3].y = 20;
  race.players[3].x = laneCenter(3);
  race.cameraBottom = 400;
  const sprint = hold({ up: true });
  runRace(race, () => [sprint, sprint, sprint, sprint], DT, 4000);
  assert.equal(race.phase, "done");
  assert.equal(race.players[0].finishPlace, 1);
  assert.equal(race.players[1].finishPlace, 2);
  assert.equal(race.players[2].finishPlace, 3);
  assert.equal(race.players[3].state, "eliminated");
  assert.equal(race.players[3].finishPlace, 0);
  const purse = race.players.reduce((sum, player) => sum + (PLACE_POINTS[player.finishPlace] || 0), 0);
  assert.equal(purse, 5 + 3 + 2);
});

test("a lane merge pushes a turkey out of a closed lane", () => {
  const course = blankCourse(4000, [1, 2]);
  const race = createRace(course, HUMANS, { startY: 400 });
  race.players[0].x = laneCenter(0);
  drive(race, { up: true }, 1);
  assert.ok(race.players[0].x > laneCenter(0) + 40);
});

test("bots jump hay, dodge the tractor, and replay a seeded race", () => {
  const hayCourse = blankCourse(4000);
  hayCourse.obstacles.push({ id: 1, type: "hay", lane: 0, y: 560, h: 56 });
  const hayRace = createRace(hayCourse, BOTS, { startY: 480 });
  const hayBot = decideBot(hayRace.players[0], hayRace);
  assert.equal(hayBot.up, true);
  assert.equal(hayBot.action, true);

  const tractor = { id: 2, type: "tractor", y: 620, w: 86, h: 50, speed: 80, offset: 0 };
  tractor.offset = offsetForTractorX(tractor, laneCenter(0));
  const dodgeCourse = blankCourse(4000);
  dodgeCourse.obstacles.push(tractor);
  const dodgeRace = createRace(dodgeCourse, BOTS, { startY: 480 });
  dodgeRace.players[0].x = laneCenter(0);
  const dodge = decideBot(dodgeRace.players[0], dodgeRace);
  assert.equal(dodge.left || dodge.right, true);

  const first = createRace(generateCourse(4), BOTS);
  const second = createRace(generateCourse(4), BOTS);
  runRace(first);
  runRace(second);
  assert.equal(first.phase, "done");
  assert.equal(first.time, second.time);
  assert.deepEqual(
    first.players.map((player) => [player.state, player.finishPlace, Math.round(player.y)]),
    second.players.map((player) => [player.state, player.finishPlace, Math.round(player.y)]),
  );
  assert.ok(first.time > 55 && first.time < 95, `race time ${first.time}`);
  assert.ok(first.players.some((player) => player.finishPlace === 1));
});
