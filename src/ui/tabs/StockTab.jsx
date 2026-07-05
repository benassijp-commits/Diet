import { useState } from "react";
import {
  allStockItems,
  createStockItemId,
  getStockQty,
  labelForStockItem,
  stockItemSearchLabel,
  unitForStockItem,
} from "../../state/app-state.js";
import { formatQty } from "../../utils.js";

export default function StockTab({ state, dispatch, notify }) {
  const [stockItemId, setStockItemId] = useState(allStockItems(state)[0]?.id || "");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState("entrada");
  const [newItem, setNewItem] = useState({ name: "", unit: "g" });
  const items = allStockItems(state);

  return (
    <section className="tab-panel active">
      <div className="toolbar"><div><h3>Estoque e despensa</h3><p>Entradas, saidas e ingredientes.</p></div></div>
      <form className="stock-form" onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: "stock/register", kind, detail: "Registro manual", items: [{ stockItemId, name: labelForStockItem(state, stockItemId), qty: Number(qty), unit: unitForStockItem(state, stockItemId) }] });
        setQty("");
        notify("Movimento registrado.");
      }}>
        <label>Ingrediente<select value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{stockItemSearchLabel(item)}</option>)}</select></label>
        <label>Quantidade<input type="number" min="0" step="0.1" value={qty} onChange={(event) => setQty(event.target.value)} required /></label>
        <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="entrada">Entrada</option><option value="saida">Saida</option></select></label>
        <button type="submit">Registrar</button>
      </form>
      <section className="stock-editor">
        <h4>Cadastro de ingredientes</h4>
        <div className="stock-editor-grid compact">
          <label>Nome<input value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} /></label>
          <label>Unidade<input value={newItem.unit} onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} /></label>
          <button type="button" onClick={() => {
            if (!newItem.name || !newItem.unit) return;
            const id = createStockItemId(newItem.name);
            dispatch({ type: "stock/upsert-item", item: { id, name: newItem.name, unit: newItem.unit, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 } } });
            setNewItem({ name: "", unit: "g" });
          }}>Adicionar ingrediente</button>
        </div>
      </section>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ingrediente</th><th>Estoque</th><th>Unidade</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td><strong>{formatQty(getStockQty(state, item.id))}</strong></td><td>{item.unit}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
