import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChefHat,
  Database,
  Dumbbell,
  FilePlus,
  History,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingCart,
  Sparkles,
  Sun,
  Timer,
  Trash2,
} from "lucide-react";
import { clearAiSettings, loadAiSettings, saveAiSettings } from "../ai-settings.js";
import { extractDietFileText } from "../diet-file-text.js";
import { importDietFromText } from "../diet-importer.js";
import { importWorkoutFromText } from "../workout-importer.js";
import { useAppStore } from "../hooks/useAppStore.js";
import {
  allStockItems,
  createStockItemId,
  currentDayLog,
  currentDietTargets,
  currentNutritionTotals,
  formatTimerSeconds,
  getActiveWorkoutPlan,
  getMeals,
  getOptionKeys,
  getShoppingRows,
  getStockQty,
  labelForStockItem,
  nutritionSummary,
  optionNutritionTotals,
  stockItemSearchLabel,
  tabs,
  unitForStockItem,
} from "../state/app-state.js";
import { escapeHtml, formatQty, formatTime, todayKey } from "../utils.js";

const tabIcons = {
  meals: ChefHat,
  workouts: Dumbbell,
  shopping: ShoppingCart,
  stock: Package,
  log: History,
  settings: Settings,
};

export default function App() {
  const { state, dispatch, auth } = useAppStore();
  const [activeTab, setActiveTab] = useState("meals");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration failed", error));
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2400);
  };

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="app-shell">
      <Sidebar state={state} auth={auth} activeTab={activeTab} onTabChange={setActiveTab} dispatch={dispatch} notify={notify} />
      <main className="main-content">
        <section className="topbar">
          <div>
            <p className="eyebrow">Controle diario</p>
            <h2>{currentTab.title}</h2>
          </div>
          <div className="date-chip">{new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date())}</div>
        </section>

        {activeTab === "meals" && <MealsTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "workouts" && <WorkoutsTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "shopping" && <ShoppingTab state={state} dispatch={dispatch} />}
        {activeTab === "stock" && <StockTab state={state} dispatch={dispatch} notify={notify} />}
        {activeTab === "log" && <LogTab state={state} dispatch={dispatch} />}
        {activeTab === "settings" && <SettingsTab state={state} dispatch={dispatch} auth={auth} notify={notify} />}
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

