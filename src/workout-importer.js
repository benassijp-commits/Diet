import { chatJson } from "./ai-client.js";

export async function importWorkoutFromText({ text, settings }) {
  const sourceText = String(text || "").trim();
  if (sourceText.length < 20) {
    throw new Error("Cole ou carregue um texto de treino antes de importar.");
  }

  const result = await chatJson({
    settings,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "Voce transforma planilhas e prescricoes de treino em JSON estrito.",
          "A entrada pode vir de texto livre, PDF ou planilha Excel convertida para texto/CSV.",
          "Interprete tabelas, colunas, dias A/B/C/D, exercicios, series, repeticoes, carga, descanso e observacoes.",
          "Responda somente JSON valido.",
          "Nao invente exercicios que nao estejam no texto.",
          "Se houver descanso por serie, preserve por serie. Se houver descanso por exercicio, aplique em todas as series.",
          "Se nao houver carga, use string vazia.",
          "Se nao houver descanso, use 60 segundos.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Converta o texto abaixo para este schema:",
          "{",
          '  "planName": "string",',
          '  "notes": "string",',
          '  "days": [',
          "    {",
          '      "label": "A",',
          '      "title": "Treino A",',
          '      "notes": "string opcional",',
          '      "exercises": [',
          "        {",
          '          "name": "Supino reto",',
          '          "group": "Peito",',
          '          "notes": "string opcional",',
          '          "sets": [',
          '            { "reps": "8-12", "load": "", "restSeconds": 90, "notes": "" }',
          "          ]",
          "        }",
          "      ]",
          "    }",
          "  ]",
          "}",
          "",
          "Texto do treino:",
          sourceText,
        ].join("\n"),
      },
    ],
  });

  return normalizeImportedWorkout(result);
}

function normalizeImportedWorkout(value) {
  const days = Array.isArray(value?.days) ? value.days : [];
  if (!days.length) throw new Error("A IA não encontrou dias de treino no texto.");

  return {
    planName: String(value.planName || "Treino importado").trim() || "Treino importado",
    notes: String(value.notes || "").trim(),
    days: days.map((day, index) => normalizeWorkoutDay(day, index)).filter((day) => day.exercises.length),
  };
}

function normalizeWorkoutDay(day, index) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  const label = String(day?.label || String.fromCharCode(65 + index)).trim().toUpperCase();
  return {
    label: label || String.fromCharCode(65 + index),
    title: String(day?.title || `Treino ${label || index + 1}`).trim(),
    notes: String(day?.notes || "").trim(),
    exercises: exercises.map(normalizeExercise).filter((exercise) => exercise.name && exercise.sets.length),
  };
}

function normalizeExercise(exercise) {
  const rawSets = Array.isArray(exercise?.sets) ? exercise.sets : [];
  const sets = rawSets.length ? rawSets : buildSetsFromExercise(exercise);
  return {
    name: String(exercise?.name || exercise?.title || "").trim(),
    group: String(exercise?.group || exercise?.muscleGroup || "").trim(),
    notes: String(exercise?.notes || "").trim(),
    sets: sets.map(normalizeSet).filter(Boolean),
  };
}

function buildSetsFromExercise(exercise) {
  const count = Math.max(1, Number(exercise?.series || exercise?.setsCount || 0) || 1);
  return Array.from({ length: count }, () => ({
    reps: exercise?.reps || exercise?.repetitions || "",
    load: exercise?.load || exercise?.weight || "",
    restSeconds: exercise?.restSeconds || exercise?.rest || 60,
  }));
}

function normalizeSet(set) {
  const restSeconds = parseRestSeconds(set?.restSeconds ?? set?.rest ?? set?.interval ?? 60);
  return {
    reps: String(set?.reps || set?.repetitions || "").trim() || "8-12",
    load: String(set?.load || set?.weight || set?.carga || "").trim(),
    restSeconds,
    notes: String(set?.notes || "").trim(),
  };
}

function parseRestSeconds(value) {
  if (typeof value === "number") return Math.max(0, Math.round(value));
  const text = String(value || "").toLowerCase().replace(",", ".").trim();
  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(min|m)/);
  if (minuteMatch) return Math.round(Number(minuteMatch[1]) * 60);
  const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*(seg|sec|s)/);
  if (secondMatch) return Math.round(Number(secondMatch[1]));
  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 60;
}
