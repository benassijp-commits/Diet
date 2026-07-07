import { Fragment } from "react";
import { formatLoadKg } from "../../state/app-state.js";

export default function WorkoutExercise({ dayId, exercise, dispatch, t }) {
  const updateExercise = (patch) => dispatch({ type: "workout/exercise-update", dayId, exercise: { ...exercise, ...patch } });
  const updateSet = (setIndex, patch) => dispatch({ type: "workout/set-update", dayId, exerciseId: exercise.id, setIndex, set: { ...exercise.sets[setIndex], ...patch } });
  return (
    <section className="workout-exercise-card">
      <header>
        <div className="workout-exercise-title">
          <input value={exercise.name} onChange={(event) => updateExercise({ name: event.target.value })} />
          <input placeholder={t("workouts.group")} value={exercise.group} onChange={(event) => updateExercise({ group: event.target.value })} />
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/set-add", dayId, exerciseId: exercise.id })}>{t("workouts.addSet")}</button>
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/exercise-delete", dayId, exerciseId: exercise.id })}>{t("common.delete")}</button>
        </div>
      </header>
      <label className="workout-notes">{t("workouts.notes")}<input value={exercise.notes} onChange={(event) => updateExercise({ notes: event.target.value })} /></label>
      <div className="workout-set-grid">
        <span>#</span><span>{t("workouts.reps")}</span><span>{t("workouts.load")}</span><span>{t("workouts.rest")}</span><span />
        {exercise.sets.map((set, setIndex) => (
          <Fragment key={setIndex}>
            <strong>{setIndex + 1}</strong>
            <input value={set.reps} onChange={(event) => updateSet(setIndex, { reps: event.target.value })} />
            <label className="inline-unit-field"><input value={set.load} onChange={(event) => updateSet(setIndex, { load: event.target.value })} /><span>{set.load ? formatLoadKg(set.load).replace(String(set.load).trim(), "").trim() || "kg" : "kg"}</span></label>
            <input type="number" min="0" step="5" value={set.restSeconds} onChange={(event) => updateSet(setIndex, { restSeconds: Number(event.target.value) })} />
            <span />
          </Fragment>
        ))}
      </div>
    </section>
  );
}
