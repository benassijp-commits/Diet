import { useState } from "react";
import { Save } from "lucide-react";
import {
  allIngredientCatalogItems,
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
  const stockItems = allIngredientCatalogItems(state);
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
    <Modal title={`Editar ${meal.title}`} onClose={onClose}>
      <div className="modal-grid">
        <label>Nome<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Descrição<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      </div>
      <section className="option-editor">
        <div className="cart-header">
          <div>
            <h4>Opções e ingredientes</h4>
            <label className="option-picker">
              Opção em edição
              <select value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>
                {optionKeys.map((option) => <option key={option} value={option}>Opção {option}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={addOption}>Adicionar opção</button>
        </div>
        <div className="option-editor-block">
          <header>
            <h5>Opção {selectedOption}</h5>
            <div>
              <button className="secondary-button" type="button" onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, [selectedOption]: [...(current.options[selectedOption] || []), { label: stockItems[0]?.name || "Novo alimento", qty: 0, unit: stockItems[0]?.unit || "g", stockItemId: stockItems[0]?.id || "" }] } }))}>Adicionar ingrediente</button>
              <button className="secondary-button" type="button" disabled={optionKeys.length <= 1} onClick={deleteOption}>Excluir opção</button>
            </div>
          </header>
          <div className="ingredient-editor-list">
            {(draft.options[selectedOption] || []).map((item, index) => (
              <div className="ingredient-editor-row" key={index}>
                <label>Nome<input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
                <label>Quantidade<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></label>
                <label>
                  Unidade
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
                  onChange={(id) => updateItem(index, { stockItemId: id, label: item.label || labelForIngredient(state, id), unit: normalizeAllowedUnit(unitForStockItem(state, id)) })}
                  language={language}
                  t={t}
                />
                <button className="secondary-button" type="button" onClick={() => deleteItem(index)}>Excluir</button>
              </div>
            ))}
            {!(draft.options[selectedOption] || []).length && <p className="empty-state">Nenhum ingrediente nesta opção.</p>}
          </div>
        </div>
      </section>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => { dispatch({ type: "meal/update", meal: draft }); onClose(); }}><Save size={16} /> Salvar refeição</button>
      </footer>
    </Modal>
  );
}
