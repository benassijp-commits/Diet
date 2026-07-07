import { useEffect, useState } from "react";
import { formatLoadKg, formatTimerSeconds } from "../../state/app-state.js";

export default function WorkoutSession({ state, dispatch, notify, t = (key) => key }) {
  const session = state.workoutSession;
  const [load, setLoad] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session || session.phase !== "rest") return;
    const timer = window.setInterval(() => {
      if (!state.workoutSession?.timerEndsAt) return;
      const remaining = Math.max(0, Math.ceil((new Date(state.workoutSession.timerEndsAt).getTime() - Date.now()) / 1000));
      setTick((value) => value + 1);
      if (remaining <= 0) {
        playAlarm();
        dispatch({ type: "workout/session-finish-rest" });
        notify(t("workouts.timerDone"));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [session?.phase, session?.timerEndsAt, t]);

  if (!session) return <p className="empty-state">{t("workouts.emptySession")}</p>;

  const exercise = session.exercises[session.currentExerciseIndex];
  const set = exercise?.sets[session.currentSetIndex];
  const totalSets = session.exercises.reduce((sum, item) => sum + item.sets.length, 0);
  const doneSets = session.setLogs.length;
  const seconds = session.phase === "rest" ? Math.max(0, Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000)) : (set?.restSeconds || 0);

  return (
    <div className={`workout-timer-card ${session.phase === "rest" ? "running" : ""}`}>
      <div>
        <p className="eyebrow">{session.dayLabel} - {session.dayTitle}</p>
        <h3>{exercise?.name || t("workouts.saveWorkout")}</h3>
        <span>{doneSets}/{totalSets} {t("workouts.sets")}</span>
      </div>
      <div className="timer-display">{formatTimerSeconds(seconds)}</div>
      <div className="timer-meta">
        <strong>{t("workouts.currentSet")} {exercise ? session.currentSetIndex + 1 : "-"}/{exercise?.sets.length || "-"}</strong>
        <span>{t("workouts.reps")} {set?.reps || "-"} - {formatLoadKg(load || set?.load)} - {t("workouts.rest")} {formatTimerSeconds(set?.restSeconds || 0)}</span>
      </div>
      <label className="timer-load-field">
        {t("workouts.loadField")}
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
        {session.phase === "rest" ? t("workouts.pauseRunning") : session.phase === "done" ? t("workouts.saveWorkout") : doneSets + 1 >= totalSets ? t("workouts.registerLast") : t("workouts.startRest")}
      </button>
      <div className="toolbar-actions workout-session-actions">
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-add-exercise" })}>{t("workouts.addExtra")}</button>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-finish" })}>{t("workouts.finishNow")}</button>
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/session-cancel" })}>{t("workouts.cancel")}</button>
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
