import { getShoppingRows } from "../../state/app-state.js";
import { formatQty } from "../../utils.js";

export default function ShoppingTab({ state }) {
  const rows = getShoppingRows(state);
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>Lista de compras</h3><p>Calculada pelo carrinho montado na aba Refeicoes.</p></div>
        <button className="secondary-button" type="button" onClick={() => navigator.clipboard.writeText(rows.map((row) => `${row.name}\t${formatQty(row.toBuy)}\t${row.unit}`).join("\n"))}>Copiar lista</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ingrediente</th><th>Necessario</th><th>Em estoque</th><th>Comprar</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.stockItemId}><td>{row.name}</td><td>{formatQty(row.qty)} {row.unit}</td><td>{formatQty(row.inStock)} {row.unit}</td><td><strong>{formatQty(row.toBuy)}</strong> {row.unit}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
