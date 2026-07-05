import { BASE_STOCK_ITEMS, MEALS as BASE_MEALS } from "../../data-model.js";
import { DAILY_TARGETS, LEGACY_STORE_KEY, OPTION_LETTERS, STORE_KEY } from "../config.js";
import { clone, formatQty, normalizeText, timestamp, todayKey } from "../utils.js";

export const tabs = [
  { id: "meals", label: "Refeicoes", title: "Refeicoes" },
  { id: "workouts", label: "Exercicios", title: "Exercicios" },
  { id: "shopping", label: "Compras", title: "Compras" },
  { id: "stock", label: "Estoque", title: "Estoque" },
  { id: "log", label: "Historico", title: "Historico" },
  { id: "settings", label: "Configuracoes", title: "Configuracoes" },
];

export const initialState = {
  version: 3,
  meals: clone(BASE_MEALS),
  selections: Object.fromEntries(BASE_MEALS.map((meal) => [meal.id, "A"])),
  dailyLogs: {},
  stockItems: Object.fromEntries(BASE_STOCK_ITEMS.map((item) => [item.id, item])),
  stock: {},
  log: [],
  shoppingCart: Object.fromEntries(BASE_MEALS.map((meal) => [meal.id, { A: 7, B: 0, C: 0 }])),
  shoppingPrices: {},
  stockManagementEnabled: true,
  collapsedMeals: {},
  cartCollapsed: false,
  theme: "dark",
  dietVersions: [],
  activeDietVersionId: "",
  appSettings: {
    notificationsEnabled: false,
    notificationTypes: {
      mealReminders: true,
      stockAlerts: false,
      cartAlerts: false,
    },
  },
  dietTiming: {
    minHoursBetweenMeals: 3,
  },
  workoutPlans: [],
  activeWorkoutPlanId: "",
  workoutLogs: [],
  workoutSession: null,
};

export function loadStoredState() {
  const stored = readJson(STORE_KEY);
  if (stored) return migrateState(stored);

  const legacy = readJson(LEGACY_STORE_KEY);
  if (legacy) return migrateState(legacy);

  return migrateState(clone(initialState));
}

export function persistState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function migrateState(rawState) {
  const next = {
    ...clone(initialState),
    ...rawState,
    meals: clone(rawState.meals || initialState.meals),
    stockItems: {
      ...clone(initialState.stockItems),
      ...(rawState.stockItems || {}),
    },
    selections: {
      ...clone(initialState.selections),
      ...(rawState.selections || {}),
    },
    shoppingCart: {
      ...clone(initialState.shoppingCart),
      ...(rawState.shoppingCart || rawState.weeklyPlan || {}),
    },
    shoppingPrices: rawState.shoppingPrices || {},
    stockManagementEnabled: rawState.stockManagementEnabled ?? true,
    collapsedMeals: rawState.collapsedMeals || {},
    cartCollapsed: Boolean(rawState.cartCollapsed),
    theme: rawState.theme === "light" ? "light" : "dark",
    dietVersions: Array.isArray(rawState.dietVersions) ? rawState.dietVersions : [],
    activeDietVersionId: rawState.activeDietVersionId || "",
    appSettings: {
      ...clone(initialState.appSettings),
      ...(rawState.appSettings || {}),
    },
    dailyLogs: rawState.dailyLogs || {},
    dietTiming: {
      ...clone(initialState.dietTiming),
      ...(rawState.dietTiming || {}),
    },
    workoutPlans: Array.isArray(rawState.workoutPlans) ? rawState.workoutPlans : [],
    activeWorkoutPlanId: rawState.activeWorkoutPlanId || "",
    workoutLogs: Array.isArray(rawState.workoutLogs) ? rawState.workoutLogs : [],
    workoutSession: rawState.workoutSession || null,
    log: Array.isArray(rawState.log) ? rawState.log : [],
    version: 3,
  };

  ensureDietVersionState(next);
  ensureWorkoutPlanState(next);

  for (const [day, log] of Object.entries(next.dailyLogs)) {
    next.dailyLogs[day] = {
      water: Number(log.water || 0),
      completedMeals: log.completedMeals || {},
    };
  }

  next.stock = migrateStock(rawState.stock || {});
  for (const meal of next.meals) {
    const optionKeys = getOptionKeys(meal);
    next.selections[meal.id] = optionKeys.includes(next.selections[meal.id]) ? next.selections[meal.id] : optionKeys[0];
    next.shoppingCart[meal.id] = Object.fromEntries(
      optionKeys.map((option) => [option, Number(next.shoppingCart[meal.id]?.[option] || 0)]),
    );
  }

  return next;
}

