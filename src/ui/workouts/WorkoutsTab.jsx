import { useState } from "react";
import { Dumbbell, FilePlus, Sparkles, Timer, Trash2 } from "lucide-react";
import { getActiveWorkoutPlan } from "../../state/app-state.js";
import ImportDialog from "../shared/ImportDialog.jsx";
import WorkoutDay from "./WorkoutDay.jsx";
import WorkoutSession from "./WorkoutSession.jsx";

export default function WorkoutsTab({ state, dispatch, notify }) {
  const [importOpen, setImportOpen] = useState(false);
  const plan = getActiveWorkoutPlan(state);

  return (
    <section className="tab-panel active">
      <div className="workout-layout">
        <aside className="workout-side">
          <section className="metric-panel">
            <h2><Timer size={18} /> Sessao</h2>
            <WorkoutSession state={state} dispatch={dispatch} notify={notify} />
          </section>
          <section className="stock-editor">
            <h4>Historico de cargas</h4>
            <div className="alert-list">
              {(state.workoutLogs || []).slice(-8).reverse().map((session) => (
                <div className="alert-item" key={session.id}><strong>{session.dayLabel} - {session.dayTitle}</strong><span>{session.setLogs?.length || 0} series registradas</span></div>
              ))}
              {!state.workoutLogs?.length && <p className="empty-state">Nenhuma sessao registrada ainda.</p>}
            </div>
          </section>
        </aside>

        <div className="workout-main">
          <div className="toolbar">
            <div>
              <h3><Dumbbell size={18} /> Treinos</h3>
              <p>Monte dias A/B/C, importe planilhas e registre cargas durante a execucao.</p>
            </div>
            <div className="toolbar-actions">
              <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Sparkles size={16} /> Importar treino</button>
              <button className="secondary-button" type="button" onClick={() => {
                const name = prompt("Nome do novo treino:", `Treino ${new Date().toLocaleDateString("pt-BR")}`);
                if (name) dispatch({ type: "workout/new", name });
              }}><FilePlus size={16} /> Novo treino</button>
              <select value={state.activeWorkoutPlanId} onChange={(event) => dispatch({ type: "workout/activate", id: event.target.value })}>
                {state.workoutPlans.map((item) => <option key={item.id} value={item.id}>{item.status === "active" ? "Ativo" : "Arquivado"} - {item.name}</option>)}
              </select>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/day-add" })}>Dia</button>
              <button className="secondary-button" type="button" onClick={() => confirm("Excluir treino ativo?") && dispatch({ type: "workout/delete-active" })}><Trash2 size={16} /> Excluir</button>
            </div>
          </div>
          <section className="workout-plan-head">
            <p className="eyebrow">Plano ativo</p>
            <h3>{plan?.name || "Nenhum treino"}</h3>
            <p>{plan?.notes || "Edite os dias, exercicios, series, repeticoes, cargas e pausas."}</p>
          </section>
          <div className="workout-days">
            {plan?.days.map((day) => <WorkoutDay key={day.id} day={day} dispatch={dispatch} />)}
          </div>
        </div>
      </div>
      {importOpen && <ImportDialog title="Importar treino com IA" kind="workout" state={state} onClose={() => setImportOpen(false)} dispatch={dispatch} notify={notify} />}
    </section>
  );
}
