import { chatJson } from "./ai-client.js";
import { normalizeText } from "./utils.js";

let nutritionBase = null;
let nutritionBaseLoadStarted = false;

export function getNutritionBase() {
  return nutritionBase;
}

export async function loadNutritionBase() {
  if (nutritionBase) return nutritionBase;
  const response = await fetch("data/nutrition/app-nutrition.pt.clean.json");
  if (!response.ok) throw new Error("Não foi possível carregar a base nutricional.");
  nutritionBase = await response.json();
  return nutritionBase;
}

export function preloadNutritionCatalog(onLoaded, onError) {
  if (nutritionBase || nutritionBaseLoadStarted) return;
  nutritionBaseLoadStarted = true;
  loadNutritionBase()
    .then(() => onLoaded?.())
    .catch((error) => onError?.(error));
}

export function displayNutritionName(item) {
  return item?.names?.pt || item?.name || item?.id || "";
}

export function nutritionAliasValues(item) {
  const values = [
    item?.names?.pt,
    item?.name,
    item?.names?.en,
    ...(item?.aliases || []).map((alias) => typeof alias === "string" ? alias : alias?.value),
  ].filter(Boolean);

  return [...new Set(values)];
}

export function normalizeIngredientUnit(unit) {
  const normalized = normalizeText(unit || "g");
  const unitMap = {
    g: "g",
    gram: "g",
    gr: "g",
    kg: "kg",
    kilogram: "kg",
    ml: "ml",
    milliliter: "ml",
    l: "L",
    liter: "L",
    litre: "L",
    stuk: "unidade",
    stuks: "unidade",
    unidade: "unidade",
    unidades: "unidade",
  };
  return unitMap[normalized] || "g";
}

export function scaleNutrition(nutrition, referenceAmount) {
  const qty = Number(referenceAmount?.quantity || 1);
  const scale = qty > 0 ? qty : 1;
  return {
    kcal: (nutrition?.kcal || 0) / scale,
    protein: (nutrition?.protein || 0) / scale,
    carbs: (nutrition?.carbs || 0) / scale,
    fat: (nutrition?.fat || 0) / scale,
  };
}

export function findNutritionItemById(id) {
  return nutritionBase?.items?.find((current) => current.id === id) || null;
}

export function findNutritionItemByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  return nutritionBase?.items?.find((item) => normalizeText(displayNutritionName(item)) === normalized) || null;
}

function canonicalIngredientName(name) {
  let normalized = ` ${normalizeText(name)} `;
  const replacements = [
    [/\btortilla\b/g, " tortilha "],
    [/\btortilha de trigo\b/g, " tortilha "],
    [/\bwraps?\b/g, " tortilha "],
    [/\bsoy sauce\b/g, " molho de soja "],
    [/\bshoyu\b/g, " molho de soja "],
    [/\bheinz ketchup\b/g, " ketchup "],
    [/\bchicken breast\b/g, " peito de frango "],
    [/\bfrango peito\b/g, " peito de frango "],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/\b(de|do|da|dos|das|com|em|ao|a|o|e)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasModifierConflict(left, right) {
  const groups = [
    ["cru", "raw"],
    ["cozido", "cooked"],
    ["frito", "fried"],
    ["grelhado", "grilled"],
    ["assado", "roasted"],
    ["integral", "whole"],
    ["normal", "regular"],
    ["light"],
    ["zero"],
    ["diet"],
    ["sem acucar", "sugar free"],
    ["com acucar", "sweetened"],
  ];

  const leftTerms = groups.map((group) => group.some((term) => left.includes(term)));
  const rightTerms = groups.map((group) => group.some((term) => right.includes(term)));
  return leftTerms.some((hasTerm, index) => hasTerm !== rightTerms[index] && (hasTerm || rightTerms[index]));
}

function stockItemNames(item) {
  return [
    item?.name,
    item?.names?.pt,
    item?.names?.en,
    ...(item?.aliases || []).map((alias) => typeof alias === "string" ? alias : alias?.value),
  ].filter(Boolean);
}

function findIngredientNameMatchLocal(items, name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  const exact = items.find((item) => stockItemNames(item).some((value) => normalizeText(value) === normalized));
  if (exact) return { item: exact, type: "exact" };

  const canonical = canonicalIngredientName(name);
  const similar = items.find((item) => stockItemNames(item).some((value) => {
    const existing = normalizeText(value);
    const existingCanonical = canonicalIngredientName(value);
    if (!existingCanonical || hasModifierConflict(existing, normalized)) return false;
    return (
      existingCanonical === canonical ||
      existingCanonical.includes(canonical) ||
      canonical.includes(existingCanonical)
    );
  }));

  return similar ? { item: similar, type: "similar" } : null;
}

function ingredientMatchCandidates(items, name, limit = 160) {
  const normalized = normalizeText(name);
  const canonical = canonicalIngredientName(name);
  return items
    .filter((item) => item?.id && item?.name)
    .map((item) => {
      const names = stockItemNames(item);
      const text = names.map(normalizeText).join(" ");
      const canonicalText = names.map(canonicalIngredientName).join(" ");
      let score = 0;
      if (text.includes(normalized) || normalized.includes(text)) score += 6;
      if (canonicalText.includes(canonical) || canonical.includes(canonicalText)) score += 5;
      for (const token of canonical.split(" ").filter((part) => part.length > 2)) {
        if (canonicalText.includes(token)) score += 1;
      }
      return { item, score };
    })
    .sort((left, right) => right.score - left.score || String(left.item.name).localeCompare(String(right.item.name)))
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      name: item.name,
      unit: item.unit || "",
      aliases: stockItemNames(item).filter((value) => value !== item.name).slice(0, 8),
    }));
}

