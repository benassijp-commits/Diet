import { useState } from "react";
import { Clock3, FilePlus, Plus, RotateCcw, Sparkles, Utensils } from "lucide-react";
import {
  allIngredientCatalogItems,
  currentDayLog,
  currentDietTargets,
  currentNutritionTotals,
  getMeals,
  getOptionKeys,
  labelForIngredient,
  labelForStockItem,
  normalizeAllowedUnit,
  stockItemSearchLabel,
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
  const mealBeingEdited = editingMeal ? meals.find((meal) => meal.id === editingMeal.mealId) : null;

  return (
    <section className="tab-panel active">
      <div className="diet-layout">
        <aside className="diet-side">
          <section className="metric-panel">
            <h2>Metas do dia</h2>
            <Metric label="Calorias" value={`${formatQty(totals.kcal)} / ${formatQty(targets.kcal)} kcal`} />
            <Metric label="Proteína" value={`${formatQty(totals.protein)} / ${formatQty(targets.protein)} g`} />
            <Metric label="Carboidrato" value={`${formatQty(totals.carbs)} / ${formatQty(targets.carbs)} g`} />
            <Metric label="Gordura" value={`${formatQty(totals.fat)} / ${formatQty(targets.fat)} g`} />
            <div className="water-control">
              <span className="water-label">Água</span>
              <div>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: -0.25 })}>-</button>
                <strong>{formatQty(dayLog.water)} L</strong>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: 0.25 })}>+</button>
              </div>
            </div>
            <progress max="3.8" value={Math.min(dayLog.water, 3.8)} />
            <div className="timing-control">
              <h3><Clock3 size={16} /> Tolerância entre refeições</h3>
              <label>
                Quantidade de horas mínimas entre refeições
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="0.5"
                  value={state.dietTiming.minHoursBetweenMeals}
                  onChange={(event) => dispatch({ type: "diet-timing/update", minHoursBetweenMeals: event.target.value })}
                />
              </label>
              <p>O app considera até 1 hora acima desse valor como janela aceitável.</p>
            </div>
          </section>
        </aside>

        <div className="diet-main">
          <div className="toolbar">
            <div>
              <h3>Seleção de opções</h3>
              <p>Escolha refeições, registre consumo e monte o carrinho.</p>
            </div>
            <div className="toolbar-actions">
              <label className="toggle-control">
                <input type="checkbox" checked={state.stockManagementEnabled} onChange={(event) => dispatch({ type: "stock/toggle-management", value: event.target.checked })} />
                Baixar estoque ao registrar
              </label>
              <button className="secondary-button" type="button" onClick={() => setQuickMealOpen(true)}><Utensils size={16} /> Avulsa</button>
              <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Sparkles size={16} /> Importar dieta</button>
              <button className="secondary-button" type="button" onClick={() => {
                const name = prompt("Nome da nova dieta:", `Dieta ${new Date().toLocaleDateString("pt-BR")}`);
                if (name) dispatch({ type: "diet/new", name });
              }}><FilePlus size={16} /> Nova dieta</button>
              <select value={state.activeDietVersionId} onChange={(event) => dispatch({ type: "diet/activate", id: event.target.value })}>
                {state.dietVersions.map((version) => <option key={version.id} value={version.id}>{version.status === "active" ? "Ativa" : "Arquivada"} - {version.name}</option>)}
              </select>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "meal/add" })}><Plus size={16} /> Adicionar refeição</button>
              <button className="secondary-button" type="button" onClick={() => { dispatch({ type: "day/reset" }); notify("Dia reiniciado. O estoque não foi alterado."); }}><RotateCcw size={16} /> Reiniciar dia</button>
            </div>
          </div>

          <div className="meal-grid">
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
              />
              );
            })}
          </div>

          <section className="weekly-plan-card">
            <div className="cart-header">
              <div>
                <h4>Carrinho de compras</h4>
                <p>Resumo das opções adicionadas nas refeições.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "cart/clear" })}>Limpar</button>
            </div>
            <CartSummary state={state} dispatch={dispatch} />
          </section>
        </div>
      </div>
      {importOpen && <ImportDialog title={language === "en" ? "Import diet with AI" : "Importar dieta com IA"} kind="diet" state={state} onClose={() => setImportOpen(false)} dispatch={dispatch} notify={notify} t={t} />}
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
    .map((item) => ({ ...item, name: item.name || labelForIngredient(state, item.stockItemId), qty: Math.max(0, Number(item.qty || 0)), unit: normalizeAllowedUnit(item.unit) }))
    .filter((item) => item.stockItemId && item.qty > 0);

  return (
    <Modal title="Refeição avulsa" onClose={onClose}>
      <div className="ingredient-editor-list">
        {items.map((item, index) => (
          <div className="ingredient-editor-row" key={index}>
            <label>Nome exibido<input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></label>
            <IngredientAutocomplete state={state} value={item.stockItemId} onChange={(id, ingredient) => updateItem(index, { stockItemId: id, name: ingredient.name, unit: normalizeAllowedUnit(ingredient.unit) })} language={language} t={t} />
            <label>Quantidade<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} /></label>
            <label>Unidade<UnitSelect value={item.unit} onChange={(unit) => updateItem(index, { unit })} /></label>
            <button className="secondary-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
          </div>
        ))}
        <button className="secondary-button" type="button" onClick={() => setItems((current) => [...current, { stockItemId: "", name: "", qty: "", unit: "g" }])}>Adicionar ingrediente</button>
      </div>
      <div className="modal-grid">
        <label>Observação<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: lanche fora da dieta" /></label>
      </div>
      <label className="toggle-control"><input type="checkbox" checked={affectStock} onChange={(event) => setAffectStock(event.target.checked)} /> Baixar estoque</label>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => {
          if (!validItems.length || validItems.length !== items.length) {
            notify("Informe ingredientes válidos e quantidades maiores que zero.");
            return;
          }
          dispatch({ type: "meal/quick-register", items: validItems, note: note.trim(), affectStock });
          notify("Refeição avulsa registrada.");
          onClose();
        }}>Registrar avulsa</button>
      </footer>
    </Modal>
  );
}