export function reducer(state, action) {
  const next = clone(state);

  switch (action.type) {
    case "replace":
      return migrateState(action.state);
    case "theme/toggle":
      next.theme = next.theme === "light" ? "dark" : "light";
      return next;
    case "water/add":
      currentDayLog(next).water = Math.min(9.9, Number(currentDayLog(next).water || 0) + action.delta);
      return next;
    case "meal/select":
      next.selections[action.mealId] = action.option;
      return next;
    case "meal/add":
      return addMeal(next);
    case "meal/delete":
      next.meals = next.meals.filter((meal) => meal.id !== action.mealId);
      delete next.selections[action.mealId];
      delete next.shoppingCart[action.mealId];
      return next;
    case "meal/update":
      next.meals = next.meals.map((meal) => meal.id === action.meal.id ? action.meal : meal);
      ensureMealCart(next, action.meal);
      return next;
    case "meal/complete":
      completeMeal(next, action.mealId);
      return next;
    case "meal/undo":
      undoMeal(next, action.mealId);
      return next;
    case "cart/add":
      addSelectedMealToCart(next, action.mealId);
      return next;
    case "cart/clear":
      next.shoppingCart = Object.fromEntries(getMeals(next).map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
      return next;
    case "stock/toggle-management":
      next.stockManagementEnabled = action.value;
      return next;
    case "stock/register":
      registerStock(next, action.items, action.kind, action.detail);
      return next;
    case "stock/upsert-item":
      next.stockItems[action.item.id] = action.item;
      return next;
    case "log/clear":
      next.log = [];
      return next;
    case "diet/import":
      activateImportedDiet(next, action.imported);
      return next;
    case "diet/new":
      createManualDiet(next, action.name);
      return next;
    case "diet/activate":
      activateDietVersion(next, action.id);
      return next;
    case "workout/import":
      activateWorkoutPlan(next, action.imported);
      return next;
    case "workout/new":
      activateWorkoutPlan(next, { planName: action.name, source: "manual", notes: "Criado manualmente.", days: [createWorkoutDay("A")] });
      return next;
    case "workout/activate":
      activateWorkoutPlanById(next, action.id);
      return next;
    case "workout/delete-active":
      deleteActiveWorkoutPlan(next);
      return next;
    case "workout/day-add":
      getActiveWorkoutPlan(next)?.days.push(createWorkoutDay(String.fromCharCode(65 + getActiveWorkoutPlan(next).days.length)));
      return next;
    case "workout/day-update":
      updateWorkoutDay(next, action.day);
      return next;
    case "workout/exercise-add":
      findWorkoutDay(next, action.dayId)?.exercises.push(createWorkoutExercise());
      return next;
    case "workout/exercise-update":
      updateWorkoutExercise(next, action.dayId, action.exercise);
      return next;
    case "workout/exercise-delete":
      deleteWorkoutExercise(next, action.dayId, action.exerciseId);
      return next;
    case "workout/set-add":
      addWorkoutSet(next, action.dayId, action.exerciseId);
      return next;
    case "workout/set-update":
      updateWorkoutSet(next, action.dayId, action.exerciseId, action.setIndex, action.set);
      return next;
    case "workout/session-start":
      startWorkoutSession(next, action.dayId);
      return next;
    case "workout/session-add-exercise":
      next.workoutSession?.exercises.push(createWorkoutExercise());
      return next;
    case "workout/session-update-set":
      updateSessionSet(next, action.exerciseIndex, action.setIndex, action.set);
      return next;
    case "workout/session-start-rest":
      startWorkoutRest(next, action.load);
      return next;
    case "workout/session-finish-rest":
      finishWorkoutRest(next);
      return next;
    case "workout/session-finish":
      finishWorkoutSession(next);
      return next;
    case "workout/session-cancel":
      next.workoutSession = null;
      return next;
    default:
      return state;
  }
}

export function getMeals(state) {
  return state.meals || initialState.meals;
}

export function getOptionKeys(meal) {
  return Object.keys(meal.options || {}).sort((a, b) => OPTION_LETTERS.indexOf(a) - OPTION_LETTERS.indexOf(b));
}

export function currentDayLog(state) {
  const day = todayKey();
  state.dailyLogs[day] = state.dailyLogs[day] || { water: 0, completedMeals: {} };
  state.dailyLogs[day].completedMeals = state.dailyLogs[day].completedMeals || {};
  return state.dailyLogs[day];
}

export function getActiveWorkoutPlan(state) {
  return state.workoutPlans.find((plan) => plan.id === state.activeWorkoutPlanId) || state.workoutPlans[0] || null;
}

export function getShoppingRows(state) {
  return aggregate(state, getMealItemsForPlan(state)).map((row) => {
    const inStock = getStockQty(state, row.stockItemId);
    return { ...row, inStock, toBuy: Math.max(0, row.qty - inStock) };
  });
}

export function currentNutritionTotals(state) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const record of Object.values(currentDayLog(state).completedMeals || {})) {
    for (const item of record.items || []) addNutrition(state, totals, item);
  }
  return totals;
}

