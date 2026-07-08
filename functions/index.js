import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const aiApiKey = defineSecret("AI_API_KEY");
const usdaApiKey = defineSecret("USDA_API_KEY");
const DEFAULT_AI_BASE_URL = "https://nano-gpt.com/api/v1";
const DEFAULT_AI_MODEL = "deepseek/deepseek-latest";
const SCHEDULED_NOTIFICATION_LIMIT = 100;
const GLOBAL_FOOD_COLLECTION = "globalFoods";
const RESOLVE_CONFIDENCE_APPROVED = 0.88;
const RESOLVE_CONFIDENCE_REVIEW = 0.70;
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const firestore = getFirestore();
const messaging = getMessaging();

export const aiProxy = onCall(
  {
    secrets: [aiApiKey],
    cors: true,
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before using AI.");
    }

    const messages = validateMessages(request.data?.messages);
    const temperature = normalizeTemperature(request.data?.temperature);
    const apiKey = readAiApiKey();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "AI_API_KEY is not configured.");
    }

    const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL);
    const model = String(process.env.AI_MODEL || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new HttpsError("internal", `AI request failed (${response.status}). ${detail.slice(0, 180)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new HttpsError("internal", "AI response did not include content.");
    }

    try {
      return JSON.parse(stripCodeFence(content));
    } catch {
      throw new HttpsError("internal", "AI response was not valid JSON.");
    }
  },
);

export const resolveIngredientNutrition = onCall(
  {
    secrets: [aiApiKey, usdaApiKey],
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before resolving nutrition.");
    }

    const input = validateResolveIngredientInput(request.data || {});
    const existingFood = await findExistingGlobalFood(input.label);
    if (existingFood) {
      return existingFood.status === "approved"
        ? resolveResponse("resolved_existing", existingFood, false)
        : reviewResponse(existingFood, Number(existingFood.confidence || 0));
    }

    const apiKey = readUsdaApiKey();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "USDA_API_KEY is not configured.");
    }

    const candidates = await searchUsdaFoodCandidates(input.label, apiKey);
    if (!candidates.length) {
      return unresolvedResponse("no_external_candidates");
    }

    const selection = await selectNutritionCandidateWithAi(input, candidates);
    const selected = candidates.find((candidate) => candidate.externalSourceId === selection.selectedExternalId);
    const confidence = normalizeConfidence(selection.confidence);
    if (!selected || confidence < RESOLVE_CONFIDENCE_REVIEW) {
      return unresolvedResponse("low_confidence", { confidence, candidates: candidates.slice(0, 5) });
    }

    const selectedFood = foodCandidateToGlobalFood(selected, input, selection, confidence);
    const dedupedFood = await findExistingGlobalFood(input.label, selectedFood);
    if (dedupedFood) {
      await addGlobalFoodAlias(dedupedFood.id, input.label, input.language);
      return dedupedFood.status === "approved" && confidence >= RESOLVE_CONFIDENCE_APPROVED
        ? resolveResponse("resolved_existing", dedupedFood, false)
        : reviewResponse(dedupedFood, confidence);
    }

    const status = confidence >= RESOLVE_CONFIDENCE_APPROVED ? "approved" : "needs_review";
    const docRef = firestore.collection(GLOBAL_FOOD_COLLECTION).doc(selectedFood.id);
    await docRef.set({
      ...selectedFood,
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (status !== "approved") {
      return reviewResponse({ ...selectedFood, status }, confidence);
    }
    return resolveResponse("resolved_created", { ...selectedFood, status }, true);
  },
);

export const processScheduledNotifications = onSchedule("every 1 minutes", async () => {
  const now = Timestamp.now();
  const snapshot = await firestore.collectionGroup("scheduledNotifications")
    .where("status", "==", "pending")
    .where("dueAt", "<=", now)
    .orderBy("dueAt", "asc")
    .limit(SCHEDULED_NOTIFICATION_LIMIT)
    .get();

  let sent = 0;
  let failed = 0;
  const typeCounts = {};

  for (const notificationDoc of snapshot.docs) {
    const uid = notificationDoc.ref.parent.parent?.id;
    const notification = notificationDoc.data();
    const type = String(notification.type || "unknown");
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    if (!uid) {
      failed += 1;
      await markNotificationFailed(notificationDoc.ref, "missing-user");
      continue;
    }

    try {
      const targetToken = String(notification.targetToken || "").trim();
      const targetTokenId = String(notification.targetTokenId || "").trim();
      const title = String(notification.title || "Lembrete");
      const body = String(notification.body || "");
      const dedupeKey = String(notification.dedupeKey || "");
      const tokens = targetToken
        ? [{ ref: targetTokenId ? firestore.collection("users").doc(uid).collection("notificationTokens").doc(targetTokenId) : null, token: targetToken }]
        : await getEnabledNotificationTokens(uid);

      if (!tokens.length) {
        await markNotificationFailed(notificationDoc.ref, "no-active-token");
        failed += 1;
        continue;
      }

      const response = await messaging.sendEachForMulticast({
        tokens: tokens.map((item) => item.token),
        notification: {
          title,
          body,
        },
        data: {
          type,
          notificationId: notificationDoc.id,
          dedupeKey,
          title,
          body,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "reminders",
          },
        },
        webpush: {
          notification: {
            title,
            body,
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            tag: dedupeKey || notificationDoc.id,
            renotify: true,
          },
        },
      });

      await markInvalidTokens(tokens, response.responses);
      await notificationDoc.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        delivery: {
          successCount: response.successCount,
          failureCount: response.failureCount,
          targeted: Boolean(targetToken),
        },
      });
      sent += 1;
      console.info("scheduled notification processed", { id: notificationDoc.id, type, success: response.successCount, failure: response.failureCount });
    } catch (error) {
      failed += 1;
      await markNotificationFailed(notificationDoc.ref, error?.code || "send-failed");
      console.warn("scheduled notification failed", { id: notificationDoc.id, type, code: error?.code || "send-failed" });
    }
  }

  console.info("scheduled notifications run complete", {
    processed: snapshot.size,
    sent,
    failed,
    typeCounts,
  });
});

async function getEnabledNotificationTokens(uid) {
  const tokenSnapshot = await firestore.collection("users").doc(uid).collection("notificationTokens")
    .where("enabled", "==", true)
    .limit(500)
    .get();
  return tokenSnapshot.docs
    .map((tokenDoc) => ({ ref: tokenDoc.ref, token: String(tokenDoc.data().token || "") }))
    .filter((item) => item.token);
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 12) {
    throw new HttpsError("invalid-argument", "messages must be a non-empty array.");
  }

  return messages.map((message) => {
    const role = String(message?.role || "").trim();
    const content = String(message?.content || "").trim();
    if (!["system", "user", "assistant"].includes(role) || !content) {
      throw new HttpsError("invalid-argument", "messages contain an invalid role or empty content.");
    }
    if (content.length > 120000) {
      throw new HttpsError("invalid-argument", "message content is too large.");
    }
    return { role, content };
  });
}

function validateResolveIngredientInput(data) {
  const label = String(data?.label || "").trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > 120 || !/[a-zA-ZÀ-ÿ]/.test(label)) {
    throw new HttpsError("invalid-argument", "label must be a valid ingredient name.");
  }

  const qty = Number(data?.qty || 0);
  const unit = String(data?.unit || "g").trim().slice(0, 24) || "g";
  const language = normalizeLanguage(data?.language);
  const mealContext = String(data?.mealContext || "").trim().slice(0, 160);
  return {
    label,
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit,
    language,
    mealContext,
  };
}

async function findExistingGlobalFood(label, candidate = null) {
  const normalizedValues = uniqueNormalized([
    label,
    candidate?.name,
    candidate?.names?.pt,
    candidate?.names?.en,
    ...(candidate?.normalizedNames || []),
    ...(candidate?.aliasesByLanguage?.pt || []),
    ...(candidate?.aliasesByLanguage?.en || []),
  ]);

  if (candidate?.nutritionSource && candidate?.externalSourceId) {
    const externalSnapshot = await firestore.collection(GLOBAL_FOOD_COLLECTION)
      .where("nutritionSource", "==", candidate.nutritionSource)
      .where("externalSourceId", "==", candidate.externalSourceId)
      .limit(1)
      .get();
    if (!externalSnapshot.empty) return snapshotDocToFood(externalSnapshot.docs[0]);
  }

  for (const normalized of normalizedValues.slice(0, 8)) {
    const snapshot = await firestore.collection(GLOBAL_FOOD_COLLECTION)
      .where("normalizedNames", "array-contains", normalized)
      .limit(1)
      .get();
    if (!snapshot.empty) return snapshotDocToFood(snapshot.docs[0]);
  }

  return null;
}

async function searchUsdaFoodCandidates(label, apiKey) {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", label);
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");

  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpsError("internal", `USDA request failed (${response.status}).`);
  }

  const payload = await response.json();
  return (payload.foods || [])
    .map(usdaFoodToCandidate)
    .filter((candidate) => candidate && hasAnyNutrition(candidate.nutrition))
    .slice(0, 8);
}

function usdaFoodToCandidate(food) {
  const nutrition = usdaNutrientsToMacros(food.foodNutrients || []);
  if (!food?.fdcId || !food?.description) return null;
  return {
    externalSourceId: String(food.fdcId),
    externalSourceName: String(food.description || "").trim(),
    externalSourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients`,
    nutrition,
    dataType: food.dataType || "",
    brandOwner: food.brandOwner || "",
  };
}

