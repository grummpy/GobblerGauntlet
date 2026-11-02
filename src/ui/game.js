import { DT, VIEW_H, VIEW_W } from "../core/constants.js";
import { blankActions, keyLabel, mapPlayers } from "../core/input.js";
import { acknowledgeRace, createMatch, standings, stepMatch } from "../core/match.js";
import { createAudio } from "./audio.js";
import { createInput } from "./input.js";
import { render } from "./render.js";
import { defaultSettings, loadSettings, saveSettings } from "./storage.js";

const FIELDS = ["left", "right", "up", "down", "action", "secondary"];

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function rising(pads, previous) {
  return pads.map((pad, index) => {
    const prior = previous[index] || [];
    return {
      connected: pad.connected,
      buttons: pad.buttons.map((down, button) => down && !prior[button]),
    };
  });
}

export function startGame(canvas) {
  const ctx = canvas.getContext("2d");
  const input = createInput(canvas);
  const audio = createAudio();
  const params = new URLSearchParams(globalThis.location?.search || "");
  const simRate = clamp(Number(params.get("simRate")) || 1, 1, 30);
  const querySeed = params.get("seed");
  const queryRounds = params.get("rounds");

  let settings = loadSettings();
  let phase = "title";
  let slots = [0, 1, 2, 3].map(() => ({ mode: "bot" }));
  let match = null;
  let countdown = 0;
  let banner = 0;
  let menuIndex = 0;
  let settingsBack = "title";
  let controlsBack = "settings";
  let controlIndex = 0;
  let remap = false;
  let message = "";
  let messageUntil = 0;
  let pausedFrom = "race";
  let uiTime = 0;
  let shake = 0;
  let last = 0;
  let acc = 0;
  let lastPads = [0, 1, 2, 3].map(() => ({ connected: false, axes: [0, 0], buttons: [] }));
  let prevButtons = [[], [], [], []];
  let regions = [];
  const particles = [];
  const dustMark = [-1, -1, -1, -1];

  const cover = new Image();
  cover.src = "assets/cover.jpg";
  const icon = new Image();
  icon.src = "assets/icon.jpg";

  canvas.tabIndex = 0;
  canvas.focus();

  function note(text) {
    message = text;
    messageUntil = uiTime + 2.4;
  }

  function persist() {
    settings = saveSettings(settings);
  }

  function snapshot() {
    const race = match?.race;
    return {
      phase,
      slots: slots.map((slot) => slot.mode),
      raceIndex: match ? match.roundIndex : -1,
      rounds: match ? match.rounds : settings.rounds,
      scores: match ? match.scores.slice() : null,
      winners: match ? match.winners.slice() : null,
      matchPhase: match ? match.phase : null,
      history: match ? match.history.length : 0,
      seed: match ? match.seed : null,
      muted: settings.muted,
      simRate,
      racePhase: race ? race.phase : null,
      time: race ? race.time : 0,
      players: race
        ? race.players.map((player) => ({
            id: player.id,
            mode: player.mode,
            state: player.state,
            x: player.x,
            y: player.y,
            z: player.z,
            place: player.finishPlace || 0,
            stun: player.stunTimer,
            boost: player.boostTimer,
          }))
        : null,
    };
  }

  globalThis.__GG = { getState: snapshot, simRate };

  function freshSeed() {
    if (querySeed !== null && querySeed !== "" && Number.isFinite(Number(querySeed))) return Number(querySeed) >>> 0;
    return (Date.now() >>> 0) || 1;
  }

  function startMatch() {
    if (!slots.some((slot) => slot.mode !== "off")) {
      note("Need at least one turkey");
      return;
    }
    const rounds = queryRounds ? clamp(Math.round(Number(queryRounds)), 1, 8) : settings.rounds;
    match = createMatch({
      seed: freshSeed(),
      rounds,
      slots: slots.map((slot) => ({ mode: slot.mode })),
    });
    countdown = 3;
    phase = "countdown";
    audio.countdown(3);
    dustMark.fill(-1);
  }

  function advance() {
    if (!match) return;
    const result = acknowledgeRace(match);
    if (result === "racing") {
      countdown = 3;
      phase = "countdown";
      audio.countdown(3);
      dustMark.fill(-1);
    } else {
      phase = "match";
      menuIndex = 0;
      audio.matchWin();
    }
  }

  function openSettings(from) {
    settingsBack = from;
    menuIndex = 0;
    phase = "settings";
  }

  function openControls(from) {
    controlsBack = from;
    controlIndex = 0;
    remap = false;
    phase = "controls";
  }

  function upPressed(just, edges) {
    return just.has("ArrowUp") || just.has("KeyW") || edges.some((pad) => pad.buttons[12]);
  }

  function downPressed(just, edges) {
    return just.has("ArrowDown") || just.has("KeyS") || edges.some((pad) => pad.buttons[13]);
  }

  function leftPressed(just, edges) {
    return just.has("ArrowLeft") || just.has("KeyA") || edges.some((pad) => pad.buttons[14]);
  }

  function rightPressed(just, edges) {
    return just.has("ArrowRight") || just.has("KeyD") || edges.some((pad) => pad.buttons[15]);
  }

  function confirmPressed(just, edges) {
    return just.has("Enter") || just.has("Space") || edges.some((pad) => pad.buttons[0]);
  }

  function handleSettings(just, edges) {
    if (upPressed(just, edges)) menuIndex = (menuIndex + 3) % 4;
    if (downPressed(just, edges)) menuIndex = (menuIndex + 1) % 4;
    if (menuIndex === 0 && leftPressed(just, edges)) {
      settings.volume = Math.round(Math.max(0, settings.volume - 0.1) * 10) / 10;
      persist();
    }
    if (menuIndex === 0 && rightPressed(just, edges)) {
      settings.volume = Math.round(Math.min(1, settings.volume + 0.1) * 10) / 10;
      persist();
    }
    if (menuIndex === 1 && leftPressed(just, edges)) {
      settings.rounds = Math.max(1, settings.rounds - 1);
      persist();
    }
    if (menuIndex === 1 && rightPressed(just, edges)) {
      settings.rounds = Math.min(8, settings.rounds + 1);
      persist();
    }
    if (confirmPressed(just, edges) && menuIndex === 2) openControls("settings");
    if ((confirmPressed(just, edges) && menuIndex === 3) || just.has("Escape") || edges.some((pad) => pad.buttons[1])) {
      phase = settingsBack;
    }
  }

  function handleControls(just, edges) {
    if (remap) {
      if (just.has("Escape")) {
        remap = false;
        return;
      }
      for (const code of just) {
        if (code === "Escape" || code === "Tab" || code === "KeyM") continue;
        const player = Math.floor(controlIndex / 6);
        const field = FIELDS[controlIndex % 6];
        settings.bindings[player][field] = code;
        persist();
        remap = false;
        note(`${keyLabel(code)} bound`);
        return;
      }
      return;
    }
    if (leftPressed(just, edges)) controlIndex = Math.max(0, controlIndex - 1);
    if (rightPressed(just, edges)) controlIndex = Math.min(23, controlIndex + 1);
    if (upPressed(just, edges)) controlIndex = Math.max(0, controlIndex - 6);
    if (downPressed(just, edges)) controlIndex = Math.min(23, controlIndex + 6);
    if (confirmPressed(just, edges)) remap = true;
    if (just.has("KeyR")) {
      settings.bindings = defaultSettings().bindings;
      persist();
      note("Controls reset");
    }
    if (just.has("Escape") || edges.some((pad) => pad.buttons[1])) phase = controlsBack;
  }

  function handlePause(just, edges) {
    if (upPressed(just, edges)) menuIndex = (menuIndex + 3) % 4;
    if (downPressed(just, edges)) menuIndex = (menuIndex + 1) % 4;
    if (just.has("Escape") || edges.some((pad) => pad.buttons[9])) {
      phase = pausedFrom;
      return;
    }
    if (!confirmPressed(just, edges)) return;
    if (menuIndex === 0) phase = pausedFrom;
    else if (menuIndex === 1) openSettings("pause");
    else if (menuIndex === 2) openControls("pause");
    else {
      phase = "title";
      menuIndex = 0;
    }
  }

  function handle(just, edges) {
    audio.unlock();
    if (just.has("KeyM") && !remap) {
      settings.muted = !settings.muted;
      persist();
      note(settings.muted ? "Muted" : "Sound on");
    }
    if (phase === "title") {
      if (downPressed(just, edges)) menuIndex = 1;
      if (upPressed(just, edges)) menuIndex = 0;
      const start = confirmPressed(just, edges) || just.has("NumpadEnter") || edges.some((pad) => pad.buttons[9]);
      if (start) {
        if (menuIndex === 0) {
          phase = "join";
        } else openSettings("title");
      }
      return;
    }
    if (phase === "join") {
      if (just.has("Escape") || edges.some((pad) => pad.buttons[1])) {
        phase = "title";
        menuIndex = 0;
        return;
      }
      if (just.has("Tab")) {
        openSettings("join");
        return;
      }
      for (let i = 0; i < 4; i += 1) {
        const bind = settings.bindings[i];
        if (just.has(bind.action) || (edges[i] && edges[i].buttons[0])) slots[i].mode = "human";
        else if (just.has(bind.secondary) || (edges[i] && edges[i].buttons[1])) {
          slots[i].mode = slots[i].mode === "bot" ? "off" : "bot";
        }
      }
      if (just.has("Enter") || just.has("Space") || edges.some((pad) => pad.buttons[9])) startMatch();
      return;
    }
    if (phase === "settings") return handleSettings(just, edges);
    if (phase === "controls") return handleControls(just, edges);
    if (phase === "pause") return handlePause(just, edges);
    if (phase === "countdown" || phase === "race" || phase === "round") {
      if (just.has("Escape") || edges.some((pad) => pad.buttons[9])) {
        pausedFrom = phase;
        phase = "pause";
        menuIndex = 0;
        return;
      }
      if (phase === "round" && (confirmPressed(just, edges) || just.has("NumpadEnter"))) banner = 0;
      return;
    }
    if (phase === "match") {
      if (downPressed(just, edges)) menuIndex = 1;
      if (upPressed(just, edges)) menuIndex = 0;
      if (just.has("Escape") || edges.some((pad) => pad.buttons[1])) {
        phase = "title";
        menuIndex = 0;
        return;
      }
      const go = confirmPressed(just, edges) || just.has("NumpadEnter") || edges.some((pad) => pad.buttons[9]);
      if (!go) return;
      if (menuIndex === 0) startMatch();
      else {
        phase = "title";
        menuIndex = 0;
      }
    }
  }

  function raceInputs() {
    const mapped = mapPlayers({ keys: input.keys, pads: lastPads, bindings: settings.bindings });
    return mapped.map((action, index) => {
      const player = match.race.players[index];
      if (!player || player.mode === "off") return blankActions();
      if (action.usingGamepad || player.mode === "human") return action;
      return undefined;
    });
  }

  function onRaceEvent(event) {
    if (event.type === "stun" || event.type === "hit" || event.type === "bump") shake = Math.min(1, shake + 0.35);
    audio.sfx(event.type);
  }

  function spawnDust() {
    const race = match?.race;
    if (!race) return;
    for (const player of race.players) {
      if (player.state !== "racing" || player.z > 2) continue;
      const mark = Math.floor(player.y / 24);
      if (mark === dustMark[player.id]) continue;
      dustMark[player.id] = mark;
      particles.push({ x: player.x - 8, y: player.y - 16, life: 0.35, max: 0.35 });
      if (particles.length > 80) particles.shift();
    }
  }

  function simulate(dt) {
    shake = Math.max(0, shake - dt * 2);
    if (phase === "countdown" && match) {
      const prev = countdown;
      countdown -= dt;
      if (prev > 2 && countdown <= 2) audio.countdown(2);
      if (prev > 1 && countdown <= 1) audio.countdown(1);
      if (countdown <= 0) {
        phase = "race";
        audio.go();
      }
    } else if (phase === "race" && match) {
      stepMatch(match, raceInputs(), dt);
      for (const event of match.race.events) onRaceEvent(event);
      spawnDust();
      if (match.phase === "between") {
        phase = "round";
        banner = 4.4;
        audio.roundWin();
      }
    } else if (phase === "round") {
      banner -= dt;
      if (banner <= 0) advance();
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      particles[i].life -= dt;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }

  function activate(id) {
    audio.unlock();
    if (id === "start") {
      phase = "join";
      return;
    }
    if (id === "settings" || id === "pause-settings") {
      openSettings(id === "settings" ? (phase === "pause" ? "pause" : phase) : "pause");
      return;
    }
    if (id === "go") {
      startMatch();
      return;
    }
    if (id.startsWith("card-")) {
      const index = Number(id.slice(5));
      const order = ["bot", "human", "off"];
      slots[index].mode = order[(order.indexOf(slots[index].mode) + 1) % order.length];
      return;
    }
    if (id === "resume") phase = pausedFrom;
    else if (id === "pause-controls") openControls("pause");
    else if (id === "quit" || id === "title") {
      phase = "title";
      menuIndex = 0;
    } else if (id === "vol-left" || id === "volume") {
      if (id === "volume") menuIndex = 0;
      else {
        settings.volume = Math.round(Math.max(0, settings.volume - 0.1) * 10) / 10;
        persist();
      }
    } else if (id === "vol-right") {
      settings.volume = Math.round(Math.min(1, settings.volume + 0.1) * 10) / 10;
      persist();
    } else if (id === "rounds-left" || id === "rounds") {
      if (id === "rounds") menuIndex = 1;
      else {
        settings.rounds = Math.max(1, settings.rounds - 1);
        persist();
      }
    } else if (id === "rounds-right") {
      settings.rounds = Math.min(8, settings.rounds + 1);
      persist();
    } else if (id === "open-controls") openControls("settings");
    else if (id === "settings-back") phase = settingsBack;
    else if (id === "controls-back") phase = controlsBack;
    else if (id === "reset") {
      settings.bindings = defaultSettings().bindings;
      persist();
    } else if (id.startsWith("bind-")) {
      controlIndex = Number(id.slice(5));
      remap = true;
    } else if (id === "continue") banner = 0;
    else if (id === "rematch") startMatch();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * VIEW_W) / rect.width;
    const y = ((event.clientY - rect.top) * VIEW_H) / rect.height;
    const region = regions.slice().reverse().find((item) => x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
    if (region) activate(region.id);
    else if (phase === "title") phase = "join";
    canvas.focus();
  });

  function frame(now) {
    if (!last) last = now;
    const raw = Math.min(0.25, (now - last) / 1000);
    last = now;
    uiTime += raw;

    const pads = input.pads();
    const edges = rising(pads, prevButtons);
    prevButtons = pads.map((pad) => pad.buttons.slice());
    lastPads = pads;
    const just = input.consumeJust();

    audio.setVolume(settings.volume);
    audio.setLive(!settings.muted && simRate <= 1);
    if (!settings.muted && simRate <= 1) audio.ensureTheme();

    handle(just, edges);

    acc += raw * simRate;
    let steps = 0;
    const cap = simRate > 1 ? 4000 : 8;
    while (acc >= DT && steps < cap) {
      simulate(DT);
      acc -= DT;
      steps += 1;
    }
    if (steps >= cap) acc = 0;

    const mapped = mapPlayers({ keys: input.keys, pads, bindings: settings.bindings });
    const view = {
      phase,
      menuIndex,
      slots: slots.map((slot) => slot.mode),
      bindings: settings.bindings,
      settings,
      match,
      race: match ? match.race : null,
      countdown,
      standings: match ? standings(match) : [],
      usingGamepad: mapped.map((action) => action.usingGamepad),
      uiTime,
      shake,
      particles,
      cover,
      icon,
      controlIndex,
      remap,
      message: uiTime < messageUntil ? message : "",
      regions: [],
    };
    render(ctx, view);
    regions = view.regions;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