async function findIngredientNameMatchWithAi(items, name, aiSettings) {
  if (!aiSettings?.apiKey) return null;

  const candidates = ingredientMatchCandidates(items, name);
  if (!candidates.length) return null;

  const aiResponse = await chatJson({
    settings: aiSettings,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "Voce compara nomes de ingredientes para evitar duplicatas em um catalogo alimentar. Responda somente JSON valido.",
      },
      {
        role: "user",
        content: `Ingrediente novo: "${name}".

Compare com os ingredientes existentes abaixo e diga se algum representa o mesmo alimento base.
Considere sinonimos, nomes regionais, traducoes, marcas usadas como nome comum e formas como singular/plural.
Exemplos de mesmo item: "tortilha" e "wrap"; "shoyu" e "molho de soja"; "peito de frango" e "chicken breast".
Nao marque como igual quando forem alimentos relacionados mas diferentes, variacoes nutricionalmente importantes, preparo diferente ou modificadores conflitantes: cru/cozido/frito, integral/normal, light/zero/diet, com/sem acucar.

Ingredientes existentes:
${JSON.stringify(candidates)}

Responda exatamente neste formato:
{
  "sameIngredient": false,
  "itemId": "",
  "confidence": 0,
  "reason": ""
}`,
      },
    ],
  });

  if (!aiResponse?.sameIngredient || !aiResponse?.itemId || Number(aiResponse.confidence || 0) < 0.78) {
    return null;
  }

  const item = items.find((current) => current?.id === aiResponse.itemId);
  if (!item) return null;

  const existing = normalizeText(stockItemNames(item).join(" "));
  const normalized = normalizeText(name);
  if (hasModifierConflict(existing, normalized)) return null;

  return {
    item,
    type: "ai",
    confidence: Number(aiResponse.confidence || 0),
    reason: String(aiResponse.reason || "").slice(0, 180),
  };
}

export async function findIngredientNameMatch(items, name, aiSettings) {
  const local = findIngredientNameMatchLocal(items, name);
  if (local || !aiSettings?.apiKey) return local;
  try {
    return await findIngredientNameMatchWithAi(items, name, aiSettings);
  } catch (error) {
    console.warn("AI ingredient name match failed:", error);
    return null;
  }
}

export async function resolveIngredientNutrition({ name, unit, aiSettings }) {
  let nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let nutritionSource = "default_empty";

  const base = await loadNutritionBase().catch((error) => {
    console.warn("Local nutrition base search failed:", error);
    return null;
  });

  const matchedLocal = base?.items?.find((item) => normalizeText(displayNutritionName(item)) === normalizeText(name));
  if (matchedLocal) {
    return {
      nutrition: scaleNutrition(matchedLocal.nutrition, matchedLocal.referenceAmount),
      nutritionSource: matchedLocal.source || "local_base",
      matchedLocal,
      sourceType: "local",
    };
  }

  if (!aiSettings?.apiKey) {
    return { nutrition, nutritionSource, matchedLocal: null, sourceType: "empty" };
  }

  const promptContent = `Estime a informação nutricional para o ingrediente "${name}" com a unidade "${unit}".
Se a unidade for "g" ou "ml", forneça os valores de referência para 100g ou 100ml respectivamente.
Se a unidade for "unidade", "fatia", ou outra unidade de medida que não seja de massa/volume direto, forneça os valores para 1 unidade (por exemplo, 1 ovo, 1 fatia de pão).

Responda SOMENTE com um objeto JSON válido, sem explicações, seguindo exatamente este formato:
{
  "referenceAmount": {
    "quantity": 100,
    "unit": "${unit}"
  },
  "nutrition": {
    "kcal": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  }
}`;

  const aiResponse = await chatJson({
    settings: aiSettings,
    temperature: 0.1,
    messages: [
      { role: "system", content: "Você é um assistente especialista em nutrição e tabelas de alimentos. Sempre retorne dados em JSON." },
      { role: "user", content: promptContent },
    ],
  });

  if (aiResponse?.nutrition) {
    nutrition = scaleNutrition(aiResponse.nutrition, aiResponse.referenceAmount);
    nutritionSource = "ai_estimate";
  }

  return { nutrition, nutritionSource, matchedLocal: null, sourceType: "ai" };
}
