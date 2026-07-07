import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const aiApiKey = defineSecret("AI_API_KEY");
const DEFAULT_AI_BASE_URL = "https://nano-gpt.com/api/v1";
const DEFAULT_AI_MODEL = "deepseek/deepseek-latest";

export const aiProxy = onCall({ secrets: [aiApiKey], cors: true }, async (request) => {
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
});

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

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
