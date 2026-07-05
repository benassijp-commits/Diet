import { useState } from "react";
import { Save } from "lucide-react";
import {
  allStockItems,
  getOptionKeys,
  nextOptionKey,
  stockItemSearchLabel,
  unitForStockItem,
} from "../../state/app-state.js";
import Modal from "../shared/Modal.jsx";

export default function MealEditor({ state, meal, initialOption, onClose, dispatch }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(meal)));
  const [selectedOption, setSelectedOption] = useState(() => {
    const optionKeys = getOptionKeys(meal);
    return optionKeys.includes(initialOption) ? initialOption : optionKeys[0] || "A";
  });
  const stockItems = allStockItems(state);
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
        <label>Descricao<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      </div>
      <section className="option-editor">
        <div className="cart-header">
          <div>
            <h4>Opcoes e ingredientes</h4>
            <label className="option-picker">
              Opcao em edicao
              <select value={selectedOption} onChange={(event) => setSelectedOption(event.target.value)}>
                {optionKeys.map((option) => <option key={option} value={option}>Opcao {option}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={addOption}>Adicionar opcao</button>
        </div>
        <div className="option-editor-block">
          <header>
            <h5>Opcao {selectedOption}</h5>
            <div>
              <button className="secondary-button" type="button" onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, [selectedOption]: [...(current.options[selectedOption] || []), { label: stockItems[0]?.name || "Novo alimento", qty: 0, unit: stockItems[0]?.unit || "g", stockItemId: stockItems[0]?.id || "" }] } }))}>Adicionar ingrediente</button>
              <button className="secondary-button" type="button" disabled={optionKeys.length <= 1} onClick={deleteOption}>Excluir opcao</button>
            </div>
          </header>
          <div className="ingredient-editor-list">
            {(draft.options[selectedOption] || []).map((item, index) => (
              <div className="ingredient-editor-row" key={index}>
                <label>Alimento<input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
                <label>Quantidade<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></label>
                <label>Unidade<input value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} /></label>
                <label>Ingrediente
                  <select value={item.stockItemId} onChange={(event) => updateItem(index, { stockItemId: event.target.value, unit: unitForStockItem(state, event.target.value) })}>
                    {stockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.id}>{stockItemSearchLabel(stockItem)}</option>)}
                  </select>
                </label>
                <button className="secondary-button" type="button" onClick={() => deleteItem(index)}>Excluir</button>
              </div>
            ))}
            {!(draft.options[selectedOption] || []).length && <p className="empty-state">Nenhum ingrediente nesta opcao.</p>}
          </div>
        </div>
      </section>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => { dispatch({ type: "meal/update", meal: draft }); onClose(); }}><Save size={16} /> Salvar refeicao</button>
      </footer>
    </Modal>
  );
}