function QuickMealModal({ state, onClose, dispatch, notify }) {
  const stockItems = allIngredientCatalogItems(state);
  const [stockItemId, setStockItemId] = useState(stockItems[0]?.id || "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [affectStock, setAffectStock] = useState(state.stockManagementEnabled);

  return (
    <Modal title="Refeição avulsa" onClose={onClose}>
      <div className="modal-grid">
        <label>
          Ingrediente
          <select value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}>
            {stockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.id}>{stockItemSearchLabel(stockItem)}</option>)}
          </select>
        </label>
        <label>
          Quantidade
          <input type="number" min="0" step="0.1" value={qty} onChange={(event) => setQty(event.target.value)} required />
        </label>
        <label>
          Observação
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: lanche fora da dieta" />
        </label>
      </div>
      <label className="toggle-control"><input type="checkbox" checked={affectStock} onChange={(event) => setAffectStock(event.target.checked)} /> Baixar estoque</label>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => {
          if (!stockItemId || !Number(qty)) {
            notify("Informe ingrediente e quantidade.");
            return;
          }
          dispatch({ type: "meal/quick-register", stockItemId, qty: Number(qty), note: note.trim(), affectStock });
            notify("Refeição avulsa registrada.");
          onClose();
        }}>Registrar avulsa</button>
      </footer>
    </Modal>
  );
}

