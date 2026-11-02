import { DEFAULT_ROUNDS } from "../core/constants.js";
import { defaultBindings, sanitizeBindings } from "../core/input.js";

export const SETTINGS_KEY = "gobbler-gauntlet-settings-v1";

export function defaultSettings() {
  return {
    volume: 0.8,
    muted: false,
    rounds: DEFAULT_ROUNDS,
    bindings: defaultBindings(),
  };
}

export function sanitizeSettings(raw) {
  const defaults = defaultSettings();
  const source = raw && typeof raw === "object" ? raw : {};
  const volume = Number(source.volume);
  const rounds = Number(source.rounds);
  return {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : defaults.volume,
    muted: !!source.muted,
    rounds: Number.isFinite(rounds) ? Math.min(8, Math.max(1, Math.round(rounds))) : defaults.rounds,
    bindings: sanitizeBindings(source.bindings),
  };
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    if (!storage) return defaultSettings();
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  const clean = sanitizeSettings(settings);
  if (storage) storage.setItem(SETTINGS_KEY, JSON.stringify(clean));
  return clean;
}
