import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from "./config.js";

export function loadAiSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) || "{}");
    return normalizeAiSettings(saved);
  } catch {
    return normalizeAiSettings({});
  }
}

export function saveAiSettings(settings) {
  const next = normalizeAiSettings(settings);
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function clearAiSettings() {
  localStorage.removeItem(AI_SETTINGS_KEY);
}

export function hasAiKey(settings = loadAiSettings()) {
  return Boolean(settings.apiKey);
}

function normalizeAiSettings(settings) {
  return {
    ...DEFAULT_AI_SETTINGS,
    ...settings,
    baseUrl: String(settings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl).replace(/\/+$/, ""),
    model: String(settings.model || DEFAULT_AI_SETTINGS.model).trim(),
    apiKey: String(settings.apiKey || "").trim(),
  };
}