function ConsumeMealModalV2({ state, mealId, option, onClose, dispatch, notify, language = "pt", t }) {
  const meal = getMeals(state).find((current) => current.id === mealId);
  const [completedAt, setCompletedAt] = useState(() => toDateTimeLocal(new Date()));
  const [items, setItems] = useState(() => (meal?.options?.[option] || []).map((item) => ({
    ...item,
    name: item.name || item.label || labelForStockItem(state, item.stockItemId),
    unit: normalizeAllowedUnit(item.unit || unitForStockItem(state, item.stockItemId)),
    qty: Math.max(0, Number(item.qty || 0)),
  })));

  if (!meal) return null;

  const updateItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const activeItems = items
    .map((item) => ({ ...item, name: item.name || labelForIngredient(state, item.stockItemId), qty: Math.max(0, Number(item.qty || 0)), unit: normalizeAllowedUnit(item.unit) }))
    .filter((item) => item.stockItemId && item.qty > 0);

  return (
    <Modal title="Confirmar consumo" onClose={onClose}>
      <div className="modal-grid">
        <label>Refeição<input value={`${meal.title} - Opção ${option}`} readOnly /></label>
        <label>Horário real<input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label>
      </div>
      <div className="ingredient-editor-list">
        {items.map((item, index) => (
          <div className="ingredient-editor-row" key={`${item.stockItemId || "new"}-${index}`}>
            <label>Nome exibido<input value={item.name || item.label || ""} onChange={(event) => updateItem(index, { name: event.target.value })} /></label>
            <IngredientAutocomplete state={state} value={item.stockItemId} onChange={(id, ingredient) => updateItem(index, { stockItemId: id, name: ingredient.name, unit: normalizeAllowedUnit(ingredient.unit) })} language={language} t={t} />
            <label>Quantidade<input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} /></label>
            <label>Unidade<UnitSelect value={item.unit || unitForStockItem(state, item.stockItemId)} onChange={(unit) => updateItem(index, { unit })} /></label>
            <button className="secondary-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
          </div>
        ))}
        {!items.length && <p className="empty-state">Nenhum item para registrar.</p>}
        <button className="secondary-button" type="button" onClick={() => setItems((current) => [...current, { stockItemId: "", name: "", qty: "", unit: "g" }])}>Adicionar ingrediente</button>
      </div>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => {
          if (!activeItems.length || activeItems.length !== items.length) {
            notify("Informe ingredientes válidos e quantidades maiores que zero.");
            return;
          }
          const parsedDate = new Date(completedAt);
          if (Number.isNaN(parsedDate.getTime())) {
            notify("Informe um horário válido.");
            return;
          }
          dispatch({ type: "meal/complete", mealId, option, completedAt: parsedDate.toISOString(), items: activeItems });
          notify("Consumo registrado.");
          onClose();
        }}>Confirmar consumo</button>
      </footer>
    </Modal>
  );
}

function ConsumeMealModal({ state, mealId, option, onClose, dispatch, notify }) {
  const meal = getMeals(state).find((current) => current.id === mealId);
  const [completedAt, setCompletedAt] = useState(() => toDateTimeLocal(new Date()));
  const [items, setItems] = useState(() => (meal?.options?.[option] || []).map((item) => ({
    ...item,
    name: labelForStockItem(state, item.stockItemId),
    unit: item.unit || unitForStockItem(state, item.stockItemId),
    qty: Math.max(0, Number(item.qty || 0)),
  })));

  if (!meal) return null;

  const updateItem = (index, patch) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };
  const activeItems = items.filter((item) => item.stockItemId && Number(item.qty) > 0);

  return (
    <Modal title="Confirmar consumo" onClose={onClose}>
      <div className="modal-grid">
        <label>
          Refeição
          <input value={`${meal.title} - Opção ${option}`} readOnly />
        </label>
        <label>
          Horário real
          <input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} />
        </label>
      </div>
      <div className="ingredient-editor-list">
        {items.map((item, index) => (
          <div className="ingredient-editor-row" key={`${item.stockItemId}-${index}`}>
            <label>
              Ingrediente
              <input value={item.label || item.name || labelForStockItem(state, item.stockItemId)} readOnly />
            </label>
            <label>
              Quantidade
              <input type="number" min="0" step="0.1" value={item.qty} onChange={(event) => updateItem(index, { qty: Math.max(0, Number(event.target.value || 0)) })} />
            </label>
            <label>
              Unidade
              <input value={item.unit || unitForStockItem(state, item.stockItemId)} readOnly />
            </label>
            <button className="secondary-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
          </div>
        ))}
        {!items.length && <p className="empty-state">Nenhum item para registrar.</p>}
      </div>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => {
          if (!activeItems.length) {
            notify("Informe pelo menos um item com quantidade maior que zero.");
            return;
          }
          const parsedDate = new Date(completedAt);
          if (Number.isNaN(parsedDate.getTime())) {
            notify("Informe um horário válido.");
            return;
          }
          dispatch({ type: "meal/complete", mealId, option, completedAt: parsedDate.toISOString(), items: activeItems });
          notify("Consumo registrado.");
          onClose();
        }}>Confirmar consumo</button>
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
