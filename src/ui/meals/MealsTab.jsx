import { useState } from "react";
import { Clock3, FilePlus, Plus, RotateCcw, Sparkles, Utensils } from "lucide-react";
import {
  allIngredientCatalogItems,
  currentDietMissingNutritionItems,
  currentDayLog,
  currentDietTargets,
  currentNutritionTotals,
  getMeals,
  getOptionKeys,
  labelForIngredient,
  labelForStockItem,
  normalizeAllowedUnit,
  unitForStockItem,
} from "../../state/app-state.js";
import { formatQty } from "../../utils.js";
import CartSummary from "./CartSummary.jsx";
import MealCard from "./MealCard.jsx";
import MealEditor from "./MealEditor.jsx";
import IngredientAutocomplete from "../shared/IngredientAutocomplete.jsx";
import ImportDialog from "../shared/ImportDialog.jsx";
import Metric from "../shared/Metric.jsx";
import Modal from "../shared/Modal.jsx";

export default function MealsTab({ state, dispatch, notify, language = "pt", t }) {
  const [importOpen, setImportOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [consumingMeal, setConsumingMeal] = useState(null);
  const [quickMealOpen, setQuickMealOpen] = useState(false);
  const totals = currentNutritionTotals(state);
  const targets = currentDietTargets(state);
  const dayLog = currentDayLog(state);
  const meals = getMeals(state);
  const missingNutrition = currentDietMissingNutritionItems(state, language);
  const mealBeingEdited = editingMeal ? meals.find((meal) => meal.id === editingMeal.mealId) : null;
  const locale = language === "en" ? "en-US" : "pt-BR";
  const nextMealReminderAt = state.mealReminder?.nextMealReminderAt;

  return (
    <section className="tab-panel active">
      <div className="diet-layout">
        <aside className="diet-side">
          <section className="metric-panel">
            <h2>{t("meals.targets")}</h2>
            <Metric label={t("meals.calories")} value={`${formatQty(totals.kcal)} / ${formatQty(targets.kcal)} kcal`} />
            <Metric label={t("meals.protein")} value={`${formatQty(totals.protein)} / ${formatQty(targets.protein)} g`} />
            <Metric label={t("meals.carbs")} value={`${formatQty(totals.carbs)} / ${formatQty(targets.carbs)} g`} />
            <Metric label={t("meals.fat")} value={`${formatQty(totals.fat)} / ${formatQty(targets.fat)} g`} />
            {!!missingNutrition.length && (
              <div className="purchase-warnings" role="status">
                {t("meals.missingNutritionWarning", { count: missingNutrition.length })}
              </div>
            )}
            <div className="water-control">
              <span className="water-label">{t("app.water")}</span>
              <div>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: -0.25 })}>-</button>
                <strong>{formatQty(dayLog.water)} L</strong>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: 0.25 })}>+</button>
              </div>
            </div>
            <progress max="3.8" value={Math.min(dayLog.water, 3.8)} />
            <div className="timing-control">
              <h3><Clock3 size={16} /> {t("meals.timingTitle")}</h3>
              <label>
                {t("meals.minHours")}
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="0.5"
                  value={state.dietTiming.minHoursBetweenMeals}
                  onChange={(event) => dispatch({ type: "diet-timing/update", minHoursBetweenMeals: event.target.value })}
                />
              </label>
              <p>{t("meals.timingHelp")}</p>
              <p>
                {nextMealReminderAt
                  ? t("meals.nextMealReminder", { time: formatReminderTime(nextMealReminderAt, locale) })
                  : t("meals.noMealReminder")}
              </p>
              <p>{t("notifications.localMealReminderHelp")}</p>
            </div>
          </section>
        </aside>

        <div className="diet-main">
          <div className="toolbar">
            <div>
              <h3>{t("meals.selectionTitle")}</h3>
              <p>{t("meals.selectionSubtitle")}</p>
            </div>
            <div className="toolbar-actions">
              <label className="toggle-control">
                <input type="checkbox" checked={state.stockManagementEnabled} onChange={(event) => dispatch({ type: "stock/toggle-management", value: event.target.checked })} />
                {t("meals.reduceStockOnRegister")}
              </label>
              <button className="secondary-button" type="button" onClick={() => setQuickMealOpen(true)}><Utensils size={16} /> {t("meals.quick")}</button>
              <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Sparkles size={16} /> {t("meals.importDiet")}</button>
              <button className="secondary-button" type="button" onClick={() => {
                const name = prompt(t("meals.newDietPrompt"), `${t("meals.defaultDietName")} ${new Date().toLocaleDateString(locale)}`);
                if (name) dispatch({ type: "diet/new", name });
              }}><FilePlus size={16} /> {t("meals.newDiet")}</button>
              {!!state.dietVersions.length && (
                <select value={state.activeDietVersionId} onChange={(event) => dispatch({ type: "diet/activate", id: event.target.value })}>
                  {state.dietVersions.map((version) => <option key={version.id} value={version.id}>{version.status === "active" ? t("common.active") : t("common.archived")} - {version.name}</option>)}
                </select>
              )}
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "meal/add" })}><Plus size={16} /> {t("meals.addMeal")}</button>
              <button className="secondary-button" type="button" onClick={() => { dispatch({ type: "day/reset" }); notify(t("meals.resetDayDone")); }}><RotateCcw size={16} /> {t("meals.resetDay")}</button>
            </div>
          </div>

          <div className="meal-grid">
            {!meals.length && <p className="empty-state">{t("meals.emptyDiet")}<br />{t("meals.emptyDietHint")}</p>}
            {meals.map((meal) => {
              const optionKeys = getOptionKeys(meal);
              const selected = optionKeys.includes(state.selections[meal.id]) ? state.selections[meal.id] : optionKeys[0];
              return (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  state={state}
                  completed={dayLog.completedMeals[meal.id]}
                  onEdit={() => setEditingMeal({ mealId: meal.id, option: selected })}
                  onConsume={() => setConsumingMeal({ mealId: meal.id, option: selected })}
                  dispatch={dispatch}
                  notify={notify}
                  t={t}
                  language={language}
                />
              );
            })}
          </div>

          <section className="weekly-plan-card">
            <div className="cart-header">
              <div>
                <h4>{t("meals.cartTitle")}</h4>
                <p>{t("meals.cartSubtitle")}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "cart/clear" })}>{t("common.clear")}</button>
            </div>
            <CartSummary state={state} dispatch={dispatch} t={t} />
          </section>
        </div>
      </div>
      {importOpen && <ImportDialog title={t("meals.importDietAi")} kind="diet" state={state} onClose={() => setImportOpen(false)} dispatch={dispatch} notify={notify} t={t} />}
      {quickMealOpen && <QuickMealModalV2 state={state} onClose={() => setQuickMealOpen(false)} dispatch={dispatch} notify={notify} language={language} t={t} />}
      {mealBeingEdited && <MealEditor state={state} meal={mealBeingEdited} initialOption={editingMeal.option} onClose={() => setEditingMeal(null)} dispatch={dispatch} language={language} t={t} />}
      {consumingMeal && <ConsumeMealModalV2 state={state} mealId={consumingMeal.mealId} option={consumingMeal.option} onClose={() => setConsumingMeal(null)} dispatch={dispatch} notify={notify} language={language} t={t} />}
    </section>
  );
}

