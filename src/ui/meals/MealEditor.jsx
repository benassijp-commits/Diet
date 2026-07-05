import { useState } from "react";
import { Save } from "lucide-react";
import {
  allStockItems,
  getOptionKeys,
  stockItemSearchLabel,
  unitForStockItem,
} from "../../state/app-state.js";
import Modal from "../shared/Modal.jsx";

export default function MealEditor({ state, meal, onClose, dispatch }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(meal)));
  const selectedOption = getOptionKeys(draft)[0] || "A";
  const stockItems = allStockItems(state);

  const updateItem = (index, patch) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      next.options[selectedOption][index] = { ...next.options[selectedOption][index], ...patch };
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
          <h4>Ingredientes - Opcao {selectedOption}</h4>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, [selectedOption]: [...(current.options[selectedOption] || []), { label: "Novo alimento", qty: 0, unit: "g", stockItemId: stockItems[0]?.id || "" }] } }))}>Adicionar ingrediente</button>
        </div>
        <div className="ingredient-editor-list">
          {(draft.options[selectedOption] || []).map((item, index) => (
            <div className="ingredient-editor-row" key={index}>
              <label>Alimento<input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
              <label>Quantidade<input type="number" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></label>
              <label>Unidade<input value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} /></label>
              <label>Ingrediente
                <select value={item.stockItemId} onChange={(event) => updateItem(index, { stockItemId: event.target.value, unit: unitForStockItem(state, event.target.value) })}>
                  {stockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.id}>{stockItemSearchLabel(stockItem)}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      </section>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => { dispatch({ type: "meal/update", meal: draft }); onClose(); }}><Save size={16} /> Salvar refeicao</button>
      </footer>
    </Modal>
  );
}
