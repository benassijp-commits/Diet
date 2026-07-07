import { getShoppingRows } from "../../state/app-state.js";
import { formatQty } from "../../utils.js";

export default function ShoppingTab({ state, t = (key) => key }) {
  const rows = getShoppingRows(state);
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>{t("shopping.title")}</h3><p>{t("shopping.subtitle")}</p></div>
        <button className="secondary-button" type="button" onClick={() => navigator.clipboard.writeText(rows.map((row) => `${row.name}\t${formatQty(row.toBuy)}\t${row.unit}`).join("\n"))}>{t("shopping.copy")}</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("shopping.ingredient")}</th><th>{t("shopping.needed")}</th><th>{t("shopping.inStock")}</th><th>{t("shopping.buy")}</th><th>{t("shopping.estimate")}</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stockItemId}>
                <td>{row.name}</td>
                <td>{formatQty(row.qty)} {row.unit}</td>
                <td>{formatQty(row.inStock)} {row.unit}</td>
                <td><strong>{formatQty(row.toBuy)}</strong> {row.unit}</td>
                <td>{row.estimatedCost ? `R$ ${formatQty(row.estimatedCost)}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
