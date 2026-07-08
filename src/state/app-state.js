import { BASE_STOCK_ITEMS } from "../../data-model.js";
import { DAILY_TARGETS, LEGACY_STORE_KEY, OPTION_LETTERS, STORE_KEY } from "../config.js";
import { clone, formatQty, normalizeText, timestamp, todayKey } from "../utils.js";

const nutritionCatalogModules = import.meta.glob("../../data/nutrition/app-nutrition*.json", { eager: true, import: "default" });
const nutritionCatalog =
  nutritionCatalogModules["../../data/nutrition/app-nutrition.multilang.json"] ||
  nutritionCatalogModules["../../data/nutrition/app-nutrition.pt.clean.json"] ||
  {};

export const SUPPORTED_CONTENT_LANGUAGES = ["pt", "en", "nl", "fr", "es", "it"];

const BASE_STOCK_ITEM_TRANSLATIONS = {
  stk_eggs: { en: "Whole egg", aliases: ["Egg", "Eggs"] },
  stk_egg_whites: { en: "Egg white", aliases: ["Egg whites"] },
  stk_bread: { en: "Whole grain bread", aliases: ["Whole wheat bread", "Bread"] },
  stk_banana: { en: "Banana", aliases: ["Bananas"] },
  stk_albumin: { en: "Albumin powder", aliases: ["Albumin"] },
  stk_oats: { en: "Rolled oats", aliases: ["Oats"] },
  stk_oat_flour: { en: "Oat flour", aliases: ["Oats flour"] },
  stk_peanut_butter: { en: "Peanut butter", aliases: ["Peanut paste"] },
  stk_butter: { en: "Butter", aliases: [] },
  stk_strawberries: { en: "Strawberries", aliases: ["Strawberry"] },
  stk_chicken_breast: { en: "Chicken breast", aliases: ["Chicken"] },
  stk_rice: { en: "Cooked rice", aliases: ["Rice", "Cooked white rice"] },
  stk_olive_oil: { en: "Olive oil", aliases: [] },
  stk_vegetables: { en: "Mixed vegetables", aliases: ["Vegetables"] },
  stk_lean_beef: { en: "Lean beef", aliases: ["Beef"] },
  stk_potato_puree: { en: "Reconstituted instant mashed potatoes", aliases: ["Mashed potatoes", "Potato puree", "Potato"] },
  stk_pasta: { en: "Cooked pasta", aliases: ["Pasta"] },
  stk_tomato_sauce: { en: "Natural tomato sauce", aliases: ["Tomato sauce"] },
  stk_light_mayo: { en: "Light mayonnaise", aliases: ["Light mayo", "Mayonnaise"] },
  stk_salmon: { en: "Grilled salmon", aliases: ["Salmon"] },
  stk_broccoli_carrot: { en: "Steamed broccoli and carrot", aliases: ["Broccoli and carrot", "Broccoli", "Carrot"] },
  stk_nuts: { en: "Nuts or almonds", aliases: ["Nuts", "Almonds"] },
  stk_lactose_free_milk: { en: "Lactose-free skim milk", aliases: ["Skim milk", "Milk"] },
};

export const tabs = [
  { id: "meals", label: "Refeições", title: "Refeições" },
  { id: "workouts", label: "Exercícios", title: "Exercícios" },
  { id: "shopping", label: "Compras", title: "Compras" },
  { id: "stock", label: "Estoque", title: "Estoque" },
  { id: "log", label: "Histórico", title: "Histórico" },
  { id: "settings", label: "Configurações", title: "Configurações" },
];

const LOCAL_UI_STATE_KEYS = [
  "collapsedMeals",
  "cartCollapsed",
];

const BASE_INGREDIENT_CATALOG_ITEMS = mergeIngredientCatalog(BASE_STOCK_ITEMS, nutritionCatalog?.items || []);
const BASE_INGREDIENT_CATALOG_IDS = new Set(BASE_INGREDIENT_CATALOG_ITEMS.map((item) => item.id));