function QuickMealModalV2({ state, onClose, dispatch, notify, language = "pt", t }) {
  const stockItems = allIngredientCatalogItems(state);
  const [items, setItems] = useState([{ stockItemId: stockItems[0]?.id || "", name: stockItems[0]?.name || "", qty: "", unit: stockItems[0]?.unit || "g" }]);
  const [note, setNote] = useState("");
  const [affectStock, setAffectStock] = useState(state.stockManagementEnabled);
  const updateItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const validItems = items
    .map((item) => ({ ...item, name: item.name || labelForIngredient(state, item.stockItemId, language), qty: Math.max(0, Number(item.qty || 0)), unit: normalizeAllowedUnit(item.unit) }))
    .filter((item) => item.stockItemId && item.qty > 0);

  return (
    <Modal title={t("meals.quickTitle")} onClose={onClose}>
      <div className="ingredient-editor-list">
        {items.map((item, index) => (
          <div className="ingredient-editor-row" key={index}>
            <label>{t("meals.displayName")}<input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></label>
            <IngredientAutocomplete state={state} value={item.stockItemId} onChange={(id, ingredient) => updateItem(index, { stockItemId: id, name: labelForIngredient(state, id, language), unit: normalizeAllowedUnit(ingredient.unit) })} language={language} t={t} />
            <label>{t("common.quantity")}<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} /></label>
            <label>{t("common.unit")}<UnitSelect value={item.unit} onChange={(unit) => updateItem(index, { unit })} /></label>
            <button className="secondary-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("common.remove")}</button>
          </div>
        ))}
        <button className="secondary-button" type="button" onClick={() => setItems((current) => [...current, { stockItemId: "", name: "", qty: "", unit: "g" }])}>{t("common.addIngredient")}</button>
      </div>
      <div className="modal-grid">
        <label>{t("meals.note")}<input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("meals.notePlaceholder")} /></label>
      </div>
      <label className="toggle-control"><input type="checkbox" checked={affectStock} onChange={(event) => setAffectStock(event.target.checked)} /> {t("meals.reduceStock")}</label>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>{t("common.cancel")}</button>
        <button type="button" onClick={() => {
          if (!validItems.length || validItems.length !== items.length) {
            notify(t("meals.invalidItems"));
            return;
          }
          dispatch({ type: "meal/quick-register", items: validItems, note: note.trim(), affectStock });
          notify(t("meals.quickSaved"));
          onClose();
        }}>{t("meals.registerQuick")}</button>
      </footer>
    </Modal>
  );
}

