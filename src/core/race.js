import { decideBot } from "./bot.js";
import {
  laneCenter,
  BOOST_MULT,
  BOOST_TIME,
  BRAKE_SPEED,
  BUMP_DIST,
  CLOSE_TIME,
  CRUISE_SPEED,
  DASH_BONUS,
  DASH_COOLDOWN,
  DASH_TIME,
  DT,
  FENCE_Z,
  FINISH_VIEW,
  GRAVITY,
  HAY_Z,
  JUMP_V,
  LANE_SLIDE,
  LANE_WIDTH,
  LEASH,
  MAX_RACE_TIME,
  MUD_MULT,
  MUD_Z,
  SCROLL_SPEED,
  SPRINT_SPEED,
  START_Y,
  STRAFE_SPEED,
  STUMBLE_MULT,
  STUMBLE_TIME,
  STUN_SPEED,
  STUN_TIME,
  TRACTOR_Z,
  TURKEY_RADIUS,
} from "./constants.js";
import { boundsAt, tractorCenterX } from "./course.js";
import { blankActions } from "./input.js";

function freshPlayer(id, mode, startY) {
  return {
    id,
    mode,
    x: laneCenter(id),
    y: startY,
    z: 0,
    vz: 0,
    vx: 0,
    vy: 0,
    state: mode === "off" ? "out" : "racing",
    stunTimer: 0,
    iframe: 0,
    boostTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    stumble: 0,
    secondaryPrev: false,
    finishPlace: 0,
    collected: {},
    hitSolid: {},
    inMud: false,
  };
}

export function createRace(course, slots, options = {}) {
  const startY = options.startY ?? START_Y;
  const players = [0, 1, 2, 3].map((id) => freshPlayer(id, slots[id].mode, startY));
  return {
    course,
    players,
    cameraBottom: options.cameraBottom ?? 0,
    time: 0,
    phase: "running",
    events: [],
    nextPlace: 0,
    closing: false,
    closeTimer: 0,
    settled: false,
  };
}

function normalize(actions) {
  const blank = blankActions();
  if (!actions) return blank;
  for (const key of Object.keys(blank)) {
    if (actions[key]) blank[key] = true;
  }
  blank.usingGamepad = !!actions.usingGamepad;
  return blank;
}

function overlapsY(y, obstacle, pad = 8) {
  return Math.abs(y - obstacle.y) <= obstacle.h / 2 + pad;
}

function coversLane(x, lane) {
  const center = laneCenter(lane);
  return Math.abs(x - center) <= LANE_WIDTH / 2 - 4;
}

function solidBlocking(course, x, y, z) {
  for (const obstacle of course.obstacles) {
    if (obstacle.type !== "hay" && obstacle.type !== "fence") continue;
    const clear = obstacle.type === "hay" ? HAY_Z : FENCE_Z;
    if (z >= clear) continue;
    if (!overlapsY(y, obstacle)) continue;
    if (!coversLane(x, obstacle.lane)) continue;
    return obstacle;
  }
  return null;
}

function slideIntoLanes(race, player, dt) {
  const bounds = boundsAt(race.course, player.y);
  const maxPush = LANE_SLIDE * dt;
  if (player.x < bounds.minX) player.x = Math.min(bounds.minX, player.x + maxPush);
  else if (player.x > bounds.maxX) player.x = Math.max(bounds.maxX, player.x - maxPush);
}

function updatePlayer(race, player, input, dt) {
  if (player.state !== "racing") return;
  if (player.stunTimer > 0) player.stunTimer = Math.max(0, player.stunTimer - dt);
  if (player.iframe > 0) player.iframe = Math.max(0, player.iframe - dt);
  if (player.boostTimer > 0) player.boostTimer = Math.max(0, player.boostTimer - dt);
  if (player.dashTimer > 0) player.dashTimer = Math.max(0, player.dashTimer - dt);
  if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  if (player.stumble > 0) player.stumble = Math.max(0, player.stumble - dt);

  const stunned = player.stunTimer > 0;
  if (!stunned && input.secondary && !player.secondaryPrev && player.dashCooldown <= 0) {
    player.dashTimer = DASH_TIME;
    player.dashCooldown = DASH_COOLDOWN;
    race.events.push({ type: "dash", playerId: player.id });
  }
  if (!stunned && input.action && player.z <= 0 && player.vz <= 0) {
    player.vz = JUMP_V;
    race.events.push({ type: "jump", playerId: player.id });
  }
  player.secondaryPrev = !!input.secondary;

  if (player.z > 0 || player.vz !== 0) {
    player.vz -= GRAVITY * dt;
    player.z += player.vz * dt;
    if (player.z <= 0) {
      player.z = 0;
      player.vz = 0;
    }
  }

  player.inMud = false;
  for (const obstacle of race.course.obstacles) {
    if (obstacle.type !== "mud") continue;
    if (player.z >= MUD_Z) continue;
    if (!overlapsY(player.y, obstacle, 0)) continue;
    if (!coversLane(player.x, obstacle.lane)) continue;
    player.inMud = true;
    break;
  }

  for (const obstacle of race.course.obstacles) {
    if (obstacle.type !== "corn") continue;
    if (player.collected[obstacle.id]) continue;
    if (!overlapsY(player.y, obstacle, 0)) continue;
    if (!coversLane(player.x, obstacle.lane)) continue;
    player.collected[obstacle.id] = true;
    player.boostTimer = BOOST_TIME;
    race.events.push({ type: "corn", playerId: player.id, obstacleId: obstacle.id });
  }

  let speed = input.up ? SPRINT_SPEED : input.down ? BRAKE_SPEED : CRUISE_SPEED;
  if (stunned) speed = STUN_SPEED;
  else {
    if (player.boostTimer > 0) speed *= BOOST_MULT;
    if (player.inMud) speed *= MUD_MULT;
    if (player.stumble > 0) speed *= STUMBLE_MULT;
    if (player.dashTimer > 0) speed += DASH_BONUS;
  }
  player.vy = speed;
  const dir = stunned ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = dir * STRAFE_SPEED;
  player.x += player.vx * dt;

  const nextY = player.y + speed * dt;
  const blocker = solidBlocking(race.course, player.x, nextY, player.z);
  if (blocker) {
    const front = blocker.y - blocker.h / 2 - 10;
    player.y = Math.min(player.y, front);
    player.stumble = STUMBLE_TIME;
    if (!player.hitSolid[blocker.id]) {
      player.hitSolid[blocker.id] = true;
      race.events.push({ type: "hit", playerId: player.id, obstacleId: blocker.id, kind: blocker.type });
    }
  } else {
    player.y = nextY;
  }

  slideIntoLanes(race, player, dt);

  if (player.iframe <= 0 && player.stunTimer <= 0 && player.z < TRACTOR_Z) {
    for (const obstacle of race.course.obstacles) {
      if (obstacle.type !== "tractor") continue;
      if (Math.abs(player.y - obstacle.y) > obstacle.h / 2 + 12) continue;
      const center = tractorCenterX(obstacle, race.time);
      if (Math.abs(player.x - center) > obstacle.w / 2 + TURKEY_RADIUS - 6) continue;
      player.stunTimer = STUN_TIME;
      player.iframe = STUN_TIME + 0.45;
      player.y = Math.max(0, player.y - 42);
      player.vy = STUN_SPEED;
      race.events.push({ type: "stun", playerId: player.id, obstacleId: obstacle.id });
      break;
    }
  }
}

