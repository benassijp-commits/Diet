import { chatJson } from "./ai-client.js";
import { normalizeText } from "./utils.js";

let nutritionBase = null;
let nutritionBaseLoadStarted = false;

export function getNutritionBase() {
  return nutritionBase;
}

export async function loadNutritionBase() {
  if (nutritionBase) return nutritionBase;
  let response = await fetch("data/nutrition/app-nutrition.multilang.json");
  if (!response.ok) response = await fetch("data/nutrition/app-nutrition.pt.clean.json");
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
    ...(item?.aliasesByLanguage?.pt || []),
    ...(item?.aliasesByLanguage?.en || []),
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
  return nutritionBase?.items?.find((item) => nutritionAliasValues(item).some((value) => normalizeText(value) === normalized)) || null;
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
    ...(item?.aliasesByLanguage?.pt || []),
    ...(item?.aliasesByLanguage?.en || []),
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
        content: "Você compara nomes de alimentos para evitar duplicatas em um catálogo nutricional. Seja generalista e prático: o objetivo é reutilizar um alimento existente quando ele representa o mesmo alimento base para fins de dieta, estoque e cálculo nutricional. Responda somente JSON válido.",
      },
      {
        role: "user",
        content: `Ingrediente novo: "${name}".

        Compare com os ingredientes existentes abaixo e diga se algum deles representa essencialmente o mesmo alimento base.

        Critério principal:
        - Prefira reutilizar um ingrediente existente quando a diferença for apenas nome comercial, marca, idioma, plural/singular, tamanho, descrição de coach, forma genérica de preparo, ou detalhe que não muda de forma relevante os macros usados no app.
        - Considere equivalências entre português, inglês e nomes comuns de mercado.
        - Considere marcas como descrição secundária quando o alimento base estiver claro.
        - Considere nomes compostos ou alternativos como possíveis equivalentes quando o alimento principal for o mesmo.
        - Seja especialmente cuidadoso para não criar duplicatas por causa de descrições longas.

        Quando NÃO considerar igual:
        - Se a diferença muda claramente os macros de forma importante e o catálogo já possui essa distinção relevante.
        - Exemplos de diferenças potencialmente relevantes: cru vs cozido, frito vs cozido/grelhado, integral vs branco, light/zero/diet vs normal, com açúcar vs sem açúcar, tipo de leite, tipo de carne, versão proteica, produto seco vs preparado.
        - Porém, se o novo nome vier como alternativa ambígua ou composta, por exemplo "branco/integral", "cozido ou preparado", "legumes variados", "arroz variado", escolha o melhor item genérico existente em vez de criar duplicata desnecessária.

        Importante:
        - Não se limite aos exemplos acima. Use julgamento semântico geral.
        - Não retorne match com baixa confiança.
        - Se houver dúvida real entre dois alimentos nutricionalmente diferentes, retorne sameIngredient false.
        - Se houver um item genérico existente adequado, prefira ele a criar um novo item muito específico.

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

  const matchedLocal = base?.items?.find((item) => nutritionAliasValues(item).some((value) => normalizeText(value) === normalizeText(name)));
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

    Objetivo:
    Retornar valores nutricionais realistas para uso em um app de dieta. Não retorne valores zerados para alimentos reais.

    Regras:
    - Se a unidade for "g", retorne valores por 100 g.
    - Se a unidade for "ml", retorne valores por 100 ml.
    - Se a unidade for "unidade", "fatia", "porção" ou similar, retorne valores para 1 unidade média realista.
    - Se o nome for genérico, use uma estimativa média comum.
    - Se o nome tiver marca, use o alimento base quando não souber a marca exata.
    - Se o alimento for uma mistura genérica, use média plausível.
    - Nunca responda com kcal/protein/carbs/fat todos zerados para alimentos reais.
    - Só é aceitável kcal 0 quando o item for claramente água, bebida sem calorias, sal, adoçante sem calorias, tempero sem calorias relevantes ou similar.
    - Se não souber o valor exato, estime com base em tabelas nutricionais comuns. Não deixe em zero.

    Formato obrigatório:
    Responda SOMENTE com um objeto JSON válido, sem markdown e sem explicações.

    Use este formato:
    {
      "referenceAmount": {
        "quantity": 100,
        "unit": "${unit}"
      },
      "nutrition": {
        "kcal": "number",
        "protein": "number",
        "carbs": "number",
        "fat": "number"
      }
    }

    Atenção:
    - Os campos de nutrition devem ser números, não strings.
    - Não copie os placeholders.
    - Não use null.
    - Não omita nenhum campo.
    - Não retorne todos os macros como 0 para alimento real.`;

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
