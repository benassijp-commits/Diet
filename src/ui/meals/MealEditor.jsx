import { useState } from "react";
import { Save } from "lucide-react";
import {
  getOptionKeys,
  nextOptionKey,
  labelForIngredient,
  normalizeAllowedUnit,
  unitForStockItem,
} from "../../state/app-state.js";
import IngredientAutocomplete from "../shared/IngredientAutocomplete.jsx";
import Modal from "../shared/Modal.jsx";

export default function MealEditor({ state, meal, initialOption, onClose, dispatch, language = "pt", t }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(meal)));
  const [selectedOption, setSelectedOption] = useState(() => {
    const optionKeys = getOptionKeys(meal);
    return optionKeys.includes(initialOption) ? initialOption : optionKeys[0] || "A";
  });
  const optionKeys = getOptionKeys(draft);

  const updateItem = (index, patch) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      next.options[selectedOption] = next.options[selectedOption] || [];
      next.options[selectedOption][index] = { ...next.options[selectedOption][index], ...patch };
      return next;
    });
  };

  const addOption = () => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      const option = nextOptionKey(next);
      next.options[option] = [];
      setSelectedOption(option);
      return next;
    });
  };

  const deleteOption = () => {
    if (optionKeys.length <= 1) return;
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      delete next.options[selectedOption];
      const remaining = getOptionKeys(next);
      setSelectedOption(remaining[0] || "A");
      return next;
    });
  };

  const deleteItem = (index) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      next.options[selectedOption] = (next.options[selectedOption] || []).filter((_, itemIndex) => itemIndex !== index);
      return next;
    });
  };

  return (
    <Modal title={t("meals.editTitle", { name: meal.title })} onClose={onClose}>
      <div className="modal-grid">
        <label>{t("common.name")}<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{t("common.description")}<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      </div>
      <section className="option-editor">
        <div className="cart-header">
          <div>
            <h4>{t("meals.optionsIngredients")}</h4>
            <label className="option-picker">
              {t("meals.editingOption")}
              <select value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>
                {optionKeys.map((option) => <option key={option} value={option}>{t("common.option")} {option}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={addOption}>{t("meals.addOption")}</button>
        </div>
        <div className="option-editor-block">
          <header>
            <h5>{t("common.option")} {selectedOption}</h5>
            <div>
              <button className="secondary-button" type="button" onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, [selectedOption]: [...(current.options[selectedOption] || []), { label: "", qty: 0, unit: "g", stockItemId: "" }] } }))}>{t("common.addIngredient")}</button>
              <button className="secondary-button" type="button" disabled={optionKeys.length <= 1} onClick={deleteOption}>{t("meals.deleteOption")}</button>
            </div>
          </header>
          <div className="ingredient-editor-list">
            {(draft.options[selectedOption] || []).map((item, index) => (
              <div className="ingredient-editor-row" key={index}>
                <label>{t("common.name")}<input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
                <label>{t("common.quantity")}<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></label>
                <label>
                  {t("common.unit")}
                  <select
                    value={item.unit}
                    onChange={(event) => updateItem(index, { unit: event.target.value })}
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="un">un</option>
                    <option value="ml">ml</option>
                    <option value="l">l</option>
                  </select>
                </label>
                <IngredientAutocomplete
                  state={state}
                  value={item.stockItemId}
                  onChange={(id) => updateItem(index, { stockItemId: id, label: item.label || labelForIngredient(state, id, language), unit: normalizeAllowedUnit(unitForStockItem(state, id)) })}
                  language={language}
                  t={t}
                />
                <button className="secondary-button" type="button" onClick={() => deleteItem(index)}>{t("common.delete")}</button>
              </div>
            ))}
            {!(draft.options[selectedOption] || []).length && <p className="empty-state">{t("meals.noIngredientsOption")}</p>}
          </div>
        </div>
      </section>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>{t("common.cancel")}</button>
        <button type="button" onClick={() => { dispatch({ type: "meal/update", meal: draft }); onClose(); }}><Save size={16} /> {t("meals.saveMeal")}</button>
      </footer>
    </Modal>
  );
}