function Sidebar({ state, auth, activeTab, onTabChange, dispatch, notify }) {
  const water = formatQty(currentDayLog(state).water);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Activity /></div>
        <div className="brand-text">
          <h1>Plano Alimentar</h1>
          <p>Joao Benassi - Protocolo de Recomposicao</p>
        </div>
        <div className="header-status">
          <div className="status-chip"><span className="status-dot" /><span>Peso: 84,1 kg</span></div>
          <div className="status-chip">Agua: {water} L / 3.8 L</div>
          <button className="theme-toggle" type="button" onClick={() => dispatch({ type: "theme/toggle" })}>
            <Sun size={16} /><span>{state.theme === "light" ? "Escuro" : "Claro"}</span>
          </button>
          <button className="theme-toggle alerts-toggle" type="button"><Bell size={16} /><span>{globalAlerts(state).length}</span></button>
        </div>
      </div>

      <section className="data-panel">
        <h2>Memoria</h2>
        <p>{auth.syncStatus}</p>
        <div className="account-card">
          <div>
            <strong>{auth.user?.displayName || "Sem login"}</strong>
            <span>{auth.user?.email || "Firestore desligado"}</span>
          </div>
        </div>
        <div className="data-actions">
          {auth.user ? (
            <button type="button" onClick={() => auth.signOut().then(() => notify("Conta desconectada."))}>Sair</button>
          ) : (
            <button type="button" onClick={() => auth.signIn().catch(() => notify("Nao foi possivel entrar."))}>Entrar com Google</button>
          )}
        </div>
        <div className="data-actions">
          <button type="button" onClick={() => exportState(state)}>Exportar</button>
          <label className="import-button">
            Importar
            <input type="file" accept="application/json" onChange={(event) => importStateFile(event, dispatch, notify)} />
          </label>
        </div>
      </section>

      <nav className="nav-tabs" aria-label="Abas principais">
        {tabs.map((tab) => {
          const Icon = tabIcons[tab.id];
          return (
            <button key={tab.id} className={`nav-tab ${activeTab === tab.id ? "active" : ""}`} type="button" onClick={() => onTabChange(tab.id)}>
              <Icon size={18} /> {tab.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MealsTab({ state, dispatch, notify }) {
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

function Metric({ label, value }) {
  return <div className="metric-row"><span>{label}</span><strong>{value}</strong></div>;
}

function MealCard({ meal, state, completed, onEdit, dispatch, notify }) {
  const optionKeys = getOptionKeys(meal);
  const selected = optionKeys.includes(state.selections[meal.id]) ? state.selections[meal.id] : optionKeys[0];
  const totals = optionNutritionTotals(state, meal, selected);
  return (
    <article className="meal-card">
      <header>
        <div>
          <h3>{meal.title}</h3>
          <p>{meal.subtitle} | {nutritionSummary(totals)}</p>
        </div>
        {completed && <span className="completed-pill">Concluida {formatTime(completed.completedAt)}</span>}
      </header>
      <div className="option-control">
        {optionKeys.map((option) => (
          <button key={option} type="button" className={selected === option ? "active" : ""} onClick={() => dispatch({ type: "meal/select", mealId: meal.id, option })}>Opcao {option}</button>
        ))}
      </div>
      <div className="ingredient-list">
        {(meal.options[selected] || []).map((ingredient, index) => (
          <div className="ingredient-row" key={`${ingredient.stockItemId}-${index}`}>
            <span>{ingredient.label}<small>{labelForStockItem(state, ingredient.stockItemId)}</small></span>
            <strong>{formatQty(ingredient.qty)} {ingredient.unit}</strong>
          </div>
        ))}
      </div>
      <div className="meal-actions">
        {completed ? (
          <button className="secondary-button undo-button" type="button" onClick={() => dispatch({ type: "meal/undo", mealId: meal.id })}>Desfazer</button>
        ) : (
          <button type="button" onClick={() => { dispatch({ type: "meal/complete", mealId: meal.id }); notify("Consumo registrado."); }}>Consumir</button>
        )}
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "cart/add", mealId: meal.id })}>Carrinho</button>
        <button className="secondary-button" type="button" onClick={onEdit}>Editar</button>
        <button className="secondary-button" type="button" onClick={() => confirm(`Excluir ${meal.title}?`) && dispatch({ type: "meal/delete", mealId: meal.id })}>Excluir</button>
      </div>
    </article>
  );
}

function MealEditor({ state, meal, onClose, dispatch }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(meal)));
  const selectedOption = getOptionKeys(draft)[0] || "A";
  const stockItems = allStockItems(state);

  const updateItem = (index, patch) => {
    setDraft((current) => {
      const next = JSON.parse(JSON.stringify(current));
      next.options[selectedOption][index] = { ...next.options[selectedOption][index], ...patch };
      return next;
    });
  };

  return (
    <Modal title={`Editar ${meal.title}`} onClose={onClose}>
      <div className="modal-grid">
        <label>Nome<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Descricao<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      </div>
      <section className="option-editor">
        <div className="cart-header">
          <h4>Ingredientes - Opcao {selectedOption}</h4>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, options: { ...current.options, [selectedOption]: [...(current.options[selectedOption] || []), { label: "Novo alimento", qty: 0, unit: "g", stockItemId: stockItems[0]?.id || "" }] } }))}>Adicionar ingrediente</button>
        </div>
        <div className="ingredient-editor-list">
          {(draft.options[selectedOption] || []).map((item, index) => (
            <div className="ingredient-editor-row" key={index}>
              <label>Alimento<input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
              <label>Quantidade<input type="number" value={item.qty} onChange={(event) => updateItem(index, { qty: Number(event.target.value) })} /></label>
              <label>Unidade<input value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} /></label>
              <label>Ingrediente
                <select value={item.stockItemId} onChange={(event) => updateItem(index, { stockItemId: event.target.value, unit: unitForStockItem(state, event.target.value) })}>
                  {stockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.id}>{stockItemSearchLabel(stockItem)}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      </section>
      <footer>
        <button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>
        <button type="button" onClick={() => { dispatch({ type: "meal/update", meal: draft }); onClose(); }}><Save size={16} /> Salvar refeicao</button>
      </footer>
    </Modal>
  );
}

