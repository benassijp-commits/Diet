import { useState } from "react";
import { loadAiSettings } from "../../ai-settings.js";
import { extractDietFileText } from "../../diet-file-text.js";
import { importDietFromText } from "../../diet-importer.js";
import { importWorkoutFromText } from "../../workout-importer.js";
import { allStockItems, createStockItemId } from "../../state/app-state.js";
import Modal from "./Modal.jsx";

export default function ImportDialog({ title, kind, state, onClose, dispatch, notify }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const settings = loadAiSettings();

  const submit = async () => {
    setStatus(`Enviando ${kind === "diet" ? "dieta" : "treino"} para IA...`);
    const imported = kind === "diet"
      ? prepareImportedDiet(await importDietFromText({ text, settings }), state)
      : await importWorkoutFromText({ text, settings });
    dispatch({ type: kind === "diet" ? "diet/import" : "workout/import", imported });
    notify(kind === "diet" ? "Dieta importada." : "Treino importado.");
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-note">Cole texto bruto ou carregue PDF/Excel. O app extrai o conteudo e envia para a IA adaptar ao modelo.</p>
      <label>Arquivo<input type="file" accept=".txt,.md,.csv,.json,.pdf,.xlsx,.xls,.ods,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async (event) => {
        const [file] = event.target.files || [];
        if (!file) return;
        setStatus(`Extraindo texto de ${file.name}...`);
        setText(await extractDietFileText(file));
        setStatus("Arquivo lido. Revise e importe com IA.");
      }} /></label>
      <label>Texto bruto<textarea rows={12} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="purchase-warnings">{status}</div>
      <footer><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button type="button" onClick={submit}>Importar com IA</button></footer>
    </Modal>
  );
}

function prepareImportedDiet(imported, state) {
  const stockItems = {};
  const createdByName = new Map();
  const existing = allStockItems(state);
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