export const initialState = {
  version: 3,
  meals: [],
  selections: {},
  dailyLogs: {},
  stockItems: Object.fromEntries(BASE_INGREDIENT_CATALOG_ITEMS.map((item) => [item.id, item])),
  stock: {},
  log: [],
  shoppingCart: {},
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
      workoutRestReminders: true,
      stockAlerts: false,
      cartAlerts: false,
    },
    language: "pt",
  },
  dietTiming: {
    minHoursBetweenMeals: 3,
  },
  mealReminder: {
    nextMealReminderAt: "",
    lastMealReminderBaseMealId: "",
    lastMealReminderNotifiedAt: "",
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

export function getCloudState(state) {
  const cloudState = clone(state);
  for (const key of LOCAL_UI_STATE_KEYS) delete cloudState[key];
  cloudState.stockItems = Object.fromEntries(
    Object.entries(cloudState.stockItems || {}).filter(([id]) => !BASE_INGREDIENT_CATALOG_IDS.has(id)),
  );
  return cloudState;
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
      notificationTypes: {
        ...clone(initialState.appSettings.notificationTypes),
        ...(rawState.appSettings?.notificationTypes || {}),
      },
      language: rawState.appSettings?.language === "en" ? "en" : "pt",
    },
    dailyLogs: rawState.dailyLogs || {},
    dietTiming: {
      ...clone(initialState.dietTiming),
      ...(rawState.dietTiming || {}),
    },
    mealReminder: normalizeMealReminder(rawState.mealReminder),
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
      currentDayLog(next).water = Math.max(0, Math.min(9.9, Number(currentDayLog(next).water || 0) + action.delta));
      return next;
    case "day/reset":
      next.dailyLogs[todayKey()] = { water: 0, completedMeals: {} };
      clearMealReminder(next);
      return next;
    case "diet-timing/update":
      next.dietTiming = { minHoursBetweenMeals: Number(action.minHoursBetweenMeals || 3) };
      recalculateMealReminderFromLatestMeal(next);
      return next;
    case "meal-reminder/notified":
      if (next.mealReminder?.nextMealReminderAt !== action.nextMealReminderAt) return next;
      next.mealReminder.lastMealReminderNotifiedAt = action.notifiedAt || new Date().toISOString();
      return next;
    case "meal/toggle-collapse":
      next.collapsedMeals[action.mealId] = !next.collapsedMeals[action.mealId];
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
      if (next.mealReminder?.lastMealReminderBaseMealId === action.mealId) recalculateMealReminderFromLatestMeal(next);
      return next;
    case "meal/update":
      next.meals = next.meals.map((meal) => meal.id === action.meal.id ? action.meal : meal);
      ensureMealCart(next, action.meal);
      return next;
    case "meal/complete":
      completeMeal(next, action);
      return next;
    case "meal/quick-register":
      registerQuickMealV2(next, action);
      return next;
    case "meal/undo":
      undoMeal(next, action.mealId);
      recalculateMealReminderFromLatestMeal(next);
      return next;
    case "cart/add":
      addSelectedMealToCart(next, action.mealId);
      return next;
    case "cart/set-option-count":
      setCartOptionCount(next, action.mealId, action.option, action.count);
      return next;
    case "cart/clear":
      next.shoppingCart = Object.fromEntries(getMeals(next).map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
      return next;
    case "stock/toggle-management":
      next.stockManagementEnabled = action.value;
      return next;
    case "stock/register":
      registerStockV2(next, action.items, action.kind, action.detail);
      return next;
    case "stock/upsert-item":
      next.stockItems[action.item.id] = action.item;
      return next;
    case "settings/language":
      next.appSettings.language = action.language === "en" ? "en" : "pt";
      return next;
    case "settings/notifications-enabled":
      next.appSettings.notificationsEnabled = Boolean(action.value);
      if (!next.appSettings.notificationsEnabled) clearMealReminder(next);
      return next;
    case "settings/notification-type":
      next.appSettings.notificationTypes = {
        ...clone(initialState.appSettings.notificationTypes),
        ...(next.appSettings.notificationTypes || {}),
        [action.notificationType]: Boolean(action.value),
      };
      if (action.notificationType === "mealReminders") {
        if (action.value) recalculateMealReminderFromLatestMeal(next);
        else clearMealReminder(next);
      }
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

export function getShoppingRows(state, language = "pt") {
  return aggregate(state, getMealItemsForPlan(state), language).map((row) => {
    const inStock = getStockQty(state, row.stockItemId);
    const toBuy = Math.max(0, row.qty - inStock);
    return { ...row, inStock, toBuy, estimatedCost: estimateIngredientCost(state, row.stockItemId, toBuy) };
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
  const meals = getMeals(state);
  if (!meals.length) return totals;
  for (const meal of meals) {
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

export function optionMissingNutritionItems(state, meal, option, language = "pt") {
  return (meal.options?.[option] || [])
    .filter((item) => item.needsReview || isIngredientNutritionMissing(state.stockItems[item.stockItemId]))
    .map((item) => ({
      ...item,
      name: item.label || labelForIngredient(state, item.stockItemId, language),
    }));
}

export function currentDietMissingNutritionItems(state, language = "pt") {
  const missing = [];
  for (const meal of getMeals(state)) {
    const option = state.selections[meal.id] || getOptionKeys(meal)[0];
    for (const item of optionMissingNutritionItems(state, meal, option, language)) {
      missing.push({ ...item, mealId: meal.id, mealTitle: meal.title });
    }
  }
  return missing;
}

export function nutritionSummary(totals) {
  return `${formatQty(totals.kcal)} kcal | ${formatQty(totals.protein)} P / ${formatQty(totals.carbs)} C / ${formatQty(totals.fat)} G`;
}

export function stockItemSearchLabel(item, language = "pt") {
  return ingredientSearchLabelForLanguage(item, language);
}

export function allStockItems(state, language = "pt") {
  return Object.keys(state.stock || {})
    .filter((id) => getStockQty(state, id) > 0 && state.stockItems[id])
    .map((id) => ensureCatalogLanguageFields(state.stockItems[id]))
    .sort((a, b) => ingredientNameForLanguage(a, language).localeCompare(ingredientNameForLanguage(b, language)));
}

export function allIngredientCatalogItems(state) {
  return dedupeIngredientCatalogItems(Object.values(state.stockItems).map(ensureCatalogLanguageFields))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function ingredientSearchLabel(item) {
  return ingredientSearchLabelForLanguage(item, "pt");
}

export function ingredientSearchLabelForLanguage(item, language = "pt") {
  if (!item) return "";
  return `${ingredientNameForLanguage(item, language)} (${item.unit || "un"})`;
}

export function ingredientNameForLanguage(item, language = "pt") {
  if (!item) return "";
  const lang = normalizeContentLanguage(language);
  return item.names?.[lang] || item.names?.pt || item.name || item.id || "";
}

export function ingredientSearchText(item, language = "pt") {
  const lang = normalizeContentLanguage(language);
  const names = [
    item?.names?.[lang],
    item?.names?.pt,
    item?.names?.en,
    item?.name,
    ...(item?.aliasesByLanguage?.[lang] || []),
    ...(item?.aliasesByLanguage?.pt || []),
    ...(item?.aliasesByLanguage?.en || []),
    ...(item?.aliases || []).map((alias) => typeof alias === "string" ? alias : alias?.value),
  ].filter(Boolean);
  return [...new Set(names)].join(" ");
}

export function getStockQty(state, stockItemId) {
  return Math.max(0, Number(state.stock[stockItemId] || 0));
}

export function labelForStockItem(state, stockItemId, language = "pt") {
  return labelForIngredient(state, stockItemId, language);
}

export function unitForStockItem(state, stockItemId) {
  return unitForIngredient(state, stockItemId);
}

export function labelForIngredient(state, id, language = "pt") {
  const item = state.stockItems[id];
  if (!item) return id;
  const lang = normalizeContentLanguage(language);
  return item.names?.[lang] || item.names?.pt || item.name || id;
}

export function unitForIngredient(state, id) {
  return normalizeAllowedUnit(state.stockItems[id]?.unit || "g");
}

export function nutritionForIngredient(state, id) {
  return state.stockItems[id]?.nutrition || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

export function isIngredientNutritionMissing(item) {
  if (!item) return true;
  if (item.needsReview || item.nutritionStatus === "missing" || item.nutritionSource === "import_placeholder") return true;
  const nutrition = item.nutrition || {};
  return !["kcal", "protein", "carbs", "fat"].some((key) => Number(nutrition[key] || 0) > 0);
}

export function priceForIngredient(state, id) {
  const item = state.stockItems[id] || {};
  const price = item.price ?? item.purchasePrice ?? state.shoppingPrices?.[id]?.price;
  const referenceQty = item.priceReferenceQty ?? item.priceQty ?? state.shoppingPrices?.[id]?.qty;
  const referenceUnit = item.priceReferenceUnit ?? item.priceUnit ?? item.unit;
  return {
    price: Number(price || 0),
    referenceQty: Number(referenceQty || 0),
    referenceUnit: normalizeAllowedUnit(referenceUnit || item.unit || "g"),
  };
}

export function estimateIngredientCost(state, id, qty) {
  const price = priceForIngredient(state, id);
  if (!price.price || !price.referenceQty || !qty) return 0;
  return (Number(qty || 0) / price.referenceQty) * price.price;
}

export function stockStatusForIngredient(state, id) {
  const needed = getShoppingRows(state).find((row) => row.stockItemId === id)?.qty || 0;
  const available = getStockQty(state, id);
  if (needed > 0 && available <= 0) return { label: "Sem estoque", className: "status-low" };
  if (needed > 0 && available < needed) return { label: "Comprar", className: "status-low" };
  if (available <= 0) return { label: "Sem estoque", className: "status-low" };
  return { label: "OK", className: "status-ok" };
}

export function normalizeAllowedUnit(unit) {
  const normalized = String(unit || "g").trim().toLowerCase();
  if (normalized === "litro" || normalized === "liter" || normalized === "l") return "l";
  if (normalized === "unidade" || normalized === "unidades" || normalized === "unit") return "un";
  return ["g", "kg", "un", "ml", "l"].includes(normalized) ? normalized : "g";
}

function mergeIngredientCatalog(baseItems, nutritionItems) {
  const byId = new Map();
  const normalizedNames = new Set();
  const addItem = (item) => {
    if (!item?.id || !item?.name || byId.has(item.id)) return;
    const normalizedName = normalizeText(item.name);
    if (normalizedName && normalizedNames.has(normalizedName)) return;
    byId.set(item.id, item);
    if (normalizedName) normalizedNames.add(normalizedName);
  };

  for (const item of baseItems) addItem(ensureCatalogLanguageFields(item));
  for (const item of nutritionItems) addItem(nutritionCatalogItemToStockItem(item));
  return [...byId.values()];
}

function normalizeContentLanguage(language) {
  return SUPPORTED_CONTENT_LANGUAGES.includes(language) ? language : "pt";
}

function uniqueTextValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    const normalized = normalizeText(text);
    if (!text || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(text);
  }
  return result;
}

function aliasValues(aliases, language) {
  return (aliases || [])
    .filter((alias) => typeof alias === "string" || !language || alias?.lang === language)
    .map((alias) => typeof alias === "string" ? alias : alias?.value)
    .filter(Boolean);
}

function ensureCatalogLanguageFields(item) {
  const aliases = item.aliases || [];
  const translation = BASE_STOCK_ITEM_TRANSLATIONS[item.id] || {};
  const ptName = item.names?.pt || item.name;
  const enName = item.names?.en || translation.en;
  return {
    ...item,
    unit: normalizeAllowedUnit(item.unit),
    names: {
      ...(item.names || {}),
      pt: ptName,
      ...(enName ? { en: enName } : {}),
    },
    aliasesByLanguage: {
      ...(item.aliasesByLanguage || {}),
      pt: uniqueTextValues([
        ptName,
        ...(item.aliasesByLanguage?.pt || []),
        ...aliasValues(aliases, "pt"),
      ]),
      ...(enName ? {
        en: uniqueTextValues([
          enName,
          ...(translation.aliases || []),
          ...(item.aliasesByLanguage?.en || []),
          ...aliasValues(aliases, "en"),
        ]),
      } : {}),
    },
  };
}

function nutritionCatalogItemToStockItem(item) {
  const name = item?.names?.pt || item?.name || item?.id || "";
  const referenceAmount = item?.referenceAmount || {};
  const referenceQty = Math.max(1, Number(referenceAmount.quantity || 100));
  return {
    id: item.id,
    name,
    unit: normalizeAllowedUnit(referenceAmount.unit || "g"),
    category: item?.category || "catálogo nutricional",
    nutrition: {
      kcal: Number(item?.nutrition?.kcal || 0) / referenceQty,
      protein: Number(item?.nutrition?.protein || 0) / referenceQty,
      carbs: Number(item?.nutrition?.carbs || 0) / referenceQty,
      fat: Number(item?.nutrition?.fat || 0) / referenceQty,
    },
    aliases: item?.aliases || [],
    names: {
      ...(item?.names || {}),
      pt: item?.names?.pt || name,
      ...(item?.names?.en ? { en: item.names.en } : {}),
    },
    aliasesByLanguage: {
      ...(item?.aliasesByLanguage || {}),
      pt: uniqueTextValues([
        item?.names?.pt || name,
        ...(item?.aliasesByLanguage?.pt || []),
        ...aliasValues(item?.aliases, "pt"),
      ]),
      ...(item?.names?.en ? {
        en: uniqueTextValues([
          item.names.en,
          ...(item?.aliasesByLanguage?.en || []),
          ...aliasValues(item?.aliases, "en"),
        ]),
      } : {}),
    },
    nutritionSource: item?.source?.id || nutritionCatalog?.source || "nutrition_catalog",
  };
}

function dedupeIngredientCatalogItems(items) {
  const byName = new Map();
  for (const item of items) {
    if (!item?.id || !item?.name) continue;
    const normalizedName = normalizeText(item.name) || item.id;
    const existing = byName.get(normalizedName);
    if (!existing) {
      byName.set(normalizedName, item);
      continue;
    }
    const existingIsBase = BASE_INGREDIENT_CATALOG_IDS.has(existing.id);
    const currentIsBase = BASE_INGREDIENT_CATALOG_IDS.has(item.id);
    if (existingIsBase && !currentIsBase) byName.set(normalizedName, item);
  }
  return [...byName.values()];
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
  if (!Array.isArray(next.meals) || !next.meals.length) {
    next.activeDietVersionId = "";
    return;
  }
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

function aggregate(state, items, language = "pt") {
  const map = new Map();
  for (const current of items) {
    const stockItem = state.stockItems[current.stockItemId];
    if (!stockItem) continue;
    const row = map.get(stockItem.id) || { stockItemId: stockItem.id, name: labelForIngredient(state, stockItem.id, language), qty: 0, unit: stockItem.unit };
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
  next.meals.push({ id, title: `Refeição ${next.meals.length + 1}`, subtitle: "Nova refeição", macros: "", options: { A: [] } });
  next.selections[id] = "A";
  next.shoppingCart[id] = { A: 0 };
  return next;
}

function ensureMealCart(next, meal) {
  const optionKeys = getOptionKeys(meal);
  next.selections[meal.id] = optionKeys.includes(next.selections[meal.id]) ? next.selections[meal.id] : optionKeys[0];
  next.shoppingCart[meal.id] = Object.fromEntries(optionKeys.map((option) => [option, Number(next.shoppingCart[meal.id]?.[option] || 0)]));
}

export function nextOptionKey(meal) {
  const used = new Set(getOptionKeys(meal));
  return OPTION_LETTERS.find((letter) => !used.has(letter)) || `Op${Date.now()}`;
}

function completeMeal(next, action) {
  const mealId = action.mealId;
  const meal = getMeals(next).find((current) => current.id === mealId);
  if (!meal) return;
  const selected = action.option || next.selections[mealId] || getOptionKeys(meal)[0];
  const completedAt = action.completedAt || new Date().toISOString();
  const sourceItems = Array.isArray(action.items) ? action.items : (meal.options[selected] || []);
  const ingredients = sourceItems.map((ingredient) => ({
    ...ingredient,
    qty: Math.max(0, Number(ingredient.qty || 0)),
    name: String(ingredient.name || ingredient.label || labelForIngredient(next, ingredient.stockItemId)).trim(),
    unit: normalizeAllowedUnit(ingredient.unit || unitForIngredient(next, ingredient.stockItemId)),
  })).filter((ingredient) => ingredient.stockItemId && ingredient.qty > 0);
  if (!ingredients.length) return;

  if (next.stockManagementEnabled) {
    for (const ingredient of ingredients) {
      next.stock[ingredient.stockItemId] = Math.max(0, getStockQty(next, ingredient.stockItemId) - ingredient.qty);
    }
  }

  const alert = timingAlert(next, mealId, completedAt);

  currentDayLog(next).completedMeals[mealId] = { option: selected, completedAt, items: ingredients, stockChanged: Boolean(next.stockManagementEnabled) };
  scheduleNextMealReminder(next, mealId, completedAt);
  next.log.push({
    date: timestamp(),
    isoDate: completedAt,
    type: next.stockManagementEnabled ? "saida" : "consumo",
    detail: `${meal.title} - Opção ${selected}`,
    items: ingredients,
    alert,
  });
}

function normalizeMealReminder(reminder = {}) {
  const nextMealReminderAt = validIso(reminder.nextMealReminderAt) ? reminder.nextMealReminderAt : "";
  const lastMealReminderNotifiedAt = validIso(reminder.lastMealReminderNotifiedAt) ? reminder.lastMealReminderNotifiedAt : "";
  return {
    nextMealReminderAt,
    lastMealReminderBaseMealId: nextMealReminderAt ? String(reminder.lastMealReminderBaseMealId || "") : "",
    lastMealReminderNotifiedAt,
  };
}

function scheduleNextMealReminder(next, mealId, completedAt) {
  if (!mealReminderSettingsEnabled(next) || !validIso(completedAt)) {
    clearMealReminder(next);
    return;
  }
  if (!hasPlannedMealAfter(next, mealId)) {
    clearMealReminder(next);
    return;
  }
  const minHoursBetweenMeals = Math.max(0, Number(next.dietTiming?.minHoursBetweenMeals || 3));
  const nextMealReminderAt = new Date(new Date(completedAt).getTime() + minHoursBetweenMeals * 36e5).toISOString();
  const previousReminder = next.mealReminder || {};
  const alreadyNotifiedAt = previousReminder.nextMealReminderAt === nextMealReminderAt && previousReminder.lastMealReminderBaseMealId === mealId
    ? previousReminder.lastMealReminderNotifiedAt || ""
    : "";
  next.mealReminder = {
    nextMealReminderAt,
    lastMealReminderBaseMealId: mealId,
    lastMealReminderNotifiedAt: alreadyNotifiedAt,
  };
}

function recalculateMealReminderFromLatestMeal(next) {
  if (!mealReminderSettingsEnabled(next)) {
    clearMealReminder(next);
    return;
  }
  const latest = latestCompletedMeal(next);
  if (!latest) {
    clearMealReminder(next);
    return;
  }
  scheduleNextMealReminder(next, latest.mealId, latest.completedAt);
}

function latestCompletedMeal(state) {
  const completed = currentDayLog(state).completedMeals || {};
  return Object.entries(completed)
    .filter(([mealId, record]) => validIso(record?.completedAt) && hasPlannedMealAfter(state, mealId))
    .map(([mealId, record]) => ({ mealId, completedAt: record.completedAt }))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] || null;
}

function hasPlannedMealAfter(state, mealId) {
  const meals = getMeals(state);
  const index = meals.findIndex((meal) => meal.id === mealId);
  return index >= 0 && index < meals.length - 1;
}

function mealReminderSettingsEnabled(state) {
  return Boolean(state.appSettings?.notificationsEnabled && state.appSettings?.notificationTypes?.mealReminders);
}

function clearMealReminder(next) {
  next.mealReminder = clone(initialState.mealReminder);
}

function validIso(value) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function timingAlert(state, mealId, completedAt) {
  if (mealId === "meal1") return firstMealDeviationAlert(state, completedAt);
  const previousMeal = previousCompletedMeal(state, mealId);
  if (!previousMeal) return null;

  const gapHours = (new Date(completedAt) - new Date(previousMeal.completedAt)) / 36e5;
  const minHoursBetweenMeals = Number(state.dietTiming.minHoursBetweenMeals || 3);
  const maxHoursBetweenMeals = minHoursBetweenMeals + 1;
  if (gapHours < minHoursBetweenMeals) return `Intervalo curto: ${formatQty(gapHours)}h desde a refeição anterior.`;
  if (gapHours > maxHoursBetweenMeals) return `Intervalo longo: ${formatQty(gapHours)}h desde a refeição anterior.`;
  return null;
}

function previousCompletedMeal(state, mealId) {
  const meals = getMeals(state);
  const index = meals.findIndex((meal) => meal.id === mealId);
  const completed = currentDayLog(state).completedMeals;
  for (let i = index - 1; i >= 0; i -= 1) {
    const record = completed[meals[i].id];
    if (record?.completedAt) return record;
  }
  return null;
}

function firstMealDeviationAlert(state, completedAt) {
  const historicalTimes = Object.entries(state.dailyLogs)
    .filter(([day, log]) => day !== todayKey() && log.completedMeals?.meal1?.completedAt)
    .map(([, log]) => minutesOfDay(log.completedMeals.meal1.completedAt))
    .slice(-14);
  if (historicalTimes.length < 3) return null;

  const average = historicalTimes.reduce((sum, value) => sum + value, 0) / historicalTimes.length;
  const current = minutesOfDay(completedAt);
  const delta = current - average;
  if (Math.abs(delta) < 60) return null;
  return `Primeira refeição ${Math.abs(Math.round(delta))} min ${delta > 0 ? "mais tarde" : "mais cedo"} que sua média recente.`;
}

function minutesOfDay(value) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function registerQuickMealV2(next, action) {
  const items = normalizeMovementItems(next, Array.isArray(action.items) ? action.items : [{
    stockItemId: action.stockItemId,
    name: action.name,
    qty: action.qty,
    unit: action.unit,
  }]);
  if (!items.length) return;
  const completedAt = new Date().toISOString();
  currentDayLog(next).completedMeals[`quick_${Date.now()}`] = {
    completedAt,
    option: "Avulsa",
    title: "Refeição avulsa",
    items,
    stockChanged: Boolean(action.affectStock),
  };
  if (action.affectStock) {
    registerStockV2(next, items, "consumo", action.note || "Refeição avulsa");
    return;
  }
  next.log.push({
    date: timestamp(),
    isoDate: completedAt,
    type: "consumo",
    detail: action.note || "Refeição avulsa sem baixa de estoque",
    items,
    stockChanged: false,
  });
}

function registerQuickMeal(next, action) {
  const qty = Number(action.qty || 0);
  if (!action.stockItemId || !qty) return;
  const item = {
    stockItemId: action.stockItemId,
    name: labelForStockItem(next, action.stockItemId),
    qty,
    unit: unitForStockItem(next, action.stockItemId),
  };
  const completedAt = new Date().toISOString();
  currentDayLog(next).completedMeals[`quick_${Date.now()}`] = {
    completedAt,
    option: "Avulsa",
    title: "Refeição avulsa",
    items: [item],
    stockChanged: Boolean(action.affectStock),
  };
  if (action.affectStock) {
    registerStock(next, [item], "consumo", action.note || "Refeição avulsa");
  } else {
    next.log.push({
      date: timestamp(),
      isoDate: completedAt,
      type: "consumo",
      detail: action.note || "Refeição avulsa sem baixa de estoque",
      items: [item],
      stockChanged: false,
    });
  }
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

function setCartOptionCount(next, mealId, option, count) {
  const meal = getMeals(next).find((current) => current.id === mealId);
  if (!meal || !getOptionKeys(meal).includes(option)) return;
  next.shoppingCart[mealId] = next.shoppingCart[mealId] || {};
  next.shoppingCart[mealId][option] = Math.max(0, Number(count || 0));
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

function registerStockV2(next, items, kind, detail) {
  const factor = kind === "entrada" ? 1 : -1;
  const validItems = normalizeMovementItems(next, items);
  for (const item of validItems) {
    next.stock[item.stockItemId] = Math.max(0, getStockQty(next, item.stockItemId) + item.qty * factor);
  }
  if (validItems.length) {
    next.log.push({ date: timestamp(), isoDate: new Date().toISOString(), type: kind, detail, items: validItems });
  }
}

function normalizeMovementItems(state, items = []) {
  return items.map((item) => ({
    stockItemId: item.stockItemId,
    name: String(item.name || item.label || labelForIngredient(state, item.stockItemId)).trim(),
    qty: Math.max(0, Number(item.qty || 0)),
    unit: normalizeAllowedUnit(item.unit || unitForIngredient(state, item.stockItemId)),
  })).filter((item) => item.stockItemId && item.qty > 0);
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
  return { id: `wex_${Date.now()}`, name: "Novo exercício", group: "", notes: "", sets: [createWorkoutSet()] };
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
  return { id: exercise?.id || `wex_${Date.now()}_${Math.random().toString(16).slice(2)}`, name: String(exercise?.name || "Exercício").trim(), group: String(exercise?.group || "").trim(), notes: String(exercise?.notes || "").trim(), sets: (Array.isArray(exercise?.sets) && exercise.sets.length ? exercise.sets : [createWorkoutSet()]).map(normalizeWorkoutSet) };
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
    exercises: day.exercises.map((exercise) => {
      const suggestedLoad = lastWorkoutLoadForExercise(next, exercise.name);
      const clonedExercise = clone(exercise);
      if (suggestedLoad) clonedExercise.sets = clonedExercise.sets.map((set) => ({ ...set, load: set.load || suggestedLoad }));
      return clonedExercise;
    }),
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    phase: "ready",
    remainingSeconds: day.exercises[0]?.sets[0]?.restSeconds || 60,
    timerEndsAt: "",
    setLogs: [],
  };
}

export function lastWorkoutLoadForExercise(state, exerciseName) {
  const name = normalizeText(exerciseName);
  if (!name) return "";
  const logs = state.workoutLogs || [];
  for (let sessionIndex = logs.length - 1; sessionIndex >= 0; sessionIndex -= 1) {
    const rows = logs[sessionIndex].setLogs || [];
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const row = rows[rowIndex];
      if (normalizeText(row.exerciseName) === name && row.load) return row.load;
    }
  }
  return "";
}

export function formatLoadKg(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return /kg\b/i.test(raw) ? raw : `${raw} kg`;
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
  session.durationSeconds = Math.max(0, Math.round((new Date(session.finishedAt) - new Date(session.startedAt)) / 1000));
  next.workoutLogs.push(clone(session));
  next.log.push({ date: timestamp(), isoDate: session.finishedAt, type: "treino", detail: `${session.dayLabel} - ${session.dayTitle}`, items: session.setLogs.map((row) => ({ name: `${row.exerciseName} série ${row.setIndex + 1}: ${formatLoadKg(row.load)} x ${row.reps}`, qty: 1, unit: "série" })) });
  next.workoutSession = null;
}