function CartSummary({ state }) {
  const rows = getMeals(state).map((meal) => {
    const cart = state.shoppingCart[meal.id] || {};
    return { meal, options: getOptionKeys(meal).map((option) => ({ option, count: cart[option] || 0 })) };
  }).filter((row) => row.options.some((item) => item.count > 0));
  if (!rows.length) return <p className="empty-state">Nenhuma refeicao adicionada ao carrinho.</p>;
  return rows.map(({ meal, options }) => (
    <div className="cart-summary-row" key={meal.id}>
      <div><strong>{meal.title}</strong><span>{meal.subtitle}</span></div>
      <div className="cart-option-strip">{options.map(({ option, count }) => <span key={option} className={`cart-option-chip ${count ? "active" : ""}`}>Opcao {option}: {count}</span>)}</div>
    </div>
  ));
}

function WorkoutsTab({ state, dispatch, notify }) {
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

function WorkoutDay({ day, dispatch }) {
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

function WorkoutExercise({ dayId, exercise, dispatch }) {
  const updateExercise = (patch) => dispatch({ type: "workout/exercise-update", dayId, exercise: { ...exercise, ...patch } });
  const updateSet = (setIndex, patch) => dispatch({ type: "workout/set-update", dayId, exerciseId: exercise.id, setIndex, set: { ...exercise.sets[setIndex], ...patch } });
  return (
    <section className="workout-exercise-card">
      <header>
        <div className="workout-exercise-title">
          <input value={exercise.name} onChange={(event) => updateExercise({ name: event.target.value })} />
          <input placeholder="Grupo" value={exercise.group} onChange={(event) => updateExercise({ group: event.target.value })} />
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/set-add", dayId, exerciseId: exercise.id })}>Serie</button>
          <button className="secondary-button" type="button" onClick={() => dispatch({ type: "workout/exercise-delete", dayId, exerciseId: exercise.id })}>Excluir</button>
        </div>
      </header>
      <label className="workout-notes">Notas<input value={exercise.notes} onChange={(event) => updateExercise({ notes: event.target.value })} /></label>
      <div className="workout-set-grid">
        <span>#</span><span>Reps</span><span>Carga</span><span>Pausa</span><span />
        {exercise.sets.map((set, setIndex) => (
          <FragmentRow key={setIndex}>
            <strong>{setIndex + 1}</strong>
            <input value={set.reps} onChange={(event) => updateSet(setIndex, { reps: event.target.value })} />
            <input value={set.load} onChange={(event) => updateSet(setIndex, { load: event.target.value })} />
            <input type="number" min="0" step="5" value={set.restSeconds} onChange={(event) => updateSet(setIndex, { restSeconds: Number(event.target.value) })} />
            <span />
          </FragmentRow>
        ))}
      </div>
    </section>
  );
}

function WorkoutSession({ state, dispatch, notify }) {
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

function ShoppingTab({ state, dispatch }) {
  const rows = getShoppingRows(state);
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>Lista de compras</h3><p>Calculada pelo carrinho montado na aba Refeicoes.</p></div>
        <button className="secondary-button" type="button" onClick={() => navigator.clipboard.writeText(rows.map((row) => `${row.name}\t${formatQty(row.toBuy)}\t${row.unit}`).join("\n"))}>Copiar lista</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ingrediente</th><th>Necessario</th><th>Em estoque</th><th>Comprar</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.stockItemId}><td>{row.name}</td><td>{formatQty(row.qty)} {row.unit}</td><td>{formatQty(row.inStock)} {row.unit}</td><td><strong>{formatQty(row.toBuy)}</strong> {row.unit}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockTab({ state, dispatch, notify }) {
  const [stockItemId, setStockItemId] = useState(allStockItems(state)[0]?.id || "");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState("entrada");
  const [newItem, setNewItem] = useState({ name: "", unit: "g" });
  const items = allStockItems(state);

  return (
    <section className="tab-panel active">
      <div className="toolbar"><div><h3>Estoque e despensa</h3><p>Entradas, saidas e ingredientes.</p></div></div>
      <form className="stock-form" onSubmit={(event) => {
        event.preventDefault();
        dispatch({ type: "stock/register", kind, detail: "Registro manual", items: [{ stockItemId, name: labelForStockItem(state, stockItemId), qty: Number(qty), unit: unitForStockItem(state, stockItemId) }] });
        setQty("");
        notify("Movimento registrado.");
      }}>
        <label>Ingrediente<select value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{stockItemSearchLabel(item)}</option>)}</select></label>
        <label>Quantidade<input type="number" min="0" step="0.1" value={qty} onChange={(event) => setQty(event.target.value)} required /></label>
        <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="entrada">Entrada</option><option value="saida">Saida</option></select></label>
        <button type="submit">Registrar</button>
      </form>
      <section className="stock-editor">
        <h4>Cadastro de ingredientes</h4>
        <div className="stock-editor-grid compact">
          <label>Nome<input value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} /></label>
          <label>Unidade<input value={newItem.unit} onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} /></label>
          <button type="button" onClick={() => {
            if (!newItem.name || !newItem.unit) return;
            const id = createStockItemId(newItem.name);
            dispatch({ type: "stock/upsert-item", item: { id, name: newItem.name, unit: newItem.unit, nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 } } });
            setNewItem({ name: "", unit: "g" });
          }}>Adicionar ingrediente</button>
        </div>
      </section>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ingrediente</th><th>Estoque</th><th>Unidade</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td><strong>{formatQty(getStockQty(state, item.id))}</strong></td><td>{item.unit}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function LogTab({ state, dispatch }) {
  const [type, setType] = useState("");
  const rows = state.log.filter((entry) => !type || entry.type === type).slice().reverse();
  return (
    <section className="tab-panel active">
      <div className="toolbar">
        <div><h3>Historico</h3><p>Rastro de refeicoes, estoque e treinos.</p></div>
        <div className="toolbar-actions">
          <select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option><option value="entrada">Entrada</option><option value="saida">Saida</option><option value="consumo">Consumo</option><option value="treino">Treino</option><option value="ajuste">Ajuste</option></select>
          <button className="secondary-button" type="button" onClick={() => confirm("Limpar historico?") && dispatch({ type: "log/clear" })}>Limpar historico</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Detalhe</th><th>Itens</th></tr></thead>
          <tbody>{rows.map((entry, index) => <tr key={index}><td>{entry.date}</td><td>{entry.type}</td><td>{entry.detail}</td><td>{(entry.items || []).map((item) => `${item.name || labelForStockItem(state, item.stockItemId)}: ${formatQty(item.qty)} ${item.unit || ""}`).join("; ")}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsTab({ state, dispatch, auth, notify }) {
  const [settings, setSettings] = useState(loadAiSettings());
  return (
    <section className="tab-panel active">
      <div className="settings-layout">
        <section className="stock-editor">
          <h4><Sparkles size={16} /> Inteligencia artificial</h4>
          <div className="stock-editor-grid compact">
            <label>Provedor<select value={settings.provider} onChange={(event) => setSettings({ ...settings, provider: event.target.value })}><option value="nanogpt">NanoGPT</option><option value="custom">OpenAI-compatible</option></select></label>
            <label>Base URL<input value={settings.baseUrl} onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })} /></label>
            <label>Modelo<input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} /></label>
            <label>Chave<input type="password" value={settings.apiKey || ""} onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })} /></label>
            <button type="button" onClick={() => { const saved = saveAiSettings(settings); dispatch({ type: "replace", state: { ...state, appSettings: { ...state.appSettings, aiSettings: saved } } }); notify("IA salva."); }}>Salvar IA</button>
            <button className="secondary-button" type="button" onClick={() => { clearAiSettings(); setSettings(loadAiSettings()); notify("Chave removida."); }}>Limpar chave</button>
          </div>
        </section>
        <section className="stock-editor">
          <h4><Database size={16} /> Dietas</h4>
          <div className="alert-list">{state.dietVersions.map((version) => <div className="alert-item" key={version.id}><strong>{version.name}</strong><span>{version.status} - inicio {version.activatedAt}</span></div>)}</div>
        </section>
      </div>
    </section>
  );
}

