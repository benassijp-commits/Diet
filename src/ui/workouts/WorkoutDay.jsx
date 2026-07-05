import WorkoutExercise from "./WorkoutExercise.jsx";

export default function WorkoutDay({ day, dispatch }) {
  const updateDay = (patch) => dispatch({ type: "workout/day-update", day: { ...day, ...patch } });
  return (
    <article className="workout-day-card">
      <header>
        <div><strong>Dia {day.label} - {day.title}</strong><span>{day.exercises.length} exercicio(s)</span></div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-start", dayId: day.id })}>Fazer</button>
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/exercise-add", dayId: day.id })}>Exercicio</button>
        </div>
      </header>
      <div className="workout-day-editor">
        <label>Letra<input value={day.label} onChange={(event) => updateDay({ label: event.target.value.toUpperCase() })} /></label>
        <label>Nome<input value={day.title} onChange={(event) => updateDay({ title: event.target.value })} /></label>
        <label>Notas<input value={day.notes} onChange={(event) => updateDay({ notes: event.target.value })} /></label>
      </div>
      <div className="workout-exercise-list">
        {day.exercises.map((exercise) => <WorkoutExercise key={exercise.id} dayId={day.id} exercise={exercise} dispatch={dispatch} />)}
        {!day.exercises.length && <p className="empty-state">Nenhum exercicio neste dia.</p>}
      </div>
    </article>
  );
}