function resolveBumps(race, dt) {
  const live = race.players.filter((player) => player.state === "racing");
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i];
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const min = TURKEY_RADIUS * 2;
        if (dist >= min) continue;
        const nx = dx / dist;
        const aDash = a.dashTimer > 0;
        const bDash = b.dashTimer > 0;
        if (aDash !== bDash) {
          const dasher = aDash ? a : b;
          const target = aDash ? b : a;
          const away = Math.sign(target.x - dasher.x) || (dasher.id % 2 === 0 ? 1 : -1);
          target.x += away * BUMP_DIST;
          race.events.push({ type: "bump", playerId: dasher.id, targetId: target.id });
        } else {
          const push = (min - dist) / 2;
          const sx = Math.abs(nx) < 0.2 ? (a.id < b.id ? -1 : 1) : Math.sign(nx);
          a.x -= sx * push;
          b.x += sx * push;
        }
      }
    }
  }
  for (const player of live) slideIntoLanes(race, player, dt);
}

function checkFinishes(race) {
  const crossed = race.players.filter((player) => player.state === "racing" && player.y >= race.course.finishY);
  crossed.sort((a, b) => b.y - a.y || a.id - b.id);
  for (const player of crossed) {
    player.state = "finished";
    player.y = race.course.finishY;
    player.vy = 0;
    race.nextPlace += 1;
    player.finishPlace = race.nextPlace;
    race.events.push({ type: "finish", playerId: player.id, place: player.finishPlace });
  }
}

function eliminate(race, player) {
  if (player.state !== "racing") return;
  player.state = "eliminated";
  player.finishPlace = 0;
  race.events.push({ type: "eliminate", playerId: player.id });
}

function updateCamera(race, dt) {
  let bottom = race.cameraBottom + SCROLL_SPEED * dt;
  const active = race.players.filter((player) => player.state === "racing");
  if (active.length) {
    let lead = active[0].y;
    for (const player of active) if (player.y > lead) lead = player.y;
    const leash = lead - LEASH;
    if (bottom < leash) bottom = leash;
  }
  const cap = race.course.finishY - FINISH_VIEW;
  if (bottom > cap) bottom = cap;
  if (bottom < race.cameraBottom) bottom = race.cameraBottom;
  race.cameraBottom = bottom;
  if (!race.closing && bottom >= cap - 0.01) {
    race.closing = true;
    race.closeTimer = CLOSE_TIME;
  }
  if (race.closing) race.closeTimer -= dt;
}

export function stepRace(race, inputs = [], dt = DT) {
  race.events = [];
  if (race.phase === "done") return race;
  race.time += dt;

  const actions = race.players.map((player, index) => {
    if (player.state !== "racing") return blankActions();
    const given = inputs[index];
    if (given) return normalize(given);
    if (player.mode === "bot") return decideBot(player, race);
    return blankActions();
  });

  for (let i = 0; i < race.players.length; i += 1) {
    updatePlayer(race, race.players[i], actions[i], dt);
  }
  resolveBumps(race, dt);
  checkFinishes(race);
  updateCamera(race, dt);

  for (const player of race.players) {
    if (player.state === "racing" && player.y < race.cameraBottom - 10) eliminate(race, player);
  }
  if (race.closing && race.closeTimer <= 0) {
    for (const player of race.players) eliminate(race, player);
  }
  if (race.time > MAX_RACE_TIME) {
    for (const player of race.players) eliminate(race, player);
  }
  if (!race.players.some((player) => player.state === "racing")) race.phase = "done";
  return race;
}

export function runRace(race, inputFn, dt = DT, maxSteps = 30000) {
  let steps = 0;
  while (race.phase !== "done" && steps < maxSteps) {
    const inputs = inputFn ? inputFn(race) : [];
    stepRace(race, inputs, dt);
    steps += 1;
  }
  return steps;
}
