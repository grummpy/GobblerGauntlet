import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCourse, segmentAt } from "../src/core/course.js";

function typesOf(course) {
  return new Set(course.obstacles.map((item) => item.type));
}

test("courses are deterministic and seed-dependent", () => {
  const a = generateCourse(7);
  const b = generateCourse(7);
  const c = generateCourse(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.obstacles, c.obstacles);
  assert.equal(a.seed, 7);
});

test("every course is a covered farm with merges, a barn, and open lanes", () => {
  const seen = new Set();
  let merges = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const course = generateCourse(seed);
    assert.ok(course.finishY >= 22000 && course.finishY <= 24000);
    let y = 0;
    for (const segment of course.segments) {
      assert.equal(segment.y0, y);
      assert.ok(segment.y1 > segment.y0);
      assert.ok(segment.lanes.length >= 1);
      const sorted = segment.lanes.slice().sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i += 1) assert.equal(sorted[i], sorted[i - 1] + 1);
      if (segment.lanes.length < 4) merges += 1;
      y = segment.y1;
    }
    assert.ok(y > course.finishY);
    assert.deepEqual(course.segments[0].lanes, [0, 1, 2, 3]);
    assert.deepEqual(course.segments[course.segments.length - 1].lanes, [0, 1, 2, 3]);
    for (const obstacle of course.obstacles) {
      seen.add(obstacle.type);
      assert.ok(obstacle.y > 900 && obstacle.y < course.finishY - 1400);
      if (obstacle.type === "tractor") {
        assert.ok(obstacle.speed > 0);
        continue;
      }
      const segment = segmentAt(course, obstacle.y);
      assert.ok(segment.lanes.includes(obstacle.lane));
    }
  }
  assert.ok(merges > 0);
  for (const type of ["hay", "fence", "mud", "corn", "tractor"]) {
    assert.ok(seen.has(type), type);
  }
});
