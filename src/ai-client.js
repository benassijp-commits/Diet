export async function chatJson({ settings, messages, temperature = 0.1 }) {
  if (!settings?.apiKey) {
    throw new Error("Configure uma chave de API antes de usar a IA.");
  }

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

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}