export function currentDietTargets(state) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const meal of getMeals(state)) {
    const option = state.selections[meal.id] || getOptionKeys(meal)[0];
    for (const item of meal.options?.[option] || []) addNutrition(state, totals, item);
  }
  return totals.kcal ? totals : DAILY_TARGETS;
}

export function optionNutritionTotals(state, meal, option) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of meal.options?.[option] || []) addNutrition(state, totals, item);
  return totals;
}

export function nutritionSummary(totals) {
  return `${formatQty(totals.kcal)} kcal | ${formatQty(totals.protein)} P / ${formatQty(totals.carbs)} C / ${formatQty(totals.fat)} G`;
}

export function stockItemSearchLabel(item) {
  return `${item.name} (${item.unit})`;
}

export function allStockItems(state) {
  return Object.values(state.stockItems).sort((a, b) => a.name.localeCompare(b.name));
}

export function getStockQty(state, stockItemId) {
  return Math.max(0, Number(state.stock[stockItemId] || 0));
}

export function labelForStockItem(state, stockItemId) {
  return state.stockItems[stockItemId]?.name || stockItemId;
}

export function unitForStockItem(state, stockItemId) {
  return state.stockItems[stockItemId]?.unit || "";
}

export function createStockItemId(name) {
  return `stk_custom_${normalizeText(name).replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
}

export function formatTimerSeconds(value) {
  const seconds = Math.max(0, Math.round(Number(value || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ensureDietVersionState(next) {
  if (!Array.isArray(next.dietVersions)) next.dietVersions = [];
  if (next.dietVersions.length && next.activeDietVersionId) return;
  const id = `diet_${todayKey()}_baseline`;
  next.activeDietVersionId = id;
  next.dietVersions = [{
    id,
    name: "Dieta atual",
    status: "active",
    activatedAt: todayKey(),
    archivedAt: "",
    source: "baseline",
    meals: clone(next.meals || initialState.meals),
    notes: "Versao inicial criada a partir da dieta existente.",
  }];
}

function ensureWorkoutPlanState(next) {
  if (!Array.isArray(next.workoutPlans)) next.workoutPlans = [];
  if (!next.workoutPlans.length) {
    const id = `workout_${todayKey()}_baseline`;
    next.activeWorkoutPlanId = id;
    next.workoutPlans = [{
      id,
      name: "Treino atual",
      status: "active",
      activatedAt: todayKey(),
      archivedAt: "",
      source: "baseline",
      notes: "Estrutura inicial para importar ou montar dias de treino.",
      days: [createWorkoutDay("A")],
    }];
  }

  if (!next.activeWorkoutPlanId || !next.workoutPlans.some((plan) => plan.id === next.activeWorkoutPlanId)) {
    next.activeWorkoutPlanId = next.workoutPlans[0]?.id || "";
  }
  next.workoutPlans = next.workoutPlans.map(normalizeWorkoutPlan);
}

function migrateStock(stock) {
  const nextStock = {};
  for (const [key, qty] of Object.entries(stock)) nextStock[key] = Math.max(0, Number(qty || 0));
  return nextStock;
}

function addNutrition(state, totals, item) {
  const nutrition = state.stockItems[item.stockItemId]?.nutrition;
  if (!nutrition) return;
  const qty = Number(item.qty || 0);
  totals.kcal += qty * Number(nutrition.kcal || 0);
  totals.protein += qty * Number(nutrition.protein || 0);
  totals.carbs += qty * Number(nutrition.carbs || 0);
  totals.fat += qty * Number(nutrition.fat || 0);
}

function aggregate(state, items) {
  const map = new Map();
  for (const current of items) {
    const stockItem = state.stockItems[current.stockItemId];
    if (!stockItem) continue;
    const row = map.get(stockItem.id) || { stockItemId: stockItem.id, name: stockItem.name, qty: 0, unit: stockItem.unit };
    row.qty += Number(current.qty || 0);
    map.set(stockItem.id, row);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getMealItemsForPlan(state) {
  const items = [];
  for (const meal of getMeals(state)) {
    const plan = state.shoppingCart[meal.id] || {};
    for (const option of getOptionKeys(meal)) {
      const count = Number(plan[option] || 0);
      for (const item of meal.options[option] || []) items.push({ ...item, qty: item.qty * count });
    }
  }
  return items;
}

function addMeal(next) {
  const id = `meal_custom_${Date.now()}`;
  next.meals.push({ id, title: `Refeicao ${next.meals.length + 1}`, subtitle: "Nova refeicao", macros: "", options: { A: [] } });
  next.selections[id] = "A";
  next.shoppingCart[id] = { A: 0 };
  return next;
}

function ensureMealCart(next, meal) {
  const optionKeys = getOptionKeys(meal);
  next.selections[meal.id] = optionKeys.includes(next.selections[meal.id]) ? next.selections[meal.id] : optionKeys[0];
  next.shoppingCart[meal.id] = Object.fromEntries(optionKeys.map((option) => [option, Number(next.shoppingCart[meal.id]?.[option] || 0)]));
}

function completeMeal(next, mealId) {
  const meal = getMeals(next).find((current) => current.id === mealId);
  if (!meal) return;
  const selected = next.selections[mealId] || getOptionKeys(meal)[0];
  const completedAt = new Date().toISOString();
  const ingredients = (meal.options[selected] || []).map((ingredient) => ({
    ...ingredient,
    name: labelForStockItem(next, ingredient.stockItemId),
    unit: unitForStockItem(next, ingredient.stockItemId),
  }));

  if (next.stockManagementEnabled) {
    for (const ingredient of ingredients) {
      next.stock[ingredient.stockItemId] = Math.max(0, getStockQty(next, ingredient.stockItemId) - ingredient.qty);
    }
  }

  currentDayLog(next).completedMeals[mealId] = { option: selected, completedAt, items: ingredients, stockChanged: Boolean(next.stockManagementEnabled) };
  next.log.push({
    date: timestamp(),
    isoDate: completedAt,
    type: next.stockManagementEnabled ? "saida" : "consumo",
    detail: `${meal.title} - Opcao ${selected}`,
    items: ingredients,
  });
}

function undoMeal(next, mealId) {
  const record = currentDayLog(next).completedMeals[mealId];
  if (!record) return;
  if (record.stockChanged !== false) {
    for (const ingredient of record.items || []) {
      next.stock[ingredient.stockItemId] = getStockQty(next, ingredient.stockItemId) + ingredient.qty;
    }
  }
  delete currentDayLog(next).completedMeals[mealId];
  next.log.push({ date: timestamp(), isoDate: new Date().toISOString(), type: "ajuste", detail: `Desfeito consumo de ${mealId}`, items: record.items || [] });
}

function addSelectedMealToCart(next, mealId) {
  const meal = getMeals(next).find((current) => current.id === mealId);
  if (!meal) return;
  const option = next.selections[mealId] || getOptionKeys(meal)[0];
  next.shoppingCart[mealId] = next.shoppingCart[mealId] || {};
  next.shoppingCart[mealId][option] = Number(next.shoppingCart[mealId][option] || 0) + 1;
}

function registerStock(next, items, kind, detail) {
  const factor = kind === "entrada" ? 1 : -1;
  for (const item of items) {
    next.stock[item.stockItemId] = kind === "entrada"
      ? getStockQty(next, item.stockItemId) + item.qty
      : Math.max(0, getStockQty(next, item.stockItemId) - item.qty);
  }
  next.log.push({ date: timestamp(), isoDate: new Date().toISOString(), type: kind, detail, items });
}

function activateImportedDiet(next, imported) {
  const today = todayKey();
  if (imported.stockItems) {
    next.stockItems = {
      ...next.stockItems,
      ...imported.stockItems,
    };
  }
  const previousActive = next.dietVersions.find((version) => version.id === next.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = today;
    previousActive.meals = clone(next.meals);
  }
  const meals = imported.meals.map((meal, index) => ({ ...meal, id: `meal_${Date.now()}_${index}` }));
  const id = `diet_${Date.now()}`;
  next.dietVersions.push({ id, name: imported.dietName, status: "active", activatedAt: today, archivedAt: "", source: "ai_import", notes: imported.notes, meals: clone(meals) });
  next.activeDietVersionId = id;
  next.meals = meals;
  next.selections = Object.fromEntries(meals.map((meal) => [meal.id, getOptionKeys(meal)[0]]));
  next.shoppingCart = Object.fromEntries(meals.map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
}

function createManualDiet(next, name) {
  const today = todayKey();
  const previousActive = next.dietVersions.find((version) => version.id === next.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = today;
    previousActive.meals = clone(next.meals);
  }
  const id = `diet_${Date.now()}`;
  next.dietVersions.push({ id, name, status: "active", activatedAt: today, archivedAt: "", source: "manual", notes: "Criada manualmente.", meals: [] });
  next.activeDietVersionId = id;
  next.meals = [];
  next.selections = {};
  next.shoppingCart = {};
}

function activateDietVersion(next, id) {
  const target = next.dietVersions.find((version) => version.id === id);
  if (!target) return;
  const previousActive = next.dietVersions.find((version) => version.id === next.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = todayKey();
    previousActive.meals = clone(next.meals);
  }
  target.status = "active";
  target.archivedAt = "";
  next.activeDietVersionId = target.id;
  next.meals = clone(target.meals);
  next.selections = Object.fromEntries(next.meals.map((meal) => [meal.id, getOptionKeys(meal)[0]]));
  next.shoppingCart = Object.fromEntries(next.meals.map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
}

function createWorkoutDay(label) {
  const cleanLabel = String(label || "A").trim().toUpperCase() || "A";
  return { id: `wday_${Date.now()}_${cleanLabel}`, label: cleanLabel, title: `Treino ${cleanLabel}`, notes: "", exercises: [] };
}

function createWorkoutExercise() {
  return { id: `wex_${Date.now()}`, name: "Novo exercicio", group: "", notes: "", sets: [createWorkoutSet()] };
}

function createWorkoutSet() {
  return { reps: "8-12", load: "", restSeconds: 60, notes: "" };
}

function normalizeWorkoutPlan(plan) {
  const days = Array.isArray(plan?.days) ? plan.days : [];
  return {
    id: plan?.id || `workout_${Date.now()}`,
    name: String(plan?.name || "Treino").trim() || "Treino",
    status: plan?.status || "archived",
    activatedAt: plan?.activatedAt || todayKey(),
    archivedAt: plan?.archivedAt || "",
    source: plan?.source || "manual",
    notes: String(plan?.notes || "").trim(),
    days: days.length ? days.map(normalizeWorkoutDay) : [createWorkoutDay("A")],
  };
}

function normalizeWorkoutDay(day, index = 0) {
  const label = String(day?.label || String.fromCharCode(65 + index)).trim().toUpperCase() || "A";
  return { id: day?.id || `wday_${Date.now()}_${label}`, label, title: String(day?.title || `Treino ${label}`).trim(), notes: String(day?.notes || "").trim(), exercises: (Array.isArray(day?.exercises) ? day.exercises : []).map(normalizeWorkoutExercise) };
}

function normalizeWorkoutExercise(exercise) {
  return { id: exercise?.id || `wex_${Date.now()}_${Math.random().toString(16).slice(2)}`, name: String(exercise?.name || "Exercicio").trim(), group: String(exercise?.group || "").trim(), notes: String(exercise?.notes || "").trim(), sets: (Array.isArray(exercise?.sets) && exercise.sets.length ? exercise.sets : [createWorkoutSet()]).map(normalizeWorkoutSet) };
}

function normalizeWorkoutSet(set) {
  return { reps: String(set?.reps || "8-12").trim(), load: String(set?.load || "").trim(), restSeconds: Math.max(0, Math.round(Number(set?.restSeconds ?? 60) || 0)), notes: String(set?.notes || "").trim() };
}

function activateWorkoutPlan(next, imported) {
  const previousActive = getActiveWorkoutPlan(next);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = todayKey();
  }
  const id = `workout_${Date.now()}`;
  next.workoutPlans.push(normalizeWorkoutPlan({ id, name: imported.planName || imported.name, status: "active", activatedAt: todayKey(), archivedAt: "", source: imported.source || "ai_import", notes: imported.notes || "", days: imported.days || [createWorkoutDay("A")] }));
  next.activeWorkoutPlanId = id;
}

function activateWorkoutPlanById(next, id) {
  const target = next.workoutPlans.find((plan) => plan.id === id);
  if (!target) return;
  const previousActive = getActiveWorkoutPlan(next);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = todayKey();
  }
  target.status = "active";
  target.archivedAt = "";
  next.activeWorkoutPlanId = target.id;
}

function deleteActiveWorkoutPlan(next) {
  const target = getActiveWorkoutPlan(next);
  if (!target) return;
  next.workoutPlans = next.workoutPlans.filter((plan) => plan.id !== target.id);
  next.activeWorkoutPlanId = next.workoutPlans[0]?.id || "";
  if (!next.workoutPlans.length) ensureWorkoutPlanState(next);
}

function findWorkoutDay(state, dayId) {
  return getActiveWorkoutPlan(state)?.days.find((day) => day.id === dayId);
}

function updateWorkoutDay(next, updatedDay) {
  const day = findWorkoutDay(next, updatedDay.id);
  if (!day) return;
  Object.assign(day, updatedDay);
}

function updateWorkoutExercise(next, dayId, updatedExercise) {
  const day = findWorkoutDay(next, dayId);
  if (!day) return;
  day.exercises = day.exercises.map((exercise) => exercise.id === updatedExercise.id ? normalizeWorkoutExercise(updatedExercise) : exercise);
}

function deleteWorkoutExercise(next, dayId, exerciseId) {
  const day = findWorkoutDay(next, dayId);
  if (!day) return;
  day.exercises = day.exercises.filter((exercise) => exercise.id !== exerciseId);
}

function addWorkoutSet(next, dayId, exerciseId) {
  const exercise = findWorkoutDay(next, dayId)?.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  exercise.sets.push({ ...(exercise.sets.at(-1) || createWorkoutSet()) });
}

function updateWorkoutSet(next, dayId, exerciseId, setIndex, set) {
  const exercise = findWorkoutDay(next, dayId)?.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  exercise.sets[setIndex] = normalizeWorkoutSet(set);
}

function startWorkoutSession(next, dayId) {
  const plan = getActiveWorkoutPlan(next);
  const day = plan?.days.find((current) => current.id === dayId);
  if (!plan || !day || !day.exercises.length) return;
  next.workoutSession = {
    id: `session_${Date.now()}`,
    planId: plan.id,
    planName: plan.name,
    dayId: day.id,
    dayLabel: day.label,
    dayTitle: day.title,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    exercises: clone(day.exercises),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    phase: "ready",
    remainingSeconds: day.exercises[0]?.sets[0]?.restSeconds || 60,
    timerEndsAt: "",
    setLogs: [],
  };
}

function updateSessionSet(next, exerciseIndex, setIndex, set) {
  const sessionSet = next.workoutSession?.exercises[exerciseIndex]?.sets[setIndex];
  if (!sessionSet) return;
  Object.assign(sessionSet, normalizeWorkoutSet(set));
}

function startWorkoutRest(next, load) {
  const session = next.workoutSession;
  if (!session || session.phase === "rest") return;
  const exercise = session.exercises[session.currentExerciseIndex];
  const set = exercise?.sets[session.currentSetIndex];
  if (!exercise || !set) return;
  set.load = load || set.load || "";
  session.setLogs.push({ exerciseIndex: session.currentExerciseIndex, exerciseName: exercise.name, setIndex: session.currentSetIndex, reps: set.reps, load: set.load, restSeconds: set.restSeconds, completedAt: new Date().toISOString() });
  session.phase = "rest";
  session.remainingSeconds = Math.max(0, Number(set.restSeconds || 0));
  session.timerEndsAt = new Date(Date.now() + session.remainingSeconds * 1000).toISOString();
  if (!session.remainingSeconds) finishWorkoutRest(next);
}

function finishWorkoutRest(next) {
  const session = next.workoutSession;
  if (!session) return;
  const exercise = session.exercises[session.currentExerciseIndex];
  if (exercise && session.currentSetIndex < exercise.sets.length - 1) {
    session.currentSetIndex += 1;
    session.remainingSeconds = exercise.sets[session.currentSetIndex]?.restSeconds || 0;
  } else if (session.currentExerciseIndex < session.exercises.length - 1) {
    session.currentExerciseIndex += 1;
    session.currentSetIndex = 0;
    session.remainingSeconds = session.exercises[session.currentExerciseIndex]?.sets[0]?.restSeconds || 0;
  } else {
    session.phase = "done";
    session.remainingSeconds = 0;
    session.timerEndsAt = "";
    return;
  }
  session.phase = "ready";
  session.timerEndsAt = "";
}

function finishWorkoutSession(next) {
  const session = next.workoutSession;
  if (!session) return;
  session.finishedAt = new Date().toISOString();
  next.workoutLogs.push(clone(session));
  next.log.push({ date: timestamp(), isoDate: session.finishedAt, type: "treino", detail: `${session.dayLabel} - ${session.dayTitle}`, items: session.setLogs.map((row) => ({ name: `${row.exerciseName} serie ${row.setIndex + 1}: ${row.load || "-"} x ${row.reps}`, qty: 1, unit: "serie" })) });
  next.workoutSession = null;
}
