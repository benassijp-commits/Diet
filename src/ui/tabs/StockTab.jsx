import { useState } from "react";
import { loadAiSettings } from "../../ai-settings.js";
import { resolveIngredientMatch } from "../../ingredient-matching.js";
import { resolveIngredientNutrition } from "../../nutrition-service.js";
import {
  allIngredientCatalogItems,
  allStockItems,
  createStockItemId,
  getStockQty,
  ingredientNameForLanguage,
  labelForIngredient,
  normalizeAllowedUnit,
  priceForIngredient,
  stockStatusForIngredient,
  unitForIngredient,
} from "../../state/app-state.js";
import { formatQty } from "../../utils.js";
import IngredientAutocomplete from "../shared/IngredientAutocomplete.jsx";

const emptyDraft = {
  id: "",
  name: "",
  unit: "g",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  price: "",
  priceReferenceQty: "",
  priceReferenceUnit: "g",
};

export default function StockTab({ state, dispatch, notify, t = (key) => key, language = "pt" }) {
  const catalog = allIngredientCatalogItems(state);
  const stockRows = allStockItems(state, language);
  const [stockItemId, setStockItemId] = useState("");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState("entrada");
  const [detail, setDetail] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [isResolving, setIsResolving] = useState(false);

  const selectDraftIngredient = (id, ingredient) => {
    const price = priceForIngredient(state, id);
    setDraft({
      id,
      name: labelForIngredient(state, id, language),
      unit: normalizeAllowedUnit(ingredient.unit),
      kcal: ingredient.nutrition?.kcal ?? "",
      protein: ingredient.nutrition?.protein ?? "",
      carbs: ingredient.nutrition?.carbs ?? "",
      fat: ingredient.nutrition?.fat ?? "",
      price: price.price || "",
      priceReferenceQty: price.referenceQty || "",
      priceReferenceUnit: price.referenceUnit || normalizeAllowedUnit(ingredient.unit),
    });
  };

  const saveIngredient = async () => {
    if (isResolving) return;
    const name = draft.name.trim();
    if (!name) {
      notify(t("stock.invalidName"));
      return;
    }
    const duplicate = resolveIngredientMatch(name, state, { items: catalog });
    if (duplicate?.item && duplicate.item.id !== draft.id && duplicate.confidence !== "probable") {
      notify(t("stock.duplicateIngredient", { name: duplicate.item.name || duplicate.item.id }));
      return;
    }
    if (duplicate?.item && duplicate.item.id !== draft.id && duplicate.confidence === "probable") {
      const shouldCreate = confirm(t("stock.similarIngredientConfirm", { name: duplicate.item.name || duplicate.item.id }));
      if (!shouldCreate) return;
    }
    let nutrition = {
      kcal: Number(draft.kcal || 0),
      protein: Number(draft.protein || 0),
      carbs: Number(draft.carbs || 0),
      fat: Number(draft.fat || 0),
    };
    let nutritionSource = draft.id ? state.stockItems[draft.id]?.nutritionSource || "manual" : "manual";
    if (!nutrition.kcal && !nutrition.protein && !nutrition.carbs && !nutrition.fat) {
      setIsResolving(true);
      try {
        const resolved = await resolveIngredientNutrition({ name, unit: draft.unit, aiSettings: loadAiSettings() });
        nutrition = resolved.nutrition;
        nutritionSource = resolved.nutritionSource;
        if (!nutrition.kcal && !nutrition.protein && !nutrition.carbs && !nutrition.fat) {
          notify(t("stock.noMacros"));
          return;
        }
      } catch (error) {
        console.error(error);
        notify(t("stock.resolveError"));
        return;
      } finally {
        setIsResolving(false);
      }
    }
    const id = draft.id || createStockItemId(name);
    dispatch({
      type: "stock/upsert-item",
      item: {
        ...(state.stockItems[id] || {}),
        id,
        name,
        unit: normalizeAllowedUnit(draft.unit),
        nutrition,
        nutritionSource,
        price: Number(draft.price || 0),
        priceReferenceQty: Number(draft.priceReferenceQty || 0),
        priceReferenceUnit: normalizeAllowedUnit(draft.priceReferenceUnit),
      },
    });
    setDraft(emptyDraft);
    notify(t("stock.saved"));
  };

  return (
    <section className="tab-panel active">
      <div className="toolbar"><div><h3>{t("stock.title")}</h3><p>{t("stock.subtitle")}</p></div></div>
      <form className="stock-form" onSubmit={(event) => {
        event.preventDefault();
        const amount = Number(qty || 0);
        if (!stockItemId || amount <= 0) {
          notify(t("stock.invalidQty"));
          return;
        }
        if (kind === "saida" && amount > getStockQty(state, stockItemId)) {
        notify(t("stock.exitTooHigh"));
          return;
        }
        dispatch({ type: "stock/register", kind, detail: detail.trim() || "Registro manual", items: [{ stockItemId, name: labelForIngredient(state, stockItemId, language), qty: amount, unit: unitForIngredient(state, stockItemId) }] });
        setQty("");
        setDetail("");
        notify(t("stock.movementSaved"));
      }}>
        <IngredientAutocomplete state={state} value={stockItemId} onChange={(id) => setStockItemId(id)} language={language} t={t} label={t("ingredients.ingredient")} />
        <label>{t("stock.quantity")}<input type="number" min="0" step="0.1" value={qty} onChange={(event) => setQty(event.target.value)} required /></label>
        <label>{t("stock.unit")}<input value={unitForIngredient(state, stockItemId)} readOnly /></label>
        <label>{t("stock.type")}<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="entrada">{t("stock.entry")}</option><option value="saida">{t("stock.exit")}</option></select></label>
        <label>{t("stock.detail")}<input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={t("stock.detailPlaceholder")} /></label>
        <button type="submit">{t("stock.register")}</button>
      </form>

      <section className="stock-editor">
        <h4>{t("stock.editor")}</h4>
        <div className="stock-editor-grid">
          <button className="secondary-button" type="button" onClick={() => setDraft(emptyDraft)}>{t("stock.newIngredient")}</button>
          <IngredientAutocomplete state={state} value={draft.id} onChange={selectDraftIngredient} label={t("stock.searchExisting")} language={language} t={t} />
          <label>{t("stock.name")}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>{t("stock.unit")}<UnitSelect value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} /></label>
          <label>Kcal<input type="number" min="0" step="0.1" value={draft.kcal} onChange={(event) => setDraft({ ...draft, kcal: event.target.value })} /></label>
          <label>{t("stock.protein")}<input type="number" min="0" step="0.1" value={draft.protein} onChange={(event) => setDraft({ ...draft, protein: event.target.value })} /></label>
          <label>{t("stock.carbs")}<input type="number" min="0" step="0.1" value={draft.carbs} onChange={(event) => setDraft({ ...draft, carbs: event.target.value })} /></label>
          <label>{t("stock.fat")}<input type="number" min="0" step="0.1" value={draft.fat} onChange={(event) => setDraft({ ...draft, fat: event.target.value })} /></label>
          <label>{t("stock.price")}<input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
          <label>{t("stock.referenceQty")}<input type="number" min="0" step="0.1" value={draft.priceReferenceQty} onChange={(event) => setDraft({ ...draft, priceReferenceQty: event.target.value })} /></label>
          <label>{t("stock.referenceUnit")}<UnitSelect value={draft.priceReferenceUnit} onChange={(unit) => setDraft({ ...draft, priceReferenceUnit: unit })} /></label>
          <button type="button" disabled={isResolving} onClick={saveIngredient}>{isResolving ? <span className="ai-loading"><span /> {t("stock.resolving")}</span> : t("stock.saveIngredient")}</button>
        </div>
      </section>

      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("shopping.ingredient")}</th><th>{t("tabs.stock")}</th><th>{t("stock.unit")}</th><th>{t("stock.price")}</th><th>{t("stock.status")}</th></tr></thead>
          <tbody>{stockRows.map((item) => {
            const price = priceForIngredient(state, item.id);
            const status = stockStatusForIngredient(state, item.id);
            return (
              <tr key={item.id}>
                <td>{ingredientNameForLanguage(item, language)}</td>
                <td><strong>{formatQty(getStockQty(state, item.id))}</strong></td>
                <td>{item.unit}</td>
                <td>{price.price ? `R$ ${formatQty(price.price)} / ${formatQty(price.referenceQty)} ${price.referenceUnit}` : "-"}</td>
                <td><span className={`status-pill ${status.className}`}>{translateStockStatus(status.label, t)}</span></td>
              </tr>
            );
          })}</tbody>
        </table>
        {!stockRows.length && <p className="empty-state">{t("stock.empty")}<br />{t("stock.emptyHint")}</p>}
      </div>
    </section>
  );
}

function UnitSelect({ value, onChange }) {
  return (
    <select value={normalizeAllowedUnit(value)} onChange={(event) => onChange(event.target.value)}>
      <option value="g">g</option>
      <option value="kg">kg</option>
      <option value="un">un</option>
      <option value="ml">ml</option>
      <option value="l">l</option>
    </select>
  );
}

function translateStockStatus(label, t) {
  if (label === "Comprar") return t("stock.buyStatus");
  if (label === "Sem estoque") return t("stock.noStock");
  return t("stock.ok");
}
