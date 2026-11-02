import {
  LANE_WIDTH,
  TRACK_WIDTH,
  TURKEY_RADIUS,
} from "./constants.js";
import { createRng, randomInt } from "./rng.js";

const LANE_SETS = [
  [0, 1, 2, 3],
  [0, 1, 2, 3],
  [0, 1, 2, 3],
  [0, 1, 2],
  [1, 2, 3],
  [0, 1, 2],
  [1, 2, 3],
  [1, 2],
  [0, 1],
  [2, 3],
];

const TYPE_WEIGHTS = [
  ["hay", 5],
  ["fence", 4],
  ["mud", 4],
  ["corn", 3],
  ["tractor", 2],
];

function pickWeighted(rng) {
  let total = 0;
  for (const pair of TYPE_WEIGHTS) total += pair[1];
  let roll = rng() * total;
  for (const [type, weight] of TYPE_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "hay";
}

export function segmentAt(course, y) {
  const segments = course.segments;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (y >= segment.y0 && y < segment.y1) return segment;
  }
  return segments[segments.length - 1];
}

export function boundsAt(course, y) {
  const lanes = segmentAt(course, y).lanes;
  const minLane = Math.min(...lanes);
  const maxLane = Math.max(...lanes);
  return {
    lanes,
    minX: minLane * LANE_WIDTH + TURKEY_RADIUS,
    maxX: (maxLane + 1) * LANE_WIDTH - TURKEY_RADIUS,
  };
}

export function tractorCenterX(obstacle, time) {
  const span = Math.max(1, TRACK_WIDTH - obstacle.w);
  const cycle = (span * 2) / obstacle.speed;
  let t = (time + obstacle.offset) % cycle;
  if (t < 0) t += cycle;
  const dist = t * obstacle.speed;
  const along = dist <= span ? dist : span - (dist - span);
  return along + obstacle.w / 2;
}

/** Offset that puts a tractor at `x` while it is still traveling right. */
export function offsetForTractorX(obstacle, x) {
  const span = Math.max(1, TRACK_WIDTH - obstacle.w);
  const left = Math.max(0, Math.min(span, x - obstacle.w / 2));
  return left / obstacle.speed;
}

export function blankCourse(finishY = 20000, lanes = [0, 1, 2, 3]) {
  return {
    seed: 0,
    finishY,
    segments: [{ y0: 0, y1: finishY + 1000, lanes: lanes.slice() }],
    obstacles: [],
  };
}

function placeObstacles(rng, obstacles, y0, y1, lanes) {
  const span = y1 - y0;
  const count = span < 420 ? 1 : 1 + Math.floor(rng() * 3);
  let cursor = y0 + 100;
  for (let n = 0; n < count; n += 1) {
    if (cursor > y1 - 70) break;
    const type = pickWeighted(rng);
    const y = cursor;
    cursor += 250 + Math.floor(rng() * 170);
    if (type === "tractor") {
      const nearSolid = obstacles.some(
        (item) => Math.abs(item.y - y) < 180 && (item.type === "hay" || item.type === "fence" || item.type === "tractor"),
      );
      if (nearSolid) continue;
      obstacles.push({
        id: obstacles.length + 1,
        type,
        y,
        w: 86,
        h: 50,
        speed: 100 + rng() * 70,
        offset: rng() * 4,
      });
      continue;
    }
    const lane = lanes[Math.floor(rng() * lanes.length)];
    const crowded = obstacles.some((item) => {
      if (Math.abs(item.y - y) >= 180) return false;
      if (item.type === "tractor") return true;
      return item.lane === lane;
    });
    if (crowded) continue;
    const obstacle = { id: obstacles.length + 1, type, lane, y };
    if (type === "mud") obstacle.h = 150;
    else if (type === "fence") obstacle.h = 34;
    else if (type === "corn") obstacle.h = 40;
    else obstacle.h = 56;
    obstacles.push(obstacle);
  }
}

export function generateCourse(seed) {
  const rng = createRng(seed >>> 0);
  const finishY = 22000 + randomInt(rng, 0, 2000);
  const segments = [];
  const obstacles = [];
  const intro = 900;
  const finale = 1500;
  segments.push({ y0: 0, y1: intro, lanes: [0, 1, 2, 3] });
  let y = intro;
  let guard = 0;
  while (y < finishY - finale && guard < 80) {
    guard += 1;
    const len = 540 + randomInt(rng, 0, 460);
    const y1 = Math.min(y + len, finishY - finale);
    const lanes = LANE_SETS[Math.floor(rng() * LANE_SETS.length)].slice();
    segments.push({ y0: y, y1, lanes });
    placeObstacles(rng, obstacles, y, y1, lanes);
    y = y1;
  }
  segments.push({ y0: y, y1: finishY + 900, lanes: [0, 1, 2, 3] });
  return { seed: seed >>> 0, finishY, segments, obstacles };
}
