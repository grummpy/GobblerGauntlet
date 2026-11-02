import { PLACE_POINTS } from "./constants.js";
import { generateCourse } from "./course.js";
import { mixSeed } from "./rng.js";
import { createRace, stepRace } from "./race.js";

export function computeWinners(match) {
  const active = [];
  for (let i = 0; i < match.slots.length; i += 1) {
    if (match.slots[i].mode !== "off") active.push(i);
  }
  if (!active.length) return [];
  let bestScore = -1;
  let bestFirsts = -1;
  for (const id of active) {
    const score = match.scores[id];
    const firsts = match.firsts[id];
    if (score > bestScore || (score === bestScore && firsts > bestFirsts)) {
      bestScore = score;
      bestFirsts = firsts;
    }
  }
  return active.filter((id) => match.scores[id] === bestScore && match.firsts[id] === bestFirsts);
}

export function standings(match) {
  const rows = match.scores.map((score, id) => ({
    id,
    score,
    firsts: match.firsts[id],
    mode: match.slots[id].mode,
  }));
  rows.sort((a, b) => b.score - a.score || b.firsts - a.firsts || a.id - b.id);
  return rows;
}

function settle(match) {
  const race = match.race;
  if (!race || race.settled) return;
  race.settled = true;
  const places = [];
  for (const player of race.players) {
    const place = player.finishPlace || 0;
    places.push({
      id: player.id,
      place,
      state: player.state,
      mode: player.mode,
    });
    if (place >= 1 && place <= 4) {
      match.scores[player.id] += PLACE_POINTS[place];
      if (place === 1) match.firsts[player.id] += 1;
    }
  }
  match.history.push(places);
  match.lastPlaces = places;
}

export function createMatch({ seed, rounds = 4, slots }) {
  const match = {
    seed: seed >>> 0,
    rounds,
    roundIndex: 0,
    scores: [0, 0, 0, 0],
    firsts: [0, 0, 0, 0],
    slots: slots.map((slot) => ({ mode: slot.mode })),
    history: [],
    lastPlaces: null,
    race: null,
    phase: "racing",
    winners: [],
  };
  beginRound(match);
  return match;
}

export function beginRound(match) {
  const course = generateCourse(mixSeed(match.seed, match.roundIndex));
  match.race = createRace(course, match.slots);
  match.phase = "racing";
  return match.race;
}

export function stepMatch(match, inputs, dt) {
  if (match.phase !== "racing" || !match.race) return match;
  stepRace(match.race, inputs, dt);
  if (match.race.phase === "done") {
    settle(match);
    match.phase = "between";
  }
  return match;
}

/** Leave the round banner. Returns 'racing' or 'complete'. */
export function acknowledgeRace(match) {
  if (match.phase !== "between") return match.phase === "complete" ? "complete" : match.phase;
  if (match.roundIndex + 1 >= match.rounds) {
    match.phase = "complete";
    match.winners = computeWinners(match);
    return "complete";
  }
  match.roundIndex += 1;
  beginRound(match);
  return "racing";
}
