import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from "./config.js";

const LOCAL_AI_DEFAULTS = {
  provider: "nanogpt",
  baseUrl: "https://nano-gpt.com/api/v1",
  model: "deepseek/deepseek-latest",
};

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

export function canUseAi(settings = loadAiSettings()) {
  return settings.mode === "proxy" || Boolean(settings.apiKey);
}

function normalizeAiSettings(settings) {
  const apiKey = String(settings.apiKey || "").trim();
  const mode = apiKey ? "local" : "proxy";
  return {
    ...DEFAULT_AI_SETTINGS,
    ...settings,
    mode,
    provider: settings.provider || (mode === "local" ? LOCAL_AI_DEFAULTS.provider : DEFAULT_AI_SETTINGS.provider),
    baseUrl: String(settings.baseUrl || (mode === "local" ? LOCAL_AI_DEFAULTS.baseUrl : DEFAULT_AI_SETTINGS.baseUrl)).replace(/\/+$/, ""),
    model: String(settings.model || (mode === "local" ? LOCAL_AI_DEFAULTS.model : DEFAULT_AI_SETTINGS.model)).trim(),
    apiKey,
  };
}