function usdaNutrientsToMacros(nutrients) {
  const get = (ids, names) => {
    const match = nutrients.find((nutrient) => {
      const id = Number(nutrient.nutrientId || nutrient.nutrientNumber || 0);
      const name = normalizeText(nutrient.nutrientName || nutrient.name || "");
      return ids.includes(id) || names.some((current) => name.includes(current));
    });
    return Number(match?.value || 0);
  };
  return {
    kcal: get([1008], ["energy"]),
    protein: get([1003], ["protein"]),
    carbs: get([1005], ["carbohydrate"]),
    fat: get([1004], ["total lipid", "fat"]),
  };
}

async function selectNutritionCandidateWithAi(input, candidates) {
  const apiKey = readAiApiKey();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "AI_API_KEY is not configured.");
  }

  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || DEFAULT_AI_BASE_URL);
  const model = String(process.env.AI_MODEL || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL;
  const messages = [
    {
      role: "system",
      content: "Voce escolhe o melhor alimento nutricional entre candidatos reais de uma API externa. Nao invente macros. Responda somente JSON valido.",
    },
    {
      role: "user",
      content: JSON.stringify({
        ingredient: input,
        candidates: candidates.map((candidate) => ({
          selectedExternalId: candidate.externalSourceId,
          name: candidate.externalSourceName,
          dataType: candidate.dataType,
          brandOwner: candidate.brandOwner,
          nutritionPer100g: candidate.nutrition,
        })),
        expectedFormat: {
          selectedExternalId: "string",
          confidence: 0,
          canonicalNamePt: "string",
          aliasesPt: ["string"],
          reason: "string curta",
        },
      }),
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new HttpsError("internal", `AI candidate selection failed (${response.status}).`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  try {
    return JSON.parse(stripCodeFence(content));
  } catch {
    throw new HttpsError("internal", "AI candidate selection was not valid JSON.");
  }
}

function foodCandidateToGlobalFood(candidate, input, selection, confidence) {
  const canonicalPt = String(selection.canonicalNamePt || input.label).trim().slice(0, 120) || input.label;
  const aliasesPt = uniqueTextValues([input.label, canonicalPt, ...(Array.isArray(selection.aliasesPt) ? selection.aliasesPt : [])]).slice(0, 12);
  const nameEn = candidate.externalSourceName.slice(0, 120);
  const normalizedNames = uniqueNormalized([canonicalPt, nameEn, ...aliasesPt]);
  const id = `gfood_usda_${candidate.externalSourceId}`;
  return {
    id,
    name: canonicalPt,
    names: {
      pt: canonicalPt,
      en: nameEn,
    },
    aliasesByLanguage: {
      pt: aliasesPt,
      en: uniqueTextValues([nameEn]),
    },
    normalizedNames,
    unit: "g",
    nutritionBasis: "per_100g",
    nutrition: candidate.nutrition,
    nutritionSource: "usda",
    externalSourceId: candidate.externalSourceId,
    externalSourceName: candidate.externalSourceName,
    externalSourceUrl: candidate.externalSourceUrl,
    confidence,
    createdBy: "system",
    createdFromImport: true,
    selectionReason: String(selection.reason || "").slice(0, 180),
  };
}

async function addGlobalFoodAlias(foodId, label, language) {
  const normalized = normalizeText(label);
  if (!foodId || !normalized) return;
  const aliasPath = `aliasesByLanguage.${normalizeLanguage(language)}`;
  await firestore.collection(GLOBAL_FOOD_COLLECTION).doc(foodId).update({
    [aliasPath]: FieldValue.arrayUnion(label),
    normalizedNames: FieldValue.arrayUnion(normalized),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function snapshotDocToFood(doc) {
  return { id: doc.id, ...doc.data() };
}

function resolveResponse(status, food, addedToGlobal) {
  return {
    status,
    resolved: true,
    addedToGlobal,
    globalFoodId: food.id,
    stockItemId: food.id,
    food: globalFoodToClientFood(food),
  };
}

function reviewResponse(food, confidence) {
  return {
    status: "needs_review",
    resolved: false,
    addedToGlobal: false,
    confidence,
    globalFoodId: food.id,
  };
}

function unresolvedResponse(reason, extra = {}) {
  return { status: "unresolved", resolved: false, addedToGlobal: false, reason, ...extra };
}

function globalFoodToClientFood(food) {
  return {
    id: food.id,
    globalFoodId: food.id,
    name: food.name || food.names?.pt || food.id,
    unit: "g",
    names: food.names || { pt: food.name || food.id },
    aliasesByLanguage: food.aliasesByLanguage || {},
    nutrition: perUnitNutrition(food.nutrition),
    nutritionSource: food.nutritionSource || "global_food",
    nutritionStatus: food.status === "approved" ? "approved" : "needs_review",
    needsReview: food.status !== "approved",
  };
}

function perUnitNutrition(nutrition) {
  return {
    kcal: Number(nutrition?.kcal || 0) / 100,
    protein: Number(nutrition?.protein || 0) / 100,
    carbs: Number(nutrition?.carbs || 0) / 100,
    fat: Number(nutrition?.fat || 0) / 100,
  };
}

function normalizeConfidence(value) {
  const confidence = Number(value || 0);
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
}

function hasAnyNutrition(nutrition) {
  return ["kcal", "protein", "carbs", "fat"].some((key) => Number(nutrition?.[key] || 0) > 0);
}

function normalizeLanguage(value) {
  return ["pt", "en", "nl"].includes(value) ? value : "pt";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueTextValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const normalized = normalizeText(text);
    if (!text || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(text);
  }
  return result;
}

function uniqueNormalized(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function normalizeTemperature(value) {
  const temperature = Number(value ?? 0.1);
  return Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 0.1;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
}

function readAiApiKey() {
  try {
    return aiApiKey.value() || process.env.AI_API_KEY || "";
  } catch {
    return process.env.AI_API_KEY || "";
  }
}

function readUsdaApiKey() {
  try {
    return usdaApiKey.value() || process.env.USDA_API_KEY || "";
  } catch {
    return process.env.USDA_API_KEY || "";
  }
}

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

async function markInvalidTokens(tokens, responses) {
  const batch = firestore.batch();
  let invalidCount = 0;
  responses.forEach((response, index) => {
    const code = response.error?.code || "";
    if (!code || !INVALID_TOKEN_CODES.has(code) || !tokens[index]?.ref) return;
    invalidCount += 1;
    batch.update(tokens[index].ref, {
      enabled: false,
      invalidAt: FieldValue.serverTimestamp(),
      invalidReason: code,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  if (invalidCount) await batch.commit();
}

function markNotificationFailed(ref, reason) {
  return ref.update({
    status: "sent",
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    delivery: {
      successCount: 0,
      failureCount: 1,
      reason: String(reason || "unknown").slice(0, 80),
    },
  });
}
