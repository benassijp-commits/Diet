import WorkoutExercise from "./WorkoutExercise.jsx";

export default function WorkoutDay({ day, dispatch, t }) {
  const updateDay = (patch) => dispatch({ type: "workout/day-update", day: { ...day, ...patch } });
  return (
    <article className="workout-day-card">
      <header>
        <div><strong>{t("workouts.day")} {day.label} - {day.title}</strong><span>{t("workouts.exerciseCount", { count: day.exercises.length })}</span></div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-start", dayId: day.id })}>{t("workouts.doWorkout")}</button>
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/exercise-add", dayId: day.id })}>{t("workouts.exercise")}</button>
        </div>
      </header>
      <div className="workout-day-editor">
        <label>{t("workouts.letter")}<input value={day.label} onChange={(event) => updateDay({ label: event.target.value.toUpperCase() })} /></label>
        <label>{t("workouts.name")}<input value={day.title} onChange={(event) => updateDay({ title: event.target.value })} /></label>
        <label>{t("workouts.notes")}<input value={day.notes} onChange={(event) => updateDay({ notes: event.target.value })} /></label>
      </div>
      <div className="workout-exercise-list">
        {day.exercises.map((exercise) => <WorkoutExercise key={exercise.id} dayId={day.id} exercise={exercise} dispatch={dispatch} t={t} />)}
        {!day.exercises.length && <p className="empty-state">{t("workouts.noExercisesDay")}</p>}
      </div>
    </article>
  );
}
