/** Tunables shared by the simulation, bots, and renderer. */

export const DT = 1 / 60;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 140;
export const TRACK_WIDTH = LANE_COUNT * LANE_WIDTH;
export const TURKEY_RADIUS = 22;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TRACK_LEFT = (VIEW_W - TRACK_WIDTH) / 2;

export const GRAVITY = 2200;
export const JUMP_V = 780;
export const HAY_Z = 36;
export const FENCE_Z = 58;
export const MUD_Z = 14;
export const TRACTOR_Z = 160;

export const SPRINT_SPEED = 318;
export const CRUISE_SPEED = 276;
export const BRAKE_SPEED = 150;
export const STRAFE_SPEED = 260;
export const SCROLL_SPEED = 250;
export const LEASH = 500;
export const DASH_BONUS = 300;
export const DASH_TIME = 0.32;
export const DASH_COOLDOWN = 3;
export const STUN_TIME = 1.15;
export const STUN_SPEED = 70;
export const BOOST_TIME = 2.2;
export const BOOST_MULT = 1.3;
export const MUD_MULT = 0.6;
export const STUMBLE_TIME = 0.35;
export const STUMBLE_MULT = 0.45;
export const BUMP_DIST = 64;
export const CLOSE_TIME = 7;
export const FINISH_VIEW = 220;
export const MAX_RACE_TIME = 100;
export const DEFAULT_ROUNDS = 4;
export const START_Y = 480;
export const LANE_SLIDE = 220;
export const DEFAULT_PORT = 8814;

export const PLACE_POINTS = Object.freeze({ 1: 5, 2: 3, 3: 2, 4: 1 });

export const PLAYER_COLORS = Object.freeze([
  { name: "Red", bib: "#d23b3b" },
  { name: "Blue", bib: "#2f6fdb" },
  { name: "Green", bib: "#3e9a45" },
  { name: "Gold", bib: "#e2b31c" },
]);

export function laneCenter(lane) {
  return (lane + 0.5) * LANE_WIDTH;
}

export function laneIndexAt(x) {
  const index = Math.floor(x / LANE_WIDTH);
  if (index < 0) return 0;
  if (index > LANE_COUNT - 1) return LANE_COUNT - 1;
  return index;
}