function ImportDialog({ title, kind, state, onClose, dispatch, notify }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const settings = loadAiSettings();

  const submit = async () => {
    setStatus(`Enviando ${kind === "diet" ? "dieta" : "treino"} para IA...`);
    const imported = kind === "diet"
      ? prepareImportedDiet(await importDietFromText({ text, settings }), state)
      : await importWorkoutFromText({ text, settings });
    dispatch({ type: kind === "diet" ? "diet/import" : "workout/import", imported });
    notify(kind === "diet" ? "Dieta importada." : "Treino importado.");
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-note">Cole texto bruto ou carregue PDF/Excel. O app extrai o conteudo e envia para a IA adaptar ao modelo.</p>
      <label>Arquivo<input type="file" accept=".txt,.md,.csv,.json,.pdf,.xlsx,.xls,.ods,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async (event) => {
        const [file] = event.target.files || [];
        if (!file) return;
        setStatus(`Extraindo texto de ${file.name}...`);
        setText(await extractDietFileText(file));
        setStatus("Arquivo lido. Revise e importe com IA.");
      }} /></label>
      <label>Texto bruto<textarea rows={12} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="purchase-warnings">{status}</div>
      <footer><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button type="button" onClick={submit}>Importar com IA</button></footer>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="meal-modal modal-open">
      <div className="meal-modal-content">
        <header><div><p className="eyebrow">Editor</p><h3>{title}</h3></div><button className="secondary-button icon-button" type="button" onClick={onClose}>x</button></header>
        {children}
      </div>
    </div>
  );
}

