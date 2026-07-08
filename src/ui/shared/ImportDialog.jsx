import { useState } from "react";
import { loadAiSettings } from "../../ai-settings.js";
import { extractDietFileText } from "../../diet-file-text.js";
import { importDietFromText } from "../../diet-importer.js";
import { importWorkoutFromText } from "../../workout-importer.js";
import { resolveIngredientMatch } from "../../ingredient-matching.js";
import { resolveImportedIngredientNutrition } from "../../services/cloud-store.js";
import { allIngredientCatalogItems, createStockItemId } from "../../state/app-state.js";
import Modal from "./Modal.jsx";

export default function ImportDialog({ title, kind, state, onClose, dispatch, notify, t = (key) => key }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const settings = loadAiSettings();

  const submit = async () => {
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    setStatus(kind === "diet" ? t("import.dietStatus") : t("import.workoutStatus"));
    try {
      const imported = kind === "diet"
        ? await prepareImportedDiet(await importDietFromText({ text, settings }), state, {
          language: state.appSettings?.language || "pt",
          setStatus: (message) => setStatus(message),
          t,
        })
        : await importWorkoutFromText({ text, settings });
      dispatch({ type: kind === "diet" ? "diet/import" : "workout/import", imported });
      if (kind === "diet" && imported.unresolvedIngredients?.length) {
        const message = t("import.dietAutoResolveSummary", {
          resolved: imported.autoResolveStats?.resolved || 0,
          added: imported.autoResolveStats?.addedToGlobal || 0,
          unresolved: imported.unresolvedIngredients.length,
        });
        setStatus(message);
        notify(message);
        return;
      }
      const message = kind === "diet" && imported.autoResolveStats
        ? t("import.dietAutoResolveSummary", {
          resolved: imported.autoResolveStats.resolved,
          added: imported.autoResolveStats.addedToGlobal,
          unresolved: imported.unresolvedIngredients?.length || 0,
        })
        : kind === "diet" ? t("import.dietSuccess") : t("import.workoutSuccess");
      setStatus(message);
      notify(message);
      onClose();
    } catch (submitError) {
      console.error(submitError);
      setError(t("import.processError"));
      setStatus("");
      notify(t("import.processError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={isSubmitting ? () => {} : onClose}>
      <p className="modal-note">{t("import.note")}</p>
      <label>{t("import.file")}<input type="file" accept=".txt,.md,.csv,.json,.pdf,.xlsx,.xls,.ods,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async (event) => {
        const [file] = event.target.files || [];
        if (!file || isSubmitting) return;
        try {
          setError("");
          setStatus(`Extraindo texto de ${file.name}...`);
          setText(await extractDietFileText(file));
          setStatus(t("import.fileRead"));
        } catch (extractError) {
          console.error(extractError);
          setError(t("import.fileError"));
          setStatus("");
        }
      }} disabled={isSubmitting} /></label>
      <label>{t("import.rawText")}<textarea rows={12} value={text} onChange={(event) => setText(event.target.value)} disabled={isSubmitting} /></label>
      {(status || error) && <div className="purchase-warnings" role="status">{error || status}</div>}
      {isSubmitting && <p className="modal-note"><span className="ai-loading"><span /> {t("import.processing")}</span> {t("import.wait")}</p>}
      <footer><button className="secondary-button" type="button" onClick={onClose} disabled={isSubmitting}>{t("common.cancel")}</button><button type="button" onClick={submit} disabled={isSubmitting || !text.trim()}>{isSubmitting ? <span className="ai-loading"><span /> {t("import.processingButton")}</span> : t("import.submit")}</button></footer>
    </Modal>
  );
}

async function prepareImportedDiet(imported, state, options = {}) {
  const stockItems = {};
  const createdByName = new Map();
  const existing = allIngredientCatalogItems(state);
  const unresolvedIngredients = new Map();

  const prepared = {
    ...imported,
    stockItems,
    meals: imported.meals.map((meal) => ({
      ...meal,
      options: Object.fromEntries(Object.entries(meal.options || {}).map(([option, mealItems]) => [
        option,
        mealItems.map((item) => {
          const match = resolveIngredientMatch(item.label, state, { items: existing });
          const key = String(item.label || "").toLowerCase();
          const stockItemId = match?.item?.id || createdByName.get(key) || createStockItemId(item.label);
          if (!match?.item) createdByName.set(key, stockItemId);
          if (!match?.item && !stockItems[stockItemId]) {
            stockItems[stockItemId] = {
              id: stockItemId,
              name: item.label,
              unit: item.unit || "g",
              names: { pt: item.label },
              aliasesByLanguage: { pt: [item.label] },
              nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
              nutritionSource: "import_placeholder",
              nutritionStatus: "missing",
              needsReview: true,
            };
            unresolvedIngredients.set(stockItemId, item.label);
          }
          return {
            ...item,
            stockItemId,
            needsReview: Boolean(match?.needsReview),
          };
        }),
      ])),
    })),
    unresolvedIngredients: [...unresolvedIngredients].map(([id, label]) => ({ id, label })),
  };

  if (prepared.unresolvedIngredients.length) {
    await autoResolveImportedIngredients(prepared, options);
  }

  return prepared;
}

async function autoResolveImportedIngredients(imported, { language = "pt", setStatus, t = (key) => key } = {}) {
  const stats = { resolved: 0, addedToGlobal: 0, unresolved: imported.unresolvedIngredients.length };
  const pending = imported.unresolvedIngredients.slice(0, 12);

  for (let index = 0; index < pending.length; index += 1) {
    const ingredient = pending[index];
    const usage = findFirstImportedIngredientUsage(imported, ingredient.id);
    setStatus?.(t("import.resolvingNutrition", { current: index + 1, total: pending.length }));

    try {
      const result = await resolveImportedIngredientNutrition({
        label: ingredient.label,
        qty: usage?.qty || 0,
        unit: usage?.unit || imported.stockItems[ingredient.id]?.unit || "g",
        language,
        mealContext: usage?.mealTitle || "",
      });
      if (!result?.resolved || !result.food?.id) continue;

      delete imported.stockItems[ingredient.id];
      imported.stockItems[result.food.id] = result.food;
      replaceImportedStockItemId(imported, ingredient.id, result.food.id);
      stats.resolved += 1;
      if (result.addedToGlobal) stats.addedToGlobal += 1;
    } catch (error) {
      console.warn("Imported ingredient auto-resolve failed:", error?.code || error?.message || error);
    }
  }

  imported.unresolvedIngredients = imported.unresolvedIngredients.filter((ingredient) => imported.stockItems[ingredient.id]?.nutritionStatus === "missing");
  stats.unresolved = imported.unresolvedIngredients.length;
  imported.autoResolveStats = stats;
}

function findFirstImportedIngredientUsage(imported, stockItemId) {
  for (const meal of imported.meals || []) {
    for (const items of Object.values(meal.options || {})) {
      const item = items.find((current) => current.stockItemId === stockItemId);
      if (item) return { ...item, mealTitle: meal.title };
    }
  }
  return null;
}

function replaceImportedStockItemId(imported, fromId, toId) {
  for (const meal of imported.meals || []) {
    for (const items of Object.values(meal.options || {})) {
      for (const item of items) {
        if (item.stockItemId === fromId) {
          item.stockItemId = toId;
          item.needsReview = false;
        }
      }
    }
  }
}
