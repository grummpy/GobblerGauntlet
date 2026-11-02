import {
  DASH_COOLDOWN,
  LANE_WIDTH,
  PLAYER_COLORS,
  TRACK_LEFT,
  TRACK_WIDTH,
  VIEW_H,
  VIEW_W,
} from "../core/constants.js";
import { segmentAt, tractorCenterX } from "../core/course.js";
import { keyLabel } from "../core/input.js";

const FONT = "Trebuchet MS, Segoe UI, sans-serif";
const INK = "#1a120c";
const CREAM = "#f6e7c8";
const WOOD = "#6b3e22";
const WOOD_DARK = "#3e2414";

let regions = [];

function hit(id, x, y, w, h) {
  regions.push({ id, x, y, w, h });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(42, 24, 14, 0.88)";
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#e7c27a";
  ctx.stroke();
}

function button(ctx, id, x, y, w, h, label, active) {
  hit(id, x, y, w, h);
  ctx.fillStyle = active ? "#f0c14a" : WOOD;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = active ? "#fff4d2" : "#e7c27a";
  ctx.stroke();
  ctx.fillStyle = active ? INK : CREAM;
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function worldY(y, camera) {
  return VIEW_H - (y - camera);
}

function worldX(x) {
  return TRACK_LEFT + x;
}

function hash(n) {
  let x = (n ^ 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
}

function drawScenery(ctx, _camera, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#24344a");
  sky.addColorStop(0.5, "#6d4a4a");
  sky.addColorStop(1, "#c47a45");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#f2d7a2";
  ctx.beginPath();
  ctx.arc(1080, 92, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f4d28";
  ctx.fillRect(0, 460, VIEW_W, VIEW_H - 460);
  drawLeaves(ctx, time);
}

function drawLeaves(ctx, time) {
  for (let i = 0; i < 16; i += 1) {
    const leaf = hash(i + 17);
    const x = (leaf + time * 18 * (8 + (i % 5))) % (VIEW_W + 40) - 20;
    const y = (i * 48 + time * (20 + (leaf % 25))) % (VIEW_H + 30) - 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((leaf % 7) * 0.2 + time);
    ctx.fillStyle = i % 2 ? "#e07a32" : "#c4452d";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMarginProps(ctx, camera) {
  const top = camera + VIEW_H + 80;
  const bottom = camera - 80;
  const first = Math.floor(bottom / 170);
  const last = Math.floor(top / 170);
  for (let bucket = first; bucket <= last; bucket += 1) {
    const y = worldY(bucket * 170 + 30, camera);
    const leftRoll = hash(bucket + 3);
    const rightRoll = hash(bucket + 99);
    drawProp(ctx, 48 + (leftRoll % 220), y, leftRoll);
    drawProp(ctx, VIEW_W - 48 - (rightRoll % 220), y, rightRoll);
  }
}

function drawProp(ctx, x, y, roll) {
  if (y < -50 || y > VIEW_H + 50) return;
  if (x > TRACK_LEFT - 10 && x < TRACK_LEFT + TRACK_WIDTH + 10) return;
  if (roll % 3 === 0) {
    ctx.fillStyle = "#5a3414";
    ctx.fillRect(x - 5, y - 6, 10, 34);
    ctx.fillStyle = "#2d6a30";
    ctx.beginPath();
    ctx.arc(x, y - 28, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f8a3c";
    ctx.beginPath();
    ctx.arc(x - 10, y - 36, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e07a32";
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 20, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e07a28";
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a3e12";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.quadraticCurveTo(x, y - 8, x + 6, y);
    ctx.stroke();
    ctx.fillStyle = "#3f8a3c";
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 14, 7, 3, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrack(ctx, course, camera) {
  const grass = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grass.addColorStop(0, "#3d6a34");
  grass.addColorStop(1, "#2a4c28");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const viewTop = camera + VIEW_H;
  const viewBottom = camera;
  for (const segment of course.segments) {
    if (segment.y1 < viewBottom || segment.y0 > viewTop) continue;
    const y0 = Math.max(segment.y0, viewBottom);
    const y1 = Math.min(segment.y1, viewTop);
    const screenFar = worldY(y1, camera);
    const screenNear = worldY(y0, camera);
    const height = screenNear - screenFar + 1;
    const minLane = Math.min(...segment.lanes);
    const maxLane = Math.max(...segment.lanes);
    const x = TRACK_LEFT + minLane * LANE_WIDTH;
    const w = (maxLane - minLane + 1) * LANE_WIDTH;
    ctx.fillStyle = "#a56b3c";
    ctx.fillRect(x, screenFar, w, height);
    ctx.fillStyle = "rgba(90, 52, 28, 0.28)";
    for (let lane = minLane; lane <= maxLane; lane += 1) {
      ctx.fillRect(TRACK_LEFT + lane * LANE_WIDTH + LANE_WIDTH / 2 - 10, screenFar, 20, height);
    }
    ctx.strokeStyle = "rgba(246, 231, 200, 0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 16]);
    ctx.beginPath();
    for (let lane = minLane + 1; lane <= maxLane; lane += 1) {
      const line = TRACK_LEFT + lane * LANE_WIDTH;
      ctx.moveTo(line, screenFar);
      ctx.lineTo(line, screenNear);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#efe3c4";
    const posts = Math.max(1, Math.ceil(height / 36));
    for (let post = 0; post < posts; post += 1) {
      const py = screenFar + post * 36;
      ctx.fillRect(x - 6, py, 6, 16);
      ctx.fillRect(x + w, py, 6, 16);
    }
  }
}

function drawObstacles(ctx, race) {
  const camera = race.cameraBottom;
  const items = race.course.obstacles.slice().sort((a, b) => b.y - a.y);
  for (const obstacle of items) {
    const sy = worldY(obstacle.y, camera);
    if (sy < -80 || sy > VIEW_H + 80) continue;
    if (obstacle.type === "tractor") drawTractor(ctx, obstacle, sy, race.time);
    else if (obstacle.type === "hay") drawHay(ctx, obstacle, sy);
    else if (obstacle.type === "fence") drawFence(ctx, obstacle, sy);
    else if (obstacle.type === "mud") drawMud(ctx, obstacle, sy);
    else if (obstacle.type === "corn") drawCorn(ctx, obstacle, sy);
  }
}

function laneScreenX(lane) {
  return TRACK_LEFT + lane * LANE_WIDTH;
}

function drawHay(ctx, obstacle, sy) {
  const x = laneScreenX(obstacle.lane) + 12;
  const w = LANE_WIDTH - 24;
  const h = obstacle.h;
  ctx.fillStyle = "#e2c15a";
  roundRect(ctx, x, sy - h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "#8a5a18";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "#a56a22";
  ctx.beginPath();
  ctx.moveTo(x + 8, sy);
  ctx.lineTo(x + w - 8, sy);
  ctx.moveTo(x + w / 2, sy - h / 2 + 4);
  ctx.lineTo(x + w / 2, sy + h / 2 - 4);
  ctx.stroke();
}

function drawFence(ctx, obstacle, sy) {
  const x = laneScreenX(obstacle.lane) + 8;
  const w = LANE_WIDTH - 16;
  ctx.fillStyle = "#d9d2c5";
  ctx.fillRect(x, sy - 16, w, 8);
  ctx.fillRect(x, sy + 6, w, 8);
  ctx.fillStyle = "#6b3e22";
  ctx.fillRect(x + 6, sy - 24, 8, 48);
  ctx.fillRect(x + w - 14, sy - 24, 8, 48);
}

function drawMud(ctx, obstacle, sy) {
  const x = laneScreenX(obstacle.lane) + 8;
  const w = LANE_WIDTH - 16;
  const h = obstacle.h;
  ctx.fillStyle = "#5a3d2e";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, sy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(196, 160, 120, 0.35)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 8, sy - 6, w / 5, h / 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCorn(ctx, obstacle, sy) {
  const x = laneScreenX(obstacle.lane) + LANE_WIDTH / 2;
  ctx.fillStyle = "#f2d34a";
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x + i * 12, sy + 4, 8, 16, i * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#6aaa3a";
  ctx.beginPath();
  ctx.ellipse(x + 10, sy - 14, 10, 5, 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawTractor(ctx, obstacle, sy, time) {
  const x = worldX(tractorCenterX(obstacle, time));
  ctx.save();
  ctx.translate(x, sy);
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(-22, 14, 12, 0, Math.PI * 2);
  ctx.arc(22, 14, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c0392b";
  roundRect(ctx, -34, -16, 68, 30, 6);
  ctx.fill();
  ctx.fillStyle = "#922818";
  ctx.fillRect(-10, -28, 28, 16);
  ctx.fillStyle = "#d7f3ff";
  ctx.fillRect(-6, -24, 18, 8);
  ctx.fillStyle = "#222";
  ctx.fillRect(24, -4, 12, 6);
  ctx.restore();
}

function drawBarn(ctx, course, camera) {
  const door = worldY(course.finishY, camera);
  if (door < -260 || door > VIEW_H + 40) return;
  const x = TRACK_LEFT + TRACK_WIDTH / 2;
  ctx.fillStyle = "#8e2a2a";
  ctx.fillRect(x - 150, door - 210, 300, 180);
  ctx.fillStyle = "#6e1d1d";
  ctx.beginPath();
  ctx.moveTo(x - 170, door - 210);
  ctx.lineTo(x, door - 280);
  ctx.lineTo(x + 170, door - 210);
  ctx.fill();
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(x - 46, door - 120, 92, 120);
  ctx.strokeStyle = "#f4efe4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, door - 120);
  ctx.lineTo(x, door);
  ctx.moveTo(x - 46, door - 60);
  ctx.lineTo(x + 46, door - 60);
  ctx.stroke();
  const cells = 12;
  const cell = 18;
  for (let i = 0; i < cells; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      ctx.fillStyle = (i + j) % 2 ? "#1a120c" : CREAM;
      ctx.fillRect(x - (cells * cell) / 2 + i * cell, door + 8 + j * cell, cell, cell);
    }
  }
  ctx.fillStyle = CREAM;
  ctx.font = `bold 28px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("BARN", x, door - 150);
}

function drawTurkey(ctx, x, y, player, time, scale = 1.7) {
  const bob = player.z > 1 ? 0 : Math.sin(time * 12 + player.id) * 1.4;
  ctx.save();
  ctx.translate(x, y + 12 * scale);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(8, (18 - player.z * 0.04) * scale), 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y - player.z + bob);
  ctx.scale(scale, scale);
  const fan = player.dashTimer > 0 ? 1.35 : 1;
  for (let i = -3; i <= 3; i += 1) {
    ctx.fillStyle = ["#6a3018", "#c47a3a", "#8d4a28", "#e0a060"][(i + 3) % 4];
    ctx.beginPath();
    ctx.ellipse(i * 7, 20, 5.5, 16 * fan, i * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#7a4a2c";
  ctx.beginPath();
  ctx.ellipse(0, 4, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9a6844";
  ctx.beginPath();
  ctx.ellipse(-2, 2, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const flap = Math.sin(time * (player.dashTimer > 0 ? 28 : 14) + player.id);
  ctx.fillStyle = "#5c3820";
  ctx.beginPath();
  ctx.ellipse(-16, 6, 8, 11, -0.7 + flap * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, 6, 8, 11, 0.7 - flap * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f0c14a";
  ctx.lineWidth = 2.4;
  const step = Math.sin(time * 16 + player.id);
  ctx.beginPath();
  ctx.moveTo(-5, 18);
  ctx.lineTo(-7, 28 + step * 3);
  ctx.moveTo(5, 18);
  ctx.lineTo(8, 28 - step * 3);
  ctx.stroke();
  ctx.fillStyle = "#c48a58";
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8892a";
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(11, -16);
  ctx.lineTo(0, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d23b4a";
  ctx.beginPath();
  ctx.ellipse(-1, -10, 2.6, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8ea";
  ctx.beginPath();
  ctx.arc(3.5, -18, 3.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(4.4, -18, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2d7a2";
  ctx.beginPath();
  ctx.moveTo(-6, -24);
  ctx.quadraticCurveTo(0, -32, 6, -24);
  ctx.fill();
  ctx.fillStyle = PLAYER_COLORS[player.id].bib;
  roundRect(ctx, -11, -6, 22, 16, 5);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(player.id + 1), 0, 2);
  if (player.stunTimer > 0) {
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(14, -30 + Math.sin(time * 8) * 2, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function ordinal(place) {
  return ["", "1ST", "2ND", "3RD", "4TH"][place] || "OUT";
}

function drawHud(ctx, view) {
  const race = view.race;
  const match = view.match;
  ctx.fillStyle = "rgba(20, 12, 8, 0.55)";
  ctx.fillRect(VIEW_W / 2 - 92, 12, 184, 36);
  ctx.fillStyle = CREAM;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`RACE ${match.roundIndex + 1}/${match.rounds}`, VIEW_W / 2, 30);

  const danger = race.players.some((player) => player.state === "racing" && player.y - race.cameraBottom < 150);
  if (danger) {
    const glow = ctx.createLinearGradient(0, VIEW_H - 90, 0, VIEW_H);
    glow.addColorStop(0, "rgba(180, 24, 24, 0)");
    glow.addColorStop(1, "rgba(180, 24, 24, 0.45)");
    ctx.fillStyle = glow;
    ctx.fillRect(TRACK_LEFT, VIEW_H - 90, TRACK_WIDTH, 90);
  }

  race.players.forEach((player, index) => {
    const column = index < 2 ? 16 : VIEW_W - 266;
    const row = index % 2 === 0 ? 64 : 250;
    drawCard(ctx, column, row, player, view);
  });

  ctx.fillStyle = "rgba(246,231,200,0.8)";
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${race.time.toFixed(1)}s   seed ${match.seed}`, VIEW_W / 2, VIEW_H - 16);
}

function drawCard(ctx, x, y, player, view) {
  panel(ctx, x, y, 250, 150);
  ctx.fillStyle = PLAYER_COLORS[player.id].bib;
  ctx.fillRect(x + 12, y + 14, 18, 122);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `bold 22px ${FONT}`;
  const label = `P${player.id + 1}  ${PLAYER_COLORS[player.id].name.toUpperCase()}`;
  ctx.fillText(label, x + 40, y + 36);
  const pad = view.usingGamepad[player.id];
  const tag = pad ? "PAD" : player.mode === "bot" ? "BOT" : "YOU";
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = pad ? "#9dffc8" : "#e7c27a";
  ctx.fillText(tag, x + 188, y + 34);
  if (pad) drawPad(ctx, x + 214, y + 20);
  ctx.fillStyle = CREAM;
  ctx.font = `bold 28px ${FONT}`;
  const status = player.state === "finished" ? ordinal(player.finishPlace) : player.state === "eliminated" ? "OUT" : "RUN";
  ctx.fillText(status, x + 40, y + 78);
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(String(view.match.scores[player.id]), x + 230, y + 78);
  ctx.textAlign = "left";
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = "#e7c27a";
  ctx.fillText("SCORE", x + 168, y + 98);
  const ready = player.dashCooldown <= 0;
  const fill = ready ? 1 : 1 - player.dashCooldown / DASH_COOLDOWN;
  ctx.fillStyle = "#2a160d";
  roundRect(ctx, x + 40, y + 112, 190, 14, 7);
  ctx.fill();
  ctx.fillStyle = ready ? "#f0c14a" : "#8d5a34";
  roundRect(ctx, x + 40, y + 112, Math.max(8, 190 * fill), 14, 7);
  ctx.fill();
}

function drawPad(ctx, x, y) {
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, 22, 14, 4);
  ctx.stroke();
  ctx.fillStyle = "#9dffc8";
  ctx.beginPath();
  ctx.arc(x + 15, y + 7, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawWorld(ctx, view) {
  const race = view.race;
  ctx.save();
  if (view.shake > 0) {
    ctx.translate(Math.sin(view.uiTime * 45) * 5 * view.shake, Math.cos(view.uiTime * 38) * 4 * view.shake);
  }
  drawTrack(ctx, race.course, race.cameraBottom);
  drawMarginProps(ctx, race.cameraBottom);
  drawObstacles(ctx, race);
  drawBarn(ctx, race.course, race.cameraBottom);
  const sprites = race.players
    .filter((player) => player.state === "racing" || player.state === "finished")
    .slice()
    .sort((a, b) => b.y - a.y);
  for (const player of sprites) {
    const x = worldX(player.x);
    const y = worldY(player.y, race.cameraBottom);
    if (y < -40 || y > VIEW_H + 50) continue;
    drawTurkey(ctx, x, y, player, view.uiTime, 1.85);
  }
  for (const puff of view.particles) {
    const alpha = Math.max(0, puff.life / puff.max);
    ctx.fillStyle = `rgba(90, 60, 30, ${alpha * 0.45})`;
    ctx.beginPath();
    ctx.arc(worldX(puff.x), worldY(puff.y, race.cameraBottom), 8 * (1.4 - alpha), 0, Math.PI * 2);
    ctx.fill();
  }
  drawLeaves(ctx, view.uiTime);
  ctx.restore();
  drawHud(ctx, view);
}

function drawTitle(ctx, view) {
  if (view.cover && view.cover.complete && view.cover.naturalWidth) {
    ctx.drawImage(view.cover, 0, 0, VIEW_W, VIEW_H);
  } else {
    drawScenery(ctx, 0, view.uiTime);
    ctx.fillStyle = "#f0c14a";
    ctx.font = `bold 92px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("GOBBLER", VIEW_W / 2, 250);
    ctx.fillText("GAUNTLET", VIEW_W / 2, 350);
  }
  ctx.fillStyle = "rgba(20, 10, 6, 0.72)";
  ctx.fillRect(0, 560, VIEW_W, 160);
  button(ctx, "start", 390, 590, 240, 64, "START", view.menuIndex === 0);
  button(ctx, "settings", 660, 590, 240, 64, "SETTINGS", view.menuIndex === 1);
  ctx.fillStyle = CREAM;
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Enter or Start  ·  4 turkeys, one barn", VIEW_W / 2, 688);
}

function drawJoin(ctx, view) {
  drawScenery(ctx, 200, view.uiTime);
  ctx.fillStyle = "rgba(20,12,8,0.35)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.font = `bold 54px ${FONT}`;
  if (view.icon && view.icon.complete && view.icon.naturalWidth) {
    ctx.drawImage(view.icon, 36, 28, 72, 72);
  }
  ctx.fillText("CHOOSE YOUR TURKEYS", VIEW_W / 2, 78);
  ctx.font = `20px ${FONT}`;
  ctx.fillText("Action joins  ·  Secondary toggles bot / off  ·  Empty slots can sit this one out", VIEW_W / 2, 118);
  for (let i = 0; i < 4; i += 1) {
    const x = 70 + i * 305;
    const mode = view.slots[i];
    hit(`card-${i}`, x, 170, 280, 340);
    panel(ctx, x, 170, 280, 340);
    ctx.fillStyle = PLAYER_COLORS[i].bib;
    ctx.fillRect(x + 20, 190, 240, 12);
    drawTurkey(ctx, x + 140, 300, { id: i, z: 0, dashTimer: 0, stunTimer: 0 }, view.uiTime, 2.15);
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillText(`P${i + 1} ${PLAYER_COLORS[i].name.toUpperCase()}`, x + 140, 400);
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = mode === "human" ? "#9dffc8" : mode === "bot" ? "#f0c14a" : "#e7b2a0";
    ctx.fillText(mode === "human" ? "READY" : mode === "bot" ? "BOT" : "OFF", x + 140, 436);
    ctx.fillStyle = CREAM;
    ctx.font = `16px ${FONT}`;
    const bind = view.bindings[i];
    ctx.fillText(`${keyLabel(bind.action)} join   ${keyLabel(bind.secondary)} toggle`, x + 140, 478);
  }
  button(ctx, "go", 390, 560, 240, 64, "RACE", true);
  button(ctx, "settings", 660, 560, 240, 64, "SETTINGS", false);
  ctx.fillStyle = CREAM;
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(view.message || "Enter to race  ·  Esc back  ·  Tab settings", VIEW_W / 2, 670);
}

function drawCountdown(ctx, view) {
  const n = Math.ceil(view.countdown);
  ctx.fillStyle = "rgba(10, 6, 4, 0.35)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.font = `bold 180px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(String(n), VIEW_W / 2, VIEW_H / 2);
  ctx.fillText(String(n), VIEW_W / 2, VIEW_H / 2);
}

function drawRound(ctx, view) {
  panel(ctx, 340, 120, 600, 460);
  ctx.fillStyle = "#f0c14a";
  ctx.textAlign = "center";
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText(`RACE ${view.match.roundIndex + 1} RESULTS`, VIEW_W / 2, 180);
  const rows = view.match.lastPlaces || [];
  rows.forEach((row, index) => {
    const y = 250 + index * 62;
    ctx.fillStyle = PLAYER_COLORS[row.id].bib;
    roundRect(ctx, 390, y - 24, 36, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(String(row.id + 1), 408, y - 2);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`P${row.id + 1} ${PLAYER_COLORS[row.id].name}`, 446, y);
    ctx.textAlign = "right";
    ctx.fillText(row.place ? `${ordinal(row.place)}  +${[0, 5, 3, 2, 1][row.place]}` : "OUT  +0", 890, y);
    ctx.textAlign = "center";
  });
  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = "#e7c27a";
  ctx.fillText("Enter for the next race", VIEW_W / 2, 530);
  hit("continue", 340, 120, 600, 460);
}

function drawMatch(ctx, view) {
  panel(ctx, 300, 70, 680, 580);
  const winners = view.match.winners || [];
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0c14a";
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText(winners.length > 1 ? "SHARED WIN" : "FARM CHAMPION", VIEW_W / 2, 140);
  if (winners.length) {
    ctx.fillStyle = CREAM;
    ctx.font = `bold 28px ${FONT}`;
    const names = winners.map((id) => `P${id + 1} ${PLAYER_COLORS[id].name}`).join("  ·  ");
    ctx.fillText(names, VIEW_W / 2, 188);
  }
  const rows = view.standings;
  rows.forEach((row, index) => {
    const y = 250 + index * 58;
    ctx.fillStyle = PLAYER_COLORS[row.id].bib;
    ctx.fillRect(380, y - 22, 16, 36);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM;
    ctx.font = `bold 26px ${FONT}`;
    const tag = row.mode === "off" ? "sat out" : `${row.score} pts`;
    ctx.fillText(`${index + 1}.  P${row.id + 1} ${PLAYER_COLORS[row.id].name}`, 414, y + 4);
    ctx.textAlign = "right";
    ctx.fillText(tag, 940, y + 4);
  });
  button(ctx, "rematch", 400, 520, 220, 58, "REMATCH", view.menuIndex === 0);
  button(ctx, "title", 660, 520, 220, 58, "TITLE", view.menuIndex === 1);
}

function drawPause(ctx, view) {
  panel(ctx, 430, 140, 420, 440);
  ctx.fillStyle = "#f0c14a";
  ctx.textAlign = "center";
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText("PAUSED", VIEW_W / 2, 200);
  const items = [
    ["resume", "RESUME"],
    ["pause-settings", "SETTINGS"],
    ["pause-controls", "CONTROLS"],
    ["quit", "QUIT"],
  ];
  items.forEach((item, index) => {
    button(ctx, item[0], 490, 240 + index * 74, 300, 58, item[1], view.menuIndex === index);
  });
}

function drawSettings(ctx, view) {
  drawScenery(ctx, 80, view.uiTime);
  panel(ctx, 340, 110, 600, 500);
  ctx.fillStyle = "#f0c14a";
  ctx.textAlign = "center";
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText("SETTINGS", VIEW_W / 2, 170);
  const volume = `${Math.round(view.settings.volume * 100)}%`;
  button(ctx, "vol-left", 390, 210, 64, 58, "−", false);
  button(ctx, "volume", 470, 210, 340, 58, `VOLUME  ${volume}`, view.menuIndex === 0);
  button(ctx, "vol-right", 826, 210, 64, 58, "+", false);
  button(ctx, "rounds-left", 390, 290, 64, 58, "−", false);
  button(ctx, "rounds", 470, 290, 340, 58, `RACES  ${view.settings.rounds}`, view.menuIndex === 1);
  button(ctx, "rounds-right", 826, 290, 64, 58, "+", false);
  button(ctx, "open-controls", 430, 380, 420, 58, "CONTROLS", view.menuIndex === 2);
  button(ctx, "settings-back", 430, 470, 420, 58, "BACK", view.menuIndex === 3);
  ctx.fillStyle = CREAM;
  ctx.font = `16px ${FONT}`;
  ctx.fillText("M mutes  ·  Left / right change the highlighted row", VIEW_W / 2, 570);
}

function drawControls(ctx, view) {
  drawScenery(ctx, 40, view.uiTime);
  panel(ctx, 80, 40, 1120, 640);
  ctx.fillStyle = "#f0c14a";
  ctx.textAlign = "center";
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText("CONTROLS", VIEW_W / 2, 86);
  ctx.fillStyle = CREAM;
  ctx.font = `16px ${FONT}`;
  ctx.fillText("Pads 0–3 override P1–P4 while plugged in. A jumps, B flap-dashes, Start pauses.", VIEW_W / 2, 118);
  const fields = ["left", "right", "up", "down", "action", "secondary"];
  const labels = ["LEFT", "RIGHT", "UP", "DOWN", "JUMP", "DASH"];
  fields.forEach((field, index) => {
    ctx.fillStyle = "#e7c27a";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(labels[index], 250 + index * 140, 160);
    void field;
  });
  for (let p = 0; p < 4; p += 1) {
    const y = 190 + p * 90;
    ctx.fillStyle = PLAYER_COLORS[p].bib;
    ctx.fillRect(110, y, 16, 64);
    ctx.fillStyle = CREAM;
    ctx.textAlign = "left";
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`P${p + 1}`, 136, y + 38);
    for (let f = 0; f < 6; f += 1) {
      const index = p * 6 + f;
      const active = view.controlIndex === index;
      const armed = active && view.remap;
      const x = 190 + f * 140;
      button(ctx, `bind-${index}`, x, y, 124, 64, armed ? "PRESS" : keyLabel(view.bindings[p][fields[f]]), active);
    }
  }
  button(ctx, "reset", 250, 580, 300, 58, "RESET", false);
  button(ctx, "controls-back", 730, 580, 300, 58, "BACK", false);
  if (view.remap) {
    ctx.fillStyle = "#f0c14a";
    ctx.textAlign = "center";
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText("Press a key to bind. Esc cancels.", VIEW_W / 2, 560);
  }
}

function drawMessage(ctx, view) {
  if (!view.message) return;
  ctx.fillStyle = "rgba(20,12,8,0.8)";
  roundRect(ctx, VIEW_W / 2 - 220, 16, 440, 40, 10);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(view.message, VIEW_W / 2, 36);
}

export function render(ctx, view) {
  regions = [];
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (view.phase === "title") drawTitle(ctx, view);
  else if (view.phase === "join") drawJoin(ctx, view);
  else if (view.phase === "settings") drawSettings(ctx, view);
  else if (view.phase === "controls") drawControls(ctx, view);
  else if (view.race) {
    drawWorld(ctx, view);
    if (view.phase === "countdown") drawCountdown(ctx, view);
    if (view.phase === "round") drawRound(ctx, view);
    if (view.phase === "match") drawMatch(ctx, view);
    if (view.phase === "pause") drawPause(ctx, view);
  }
  if (view.phase !== "join") drawMessage(ctx, view);
  view.regions = regions;
}
