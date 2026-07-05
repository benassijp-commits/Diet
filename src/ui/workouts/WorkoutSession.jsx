import { useEffect, useState } from "react";
import { formatTimerSeconds } from "../../state/app-state.js";

export default function WorkoutSession({ state, dispatch, notify }) {
  const session = state.workoutSession;
  const [load, setLoad] = useState("");

  useEffect(() => {
    if (!session || session.phase !== "rest") return;
    const timer = window.setInterval(() => {
      if (!state.workoutSession?.timerEndsAt) return;
      const remaining = Math.max(0, Math.ceil((new Date(state.workoutSession.timerEndsAt).getTime() - Date.now()) / 1000));
      if (remaining <= 0) {
        playAlarm();
        dispatch({ type: "workout/session-finish-rest" });
        notify("Pausa concluida.");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [session?.phase, session?.timerEndsAt]);

  if (!session) return <p className="empty-state">Nenhum treino em execucao. Use Fazer em um dia de treino.</p>;

  const exercise = session.exercises[session.currentExerciseIndex];
  const set = exercise?.sets[session.currentSetIndex];
  const totalSets = session.exercises.reduce((sum, item) => sum + item.sets.length, 0);
  const doneSets = session.setLogs.length;
  const seconds = session.phase === "rest" ? Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000)) : (set?.restSeconds || 0);

  return (
    <div className={`workout-timer-card ${session.phase === "rest" ? "running" : ""}`}>
      <div>
        <p className="eyebrow">{session.dayLabel} - {session.dayTitle}</p>
        <h3>{exercise?.name || "Treino concluido"}</h3>
        <span>{doneSets}/{totalSets} series</span>
      </div>
      <div className="timer-display">{formatTimerSeconds(seconds)}</div>
      <div className="timer-meta">
        <strong>Serie atual {exercise ? session.currentSetIndex + 1 : "-"}/{exercise?.sets.length || "-"}</strong>
        <span>Reps {set?.reps || "-"} - pausa {formatTimerSeconds(set?.restSeconds || 0)}</span>
      </div>
      <label className="timer-load-field">
        Carga feita nesta serie
        <input value={load || set?.load || ""} disabled={session.phase !== "ready"} onChange={(event) => setLoad(event.target.value)} placeholder="Ex: 80 kg" />
      </label>
      <button
        className="timer-action"
        type="button"
        disabled={session.phase === "rest"}
        onClick={() => {
          if (session.phase === "done") dispatch({ type: "workout/session-finish" });
          else {
            dispatch({ type: "workout/session-start-rest", load: load || set?.load || "" });
            setLoad("");
          }
        }}
      >
        {session.phase === "rest" ? "Pausa rodando" : session.phase === "done" ? "Salvar treino" : doneSets + 1 >= totalSets ? "Registrar ultima serie" : "Iniciar pausa"}
      </button>
      <div className="toolbar-actions workout-session-actions">
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-add-exercise" })}>Adicionar avulso</button>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-finish" })}>Concluir agora</button>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-cancel" })}>Cancelar</button>
      </div>
    </div>
  );
}

function playAlarm() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.28);
  } catch {
    // Audio is best-effort; visual timer still advances.
  }
}
