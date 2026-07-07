import { useState } from "react";
import { labelForStockItem } from "../../state/app-state.js";
import { formatQty } from "../../utils.js";

export default function LogTab({ state, dispatch, t, language = "pt" }) {
  const [type, setType] = useState("");
  const rows = state.log.filter((entry) => !type || entry.type === type).slice().reverse();
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>{t("log.title")}</h3><p>{t("log.subtitle")}</p></div>
        <div className="toolbar-actions">
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">{t("log.all")}</option>
            <option value="entrada">{t("log.entry")}</option>
            <option value="saida">{t("log.exit")}</option>
            <option value="consumo">{t("log.consumption")}</option>
            <option value="treino">{t("log.workout")}</option>
            <option value="ajuste">{t("log.adjustment")}</option>
          </select>
          <button className="secondary-button" type="button" onClick={() => confirm(t("log.clearConfirm")) && dispatch({ type: "log/clear" })}>{t("log.clear")}</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("log.date")}</th><th>{t("log.type")}</th><th>{t("log.detail")}</th><th>{t("log.items")}</th></tr></thead>
          <tbody>{rows.map((entry, index) => <tr key={index}><td>{entry.date}</td><td>{typeLabel(entry.type, t)}</td><td>{entry.alert ? `${entry.detail} | ${entry.alert}` : entry.detail}</td><td>{(entry.items || []).map((item) => `${item.name || labelForStockItem(state, item.stockItemId, language)}: ${formatQty(item.qty)} ${item.unit || ""}`).join("; ")}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function typeLabel(type, t) {
  if (type === "entrada") return t("log.entry");
  if (type === "saida") return t("log.exit");
  if (type === "consumo") return t("log.consumption");
  if (type === "treino") return t("log.workout");
  if (type === "ajuste") return t("log.adjustment");
  return type;
}