function ConsumeMealModalV2({ state, mealId, option, onClose, dispatch, notify, language = "pt", t }) {
  const meal = getMeals(state).find((current) => current.id === mealId);
  const [completedAt, setCompletedAt] = useState(() => toDateTimeLocal(new Date()));
  const [items, setItems] = useState(() => (meal?.options?.[option] || []).map((item) => ({
    ...item,
    name: item.name || item.label || labelForStockItem(state, item.stockItemId, language),
    unit: normalizeAllowedUnit(item.unit || unitForStockItem(state, item.stockItemId)),
    qty: Math.max(0, Number(item.qty || 0)),
  })));

  if (!meal) return null;

  const updateItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const activeItems = items
    .map((item) => ({ ...item, name: item.name || labelForIngredient(state, item.stockItemId, language), qty: Math.max(0, Number(item.qty || 0)), unit: normalizeAllowedUnit(item.unit) }))
    .filter((item) => item.stockItemId && item.qty > 0);

  return (
    <Modal title={t("meals.confirmConsume")} onClose={onClose}>
      <div className="modal-grid">
        <label>{t("meals.meal")}<input value={`${meal.title} - ${t("common.option")} ${option}`} readOnly /></label>
        <label>{t("meals.realTime")}<input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
      </div>
      <div className="ingredient-editor-list">
        {items.map((item, index) => (
          <div className="ingredient-editor-row" key={`${item.stockItemId || "new"}-${index}`}>
            <label>{t("meals.displayName")}<input value={item.name || item.label || ""} onChange={(event) => updateItem(index, { name: event.target.value })} /></label>
            <IngredientAutocomplete state={state} value={item.stockItemId} onChange={(id, ingredient) => updateItem(index, { stockItemId: id, name: labelForIngredient(state, id, language), unit: normalizeAllowedUnit(ingredient.unit) })} language={language} t={t} />
            <label>{t("common.quantity")}<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} /></label>
            <label>{t("common.unit")}<UnitSelect value={item.unit || unitForStockItem(state, item.stockItemId)} onChange={(unit) => updateItem(index, { unit })} /></label>
            <button className="secondary-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{t("common.remove")}</button>
          </div>
        ))}
        {!items.length && <p className="empty-state">{t("meals.noItems")}</p>}
        <button className="secondary-button" type="button" onClick={() => setItems((current) => [...current, { stockItemId: "", name: "", qty: "", unit: "g" }])}>{t("common.addIngredient")}</button>
      </div>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>{t("common.cancel")}</button>
        <button type="button" onClick={() => {
          if (!activeItems.length || activeItems.length !== items.length) {
            notify(t("meals.invalidItems"));
            return;
          }
          const parsedDate = new Date(completedAt);
          if (Number.isNaN(parsedDate.getTime())) {
            notify(t("common.validTime"));
            return;
          }
          dispatch({ type: "meal/complete", mealId, option, completedAt: parsedDate.toISOString(), items: activeItems });
          notify(t("meals.consumeSaved"));
          onClose();
        }}>{t("meals.confirmConsume")}</button>
      </footer>
    </Modal>
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

function toDateTimeLocal(date) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatReminderTime(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}
