import { useState } from "react";
import { labelForStockItem } from "../../state/app-state.js";
import { formatQty } from "../../utils.js";

export default function LogTab({ state, dispatch }) {
  const [type, setType] = useState("");
  const rows = state.log.filter((entry) => !type || entry.type === type).slice().reverse();
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>Histórico</h3><p>Rastro de refeições, estoque e treinos.</p></div>
        <div className="toolbar-actions">
          <select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="consumo">Consumo</option><option value="treino">Treino</option><option value="ajuste">Ajuste</option></select>
          <button className="secondary-button" type="button" onClick={() => confirm("Limpar histórico?") && dispatch({ type: "log/clear" })}>Limpar histórico</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th>Itens</th></tr></thead>
          <tbody>{rows.map((entry, index) => <tr key={index}><td>{entry.date}</td><td>{entry.type}</td><td>{entry.alert ? `${entry.detail} | ${entry.alert}` : entry.detail}</td><td>{(entry.items || []).map((item) => `${item.name || labelForStockItem(state, item.stockItemId)}: ${formatQty(item.qty)} ${item.unit || ""}`).join("; ")}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