function FragmentRow({ children }) {
  return children;
}

function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `plano-alimentar-joao-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importStateFile(event, dispatch, notify) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    dispatch({ type: "replace", state: JSON.parse(await file.text()) });
    notify("Dados importados.");
  } catch {
    notify("Arquivo invalido.");
  } finally {
    event.target.value = "";
  }
}

function globalAlerts(state) {
  return getShoppingRows(state).filter((row) => row.toBuy > 0).slice(0, 8);
}

function prepareImportedDiet(imported, state) {
  const stockItems = {};
  const createdByName = new Map();
  const existing = allStockItems(state);
  const findExisting = (name) => existing.find((item) => item.name.toLowerCase() === String(name || "").toLowerCase());

  return {
    ...imported,
    stockItems,
    meals: imported.meals.map((meal) => ({
      ...meal,
      options: Object.fromEntries(Object.entries(meal.options || {}).map(([option, items]) => [
        option,
        items.map((item) => {
          const match = findExisting(item.label);
          const key = String(item.label || "").toLowerCase();
          const stockItemId = match?.id || createdByName.get(key) || createStockItemId(item.label);
          if (!match) createdByName.set(key, stockItemId);
          if (!match && !stockItems[stockItemId]) {
            stockItems[stockItemId] = {
              id: stockItemId,
              name: item.label,
              unit: item.unit || "g",
              nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
              nutritionSource: "import_placeholder",
            };
          }
          return { ...item, stockItemId };
        }),
      ])),
    })),
  };
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
