import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./services/cloud-store.js";

const DEFAULT_PROXY_MODEL = "deepseek/deepseek-latest";

export async function chatJson({ settings, messages, temperature = 0.1 }) {
  if (!settings?.apiKey) {
    logAiMode("proxy", DEFAULT_PROXY_MODEL);
    return chatJsonWithProxy({ messages, temperature });
  }

  logAiMode("direct-user-key", settings.model);

  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na IA (${response.status}). ${detail.slice(0, 180)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("A IA respondeu sem conteúdo.");

  try {
    return JSON.parse(stripCodeFence(content));
  } catch {
    throw new Error("A IA não retornou JSON válido.");
  }
}

async function chatJsonWithProxy({ messages, temperature }) {
  const aiProxy = httpsCallable(getFunctions(app), "aiProxy");
  const response = await aiProxy({ messages, temperature });
  if (!response.data || typeof response.data !== "object") {
    throw new Error("A IA respondeu sem conteudo.");
  }
  return response.data;
}

function logAiMode(mode, model) {
  if (import.meta.env.DEV) {
    console.info(`[AI] mode: ${mode}`);
    if (model) console.info(`[AI] model: ${model}`);
  }
}

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
