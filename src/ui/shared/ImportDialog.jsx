import { useState } from "react";
import { loadAiSettings } from "../../ai-settings.js";
import { extractDietFileText } from "../../diet-file-text.js";
import { importDietFromText } from "../../diet-importer.js";
import { importWorkoutFromText } from "../../workout-importer.js";
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
        ? prepareImportedDiet(await importDietFromText({ text, settings }), state)
        : await importWorkoutFromText({ text, settings });
      dispatch({ type: kind === "diet" ? "diet/import" : "workout/import", imported });
      setStatus(kind === "diet" ? t("import.dietSuccess") : t("import.workoutSuccess"));
      notify(kind === "diet" ? t("import.dietSuccess") : t("import.workoutSuccess"));
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

function prepareImportedDiet(imported, state) {
  const stockItems = {};
  const createdByName = new Map();
  const existing = allIngredientCatalogItems(state);
  const findExisting = (name) => existing.find((item) => item.name.toLowerCase() === String(name || "").toLowerCase());

  return {
    ...imported,
    stockItems,
    meals: imported.meals.map((meal) => ({
      ...meal,
      options: Object.fromEntries(Object.entries(meal.options || {}).map(([option, items]) => [
        option,
        items.map((item) => {
          const match = findExisting(item.label);
          const key = String(item.label || "").toLowerCase();
          const stockItemId = match?.id || createdByName.get(key) || createStockItemId(item.label);
          if (!match) createdByName.set(key, stockItemId);
          if (!match && !stockItems[stockItemId]) {
            stockItems[stockItemId] = {
              id: stockItemId,
              name: item.label,
              unit: item.unit || "g",
              names: { pt: item.label },
              aliasesByLanguage: { pt: [item.label] },
              nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
              nutritionSource: "import_placeholder",
            };
          }
          return { ...item, stockItemId };
        }),
      ])),
    })),
  };
}
