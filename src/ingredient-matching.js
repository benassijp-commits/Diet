import { allIngredientCatalogItems, ingredientSearchText } from "./state/app-state.js";
import { normalizeText } from "./utils.js";

const CONNECTOR_TOKENS = new Set(["de", "da", "do", "das", "dos", "em", "com", "e", "of", "with", "and"]);

export function hasValidNutrition(item) {
  const nutrition = item?.nutrition || {};
  return ["kcal", "protein", "carbs", "fat"].some((key) => Number(nutrition[key] || 0) > 0)
    && item?.nutritionSource !== "import_placeholder"
    && item?.nutritionStatus !== "missing"
    && item?.needsReview !== true;
}

export function resolveIngredientMatch(label, state, options = {}) {
  const normalized = normalizeText(label);
  if (!normalized) return null;

  const items = options.items || allIngredientCatalogItems(state);
  const labelTokens = relevantTokens(label);
  const candidates = items
    .filter((item) => item?.id)
    .map((item) => scoreIngredientCandidate(item, normalized, labelTokens))
    .filter(Boolean)
    .sort(compareIngredientMatches);

  return candidates[0] || null;
}

function scoreIngredientCandidate(item, normalizedLabel, labelTokens) {
  const values = ingredientMatchValues(item);
  const exact = values.some((value) => value.normalized === normalizedLabel);
  if (exact) {
    return {
      item,
      confidence: "exact",
      score: 100,
      needsReview: false,
      reason: "exact",
    };
  }

  if (labelTokens.length === 1) return scoreSingleTokenCandidate(item, labelTokens[0], values);
  if (labelTokens.length < 2) return null;

  let best = null;
  for (const value of values) {
    const candidateTokens = relevantTokens(value.text);
    if (candidateTokens.length < 2) continue;

    const overlap = labelTokens.filter((token) => candidateTokens.includes(token)).length;
    const shorter = Math.min(labelTokens.length, candidateTokens.length);
    const longer = Math.max(labelTokens.length, candidateTokens.length);
    const coversShorter = overlap >= shorter;
    const ratio = overlap / longer;
    const strong = overlap >= 2 && coversShorter;
    const probable = overlap >= 2 && ratio >= 0.6;
    if (!strong && !probable) continue;

    const score = (strong ? 80 : 55) + overlap + (hasValidNutrition(item) ? 8 : 0);
    if (!best || score > best.score) {
      best = {
        item,
        confidence: strong ? "strong" : "probable",
        score,
        needsReview: !strong,
        reason: strong ? "token-strong" : "token-probable",
      };
    }
  }

  return best;
}

function scoreSingleTokenCandidate(item, token, values) {
  if (!hasValidNutrition(item)) return null;
  let score = 45;
  const tokenMatch = values.some((value) => {
    const tokens = relevantTokens(value.text);
    if (tokens[0] === token) score = Math.max(score, 52);
    return tokens.includes(token);
  });
  if (!tokenMatch) return null;
  return {
    item,
    confidence: "probable",
    score: 45,
    needsReview: true,
    reason: "single-token-probable",
  };
}

function ingredientMatchValues(item) {
  const values = [
    item?.name,
    item?.names?.pt,
    item?.names?.en,
    ingredientSearchText(item, "pt"),
    ingredientSearchText(item, "en"),
    ...(item?.aliasesByLanguage?.pt || []),
    ...(item?.aliasesByLanguage?.en || []),
    ...(item?.aliases || []).map((alias) => typeof alias === "string" ? alias : alias?.value),
  ].filter(Boolean);

  const seen = new Set();
  return values.flatMap((value) => String(value).split("|")).map((text) => ({
    text: text.trim(),
    normalized: normalizeText(text),
  })).filter((value) => {
    if (!value.text || !value.normalized || seen.has(value.normalized)) return false;
    seen.add(value.normalized);
    return true;
  });
}

function relevantTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !CONNECTOR_TOKENS.has(token));
}

function compareIngredientMatches(left, right) {
  const leftNutrition = hasValidNutrition(left.item) ? 1 : 0;
  const rightNutrition = hasValidNutrition(right.item) ? 1 : 0;
  if (rightNutrition !== leftNutrition) return rightNutrition - leftNutrition;
  return right.score - left.score || String(left.item.name || "").localeCompare(String(right.item.name || ""));
}
