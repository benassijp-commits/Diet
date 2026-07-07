import { useState } from "react";
import { Dumbbell, FilePlus, Sparkles, Timer, Trash2 } from "lucide-react";
import { formatLoadKg, formatTimerSeconds, getActiveWorkoutPlan } from "../../state/app-state.js";
import ImportDialog from "../shared/ImportDialog.jsx";
import WorkoutDay from "./WorkoutDay.jsx";
import WorkoutSession from "./WorkoutSession.jsx";

export default function WorkoutsTab({ state, dispatch, notify, t = (key) => key, language = "pt" }) {
  const [importOpen, setImportOpen] = useState(false);
  const [expandedLog, setExpandedLog] = useState("");
  const plan = getActiveWorkoutPlan(state);

  return (
    <section className="tab-panel active">
      <div className="workout-layout">
        <aside className="workout-side">
          <section className="metric-panel">
            <h2><Timer size={18} /> {t("workouts.session")}</h2>
            <WorkoutSession state={state} dispatch={dispatch} notify={notify} t={t} />
          </section>
          <section className="stock-editor">
            <h4>{t("workouts.history")}</h4>
            <div className="alert-list">
              {(state.workoutLogs || []).slice(-8).reverse().map((session) => (
                <div className="alert-item workout-history-item" key={session.id}>
                  <button type="button" className="history-toggle" onClick={() => setExpandedLog(expandedLog === session.id ? "" : session.id)}>
                    <strong>{session.dayLabel} - {session.dayTitle}</strong>
                    <span>{new Date(session.finishedAt || session.startedAt).toLocaleDateString(language === "en" ? "en-US" : "pt-BR")} | {session.setLogs?.length || 0} {t("workouts.sets")} | {session.durationSeconds ? formatTimerSeconds(session.durationSeconds) : "-"}</span>
                  </button>
                  {expandedLog === session.id && (
                    <div className="workout-history-sets">
                      {(session.setLogs || []).map((row, index) => (
                        <div key={`${row.exerciseName}-${index}`}>
                          <strong>{row.exerciseName}</strong>
                          <span>{t("workouts.set")} {row.setIndex + 1}: {row.reps} {t("workouts.reps")}, {formatLoadKg(row.load)}, {t("workouts.rest")} {formatTimerSeconds(row.restSeconds || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {!state.workoutLogs?.length && <p className="empty-state">{t("workouts.noHistory")}</p>}
            </div>
          </section>
        </aside>

        <div className="workout-main">
          <div className="toolbar">
            <div>
              <h3><Dumbbell size={18} /> {t("workouts.title")}</h3>
              <p>{t("workouts.subtitle")}</p>
            </div>
            <div className="toolbar-actions">
              <button className="secondary-button" type="button" onClick={() => setImportOpen(true)}><Sparkles size={16} /> {t("workouts.import")}</button>
              <button className="secondary-button" type="button" onClick={() => {
                const name = prompt(t("workouts.newPrompt"), `${t("workouts.defaultName")} ${new Date().toLocaleDateString(language === "en" ? "en-US" : "pt-BR")}`);
                if (name) dispatch({ type: "workout/new", name });
              }}><FilePlus size={16} /> {t("workouts.new")}</button>
              <select value={state.activeWorkoutPlanId} onChange={(event) => dispatch({ type: "workout/activate", id: event.target.value })}>
                {state.workoutPlans.map((item) => <option key={item.id} value={item.id}>{item.status === "active" ? t("workouts.active") : t("workouts.archived")} - {item.name}</option>)}
              </select>
              <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/day-add" })}>{t("workouts.day")}</button>
              <button className="secondary-button" type="button" onClick={() => confirm(t("workouts.deleteConfirm")) && dispatch({ type: "workout/delete-active" })}><Trash2 size={16} /> {t("workouts.delete")}</button>
            </div>
          </div>
          <section className="workout-plan-head">
            <p className="eyebrow">{t("workouts.activePlan")}</p>
            <h3>{plan?.name || t("workouts.noPlan")}</h3>
            <p>{plan?.notes || t("workouts.defaultNotes")}</p>
          </section>
          <div className="workout-days">
            {plan?.days.map((day) => <WorkoutDay key={day.id} day={day} dispatch={dispatch} t={t} />)}
          </div>
        </div>
      </div>
      {importOpen && <ImportDialog title={t("workouts.import")} kind="workout" state={state} onClose={() => setImportOpen(false)} dispatch={dispatch} notify={notify} t={t} />}
    </section>
  );
}
