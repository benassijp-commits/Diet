import { useState } from "react";
import { Clock3, FilePlus, Plus, RotateCcw, Sparkles, Utensils } from "lucide-react";
import {
  allStockItems,
  currentDayLog,
  currentDietTargets,
  currentNutritionTotals,
  getMeals,
  getOptionKeys,
  stockItemSearchLabel,
} from "../../state/app-state.js";
import { formatQty } from "../../utils.js";
import CartSummary from "./CartSummary.jsx";
import MealCard from "./MealCard.jsx";
import MealEditor from "./MealEditor.jsx";
import ImportDialog from "../shared/ImportDialog.jsx";
import Metric from "../shared/Metric.jsx";
import Modal from "../shared/Modal.jsx";

export default function MealsTab({ state, dispatch, notify }) {
  const [importOpen, setImportOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
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
            <Metric label="Proteina" value={`${formatQty(totals.protein)} / ${formatQty(targets.protein)} g`} />
            <Metric label="Carboidrato" value={`${formatQty(totals.carbs)} / ${formatQty(targets.carbs)} g`} />
            <Metric label="Gordura" value={`${formatQty(totals.fat)} / ${formatQty(targets.fat)} g`} />
            <div className="water-control">
              <span className="water-label">Agua</span>
              <div>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: -0.25 })}>-</button>
                <strong>{formatQty(dayLog.water)} L</strong>
                <button type="button" onClick={() => dispatch({ type: "water/add", delta: 0.25 })}>+</button>
              </div>
            </div>
            <progress max="3.8" value={Math.min(dayLog.water, 3.8)} />
            <div className="timing-control">
              <h3><Clock3 size={16} /> Tolerancia entre refeicoes</h3>
              <label>
                Quantidade de horas minimas entre refeicoes
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="0.5"
                  value={state.dietTiming.minHoursBetweenMeals}
                  onChange={(event) => dispatch({ type: "diet-timing/update", minHoursBetweenMeals: event.target.value })}
                />
              </label>
              <p>O app considera ate 1 hora acima desse valor como janela aceitavel.</p>
            </div>
          </section>
        </aside>

        <div className="diet-main">
          <div className="toolbar">
            <div>
              <h3>Selecao de opcoes</h3>
              <p>Escolha refeicoes, registre consumo e monte o carrinho.</p>
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
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "meal/add" })}><Plus size={16} /> Adicionar refeicao</button>
              <button className="secondary-button" type="button" onClick={() => { dispatch({ type: "day/reset" }); notify("Dia reiniciado. O estoque nao foi alterado."); }}><RotateCcw size={16} /> Reiniciar dia</button>
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
                <p>Resumo das opcoes adicionadas nas refeicoes.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "cart/clear" })}>Limpar</button>
            </div>
            <CartSummary state={state} />
          </section>
        </div>
      </div>
      {importOpen && <ImportDialog title="Importar dieta com IA" kind="diet" state={state} onClose={() => setImportOpen(false)} dispatch={dispatch} notify={notify} />}
      {quickMealOpen && <QuickMealModal state={state} onClose={() => setQuickMealOpen(false)} dispatch={dispatch} notify={notify} />}
      {mealBeingEdited && <MealEditor state={state} meal={mealBeingEdited} initialOption={editingMeal.option} onClose={() => setEditingMeal(null)} dispatch={dispatch} />}
    </section>
  );
}

function QuickMealModal({ state, onClose, dispatch, notify }) {
  const stockItems = allStockItems(state);
  const [stockItemId, setStockItemId] = useState(stockItems[0]?.id || "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [affectStock, setAffectStock] = useState(state.stockManagementEnabled);

  return (
    <Modal title="Refeicao avulsa" onClose={onClose}>
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
          Observacao
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
          notify("Refeicao avulsa registrada.");
          onClose();
        }}>Registrar avulsa</button>
      </footer>
    </Modal>
  );
}
