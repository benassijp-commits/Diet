import { useState } from "react";
import { FilePlus, Plus, Sparkles } from "lucide-react";
import {
  currentDayLog,
  currentDietTargets,
  currentNutritionTotals,
  getMeals,
} from "../../state/app-state.js";
import { formatQty } from "../../utils.js";
import CartSummary from "./CartSummary.jsx";
import MealCard from "./MealCard.jsx";
import MealEditor from "./MealEditor.jsx";
import ImportDialog from "../shared/ImportDialog.jsx";
import Metric from "../shared/Metric.jsx";

export default function MealsTab({ state, dispatch, notify }) {
  const [importOpen, setImportOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const totals = currentNutritionTotals(state);
  const targets = currentDietTargets(state);
  const dayLog = currentDayLog(state);

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
              <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Sparkles size={16} /> Importar dieta</button>
              <button className="secondary-button" type="button" onClick={() => {
                const name = prompt("Nome da nova dieta:", `Dieta ${new Date().toLocaleDateString("pt-BR")}`);
                if (name) dispatch({ type: "diet/new", name });
              }}><FilePlus size={16} /> Nova dieta</button>
              <select value={state.activeDietVersionId} onChange={(event) => dispatch({ type: "diet/activate", id: event.target.value })}>
                {state.dietVersions.map((version) => <option key={version.id} value={version.id}>{version.status === "active" ? "Ativa" : "Arquivada"} - {version.name}</option>)}
              </select>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "meal/add" })}><Plus size={16} /> Adicionar refeicao</button>
            </div>
          </div>

          <div className="meal-grid">
            {getMeals(state).map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                state={state}
                completed={dayLog.completedMeals[meal.id]}
                onEdit={() => setEditingMeal(meal)}
                dispatch={dispatch}
                notify={notify}
              />
            ))}
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
      {editingMeal && <MealEditor state={state} meal={editingMeal} onClose={() => setEditingMeal(null)} dispatch={dispatch} />}
    </section>
  );
}
