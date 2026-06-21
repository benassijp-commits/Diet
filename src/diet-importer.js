import { chatJson } from "./ai-client.js";

export async function importDietFromText({ text, settings }) {
  const sourceText = String(text || "").trim();
  if (sourceText.length < 20) {
    throw new Error("Cole ou carregue um texto de dieta antes de importar.");
  }

  const result = await chatJson({
    settings,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "Voce transforma dietas de bodybuilding em JSON estrito.",
          "A entrada pode vir de texto livre, PDF ou planilha Excel convertida para texto/CSV.",
          "Interprete tabelas, colunas, abas, blocos de refeicao e listas mesmo quando a formatacao estiver irregular.",
          "Responda somente JSON valido.",
          "Nao invente ingredientes que nao estejam no texto.",
          "Preserve observacoes relevantes em notes quando nao couberem em refeicoes ou ingredientes.",
          "Se houver opcoes A/B/C, preserve as opcoes.",
          "Se nao houver opcoes, use somente a opcao A.",
          "Quantidades devem ser numeros quando possivel.",
          "Unidades devem ser curtas: g, ml, unidade, unidades, fatia, fatias, colher de sopa, porcao.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Converta o texto abaixo para este schema:",
          "{",
          '  "dietName": "string",',
          '  "notes": "string",',
          '  "meals": [',
          "    {",
          '      "title": "Refeicao 1",',
          '      "subtitle": "Cafe da manha",',
          '      "macros": "string opcional",',
          '      "options": {',
          '        "A": [',
          '          { "label": "string", "qty": 100, "unit": "g" }',
          "        ]",
          "      }",
          "    }",
          "  ]",
          "}",
          "",
          "Texto da dieta:",
          sourceText,
        ].join("\n"),
      },
    ],
  });

  return normalizeImportedDiet(result);
}

function normalizeImportedDiet(value) {
  const meals = Array.isArray(value?.meals) ? value.meals : [];
  if (!meals.length) throw new Error("A IA nao encontrou refeicoes no texto.");

  return {
    dietName: String(value.dietName || "Dieta importada").trim() || "Dieta importada",
    notes: String(value.notes || "").trim(),
    meals: meals.map((meal, index) => normalizeMeal(meal, index)),
  };
}

function normalizeMeal(meal, index) {
  const rawOptions = meal?.options && typeof meal.options === "object" ? meal.options : { A: meal?.items || [] };
  const options = {};

  for (const [option, items] of Object.entries(rawOptions)) {
    const key = String(option || "A").trim().toUpperCase() || "A";
    options[key] = (Array.isArray(items) ? items : [])
      .map(normalizeItem)
      .filter((item) => item.label);
  }

  if (!Object.values(options).some((items) => items.length)) {
    throw new Error(`A refeicao ${index + 1} nao tem ingredientes validos.`);
  }

  return {
    title: String(meal?.title || `Refeicao ${index + 1}`).trim(),
    subtitle: String(meal?.subtitle || "").trim(),
    macros: String(meal?.macros || "").trim(),
    options,
  };
}

function normalizeItem(item) {
  return {
    label: String(item?.label || item?.name || "").trim(),
    qty: Number(String(item?.qty ?? item?.quantity ?? 0).replace(",", ".")) || 0,
    unit: String(item?.unit || "").trim() || "g",
  };
}
