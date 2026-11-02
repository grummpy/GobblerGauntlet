import { laneCenter, laneIndexAt, SPRINT_SPEED } from "./constants.js";
import { boundsAt, segmentAt, tractorCenterX } from "./course.js";

function blank() {
  return { left: false, right: false, up: true, down: false, action: false, secondary: false };
}

function inLane(x, lane) {
  return laneIndexAt(x) === lane && Math.abs(x - laneCenter(lane)) < 78;
}

function obstacleAhead(player, obstacle) {
  return obstacle.y >= player.y - 16 && obstacle.y - player.y < 240;
}

/**
 * Deterministic lookahead. Bots sprint, hop hay and fences, dodge tractors,
 * sip corn, and flap-dash when a rival is alongside or the camera is close.
 */
export function decideBot(player, race) {
  const input = blank();
  if (!player || player.state !== "racing") {
    input.up = false;
    return input;
  }
  const speed = Math.max(player.vy || 0, SPRINT_SPEED);
  const lane = laneIndexAt(player.x);
  let threat = null;
  let corn = null;
  for (const obstacle of race.course.obstacles) {
    if (!obstacleAhead(player, obstacle)) continue;
    if (obstacle.type === "tractor") {
      const eta = Math.max(0, (obstacle.y - player.y) / speed);
      const futureX = tractorCenterX(obstacle, race.time + eta);
      if (Math.abs(futureX - player.x) < 78 && (!threat || obstacle.y < threat.y)) {
        threat = obstacle;
      }
      continue;
    }
    if (!inLane(player.x, obstacle.lane) && lane !== obstacle.lane) continue;
    if (obstacle.type === "corn") {
      if (!corn || obstacle.y < corn.y) corn = obstacle;
      continue;
    }
    if (obstacle.type === "hay" || obstacle.type === "fence" || obstacle.type === "mud") {
      if (!threat || obstacle.y < threat.y) threat = obstacle;
    }
  }

  const open = segmentAt(race.course, player.y + 120).lanes;
  const steerTo = (nextLane) => {
    if (!open.includes(nextLane)) return;
    if (nextLane < lane) input.left = true;
    if (nextLane > lane) input.right = true;
  };

  if (threat && (threat.type === "hay" || threat.type === "fence")) {
    const gap = threat.y - player.y;
    if (gap < 120 && gap > 36 && player.z <= 1) input.action = true;
    if (gap <= 36 && player.z < 20) {
      const left = lane - 1;
      const right = lane + 1;
      if (open.includes(right)) steerTo(right);
      else steerTo(left);
    }
  } else if (threat && threat.type === "mud") {
    const options = open.filter((item) => item !== lane);
    if (options.length) {
      options.sort((a, b) => Math.abs(a - player.id) - Math.abs(b - player.id));
      steerTo(options[0]);
    }
  } else if (threat && threat.type === "tractor") {
    const eta = Math.max(0, (threat.y - player.y) / speed);
    const futureX = tractorCenterX(threat, race.time + eta);
    const ranked = open
      .map((item) => ({ item, dist: Math.abs(laneCenter(item) - futureX) }))
      .sort((a, b) => b.dist - a.dist);
    if (ranked.length) steerTo(ranked[0].item);
  } else if (corn && open.includes(corn.lane)) {
    steerTo(corn.lane);
  } else {
    const preferred = open.includes(player.id) ? player.id : open[player.id % open.length];
    steerTo(preferred);
  }

  const ahead = boundsAt(race.course, player.y + 160);
  if (player.x < ahead.minX + 8) {
    input.left = false;
    input.right = true;
  } else if (player.x > ahead.maxX - 8) {
    input.right = false;
    input.left = true;
  }

  if (player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const margin = player.y - race.cameraBottom;
    let rival = false;
    for (const other of race.players) {
      if (other.id === player.id || other.state !== "racing") continue;
      const aheadBy = other.y - player.y;
      if (aheadBy > 6 && aheadBy < 70 && Math.abs(other.x - player.x) < 48) rival = true;
    }
    if (margin < 190 || rival) input.secondary = true;
  }

  return input;
}
