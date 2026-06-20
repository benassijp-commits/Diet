export const STORE_KEY = "joao-diet-app-v2";
export const LEGACY_STORE_KEY = "joao-diet-app-v1";
export const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const DAILY_TARGETS = {
  kcal: 2400,
  protein: 202,
  carbs: 241,
  fat: 68,
};

export const AI_SETTINGS_KEY = "joao-diet-ai-settings-v1";

export const DEFAULT_AI_SETTINGS = {
  provider: "nanogpt",
  baseUrl: "https://nano-gpt.com/api/v1",
  model: "deepseek/deepseek-chat",
};
