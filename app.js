import {
  getCurrentUser,
  saveUserState,
  signIn,
  signOut,
  watchSession,
} from "./cloud-store.js";
import { BASE_STOCK_ITEMS, MEALS as BASE_MEALS } from "./data-model.js";
import { clearAiSettings, loadAiSettings, saveAiSettings } from "./src/ai-settings.js";
import { DAILY_TARGETS, LEGACY_STORE_KEY, OPTION_LETTERS, STORE_KEY } from "./src/config.js";
import { importDietFromText } from "./src/diet-importer.js";
import {
  clone,
  escapeAttr,
  escapeHtml,
  formatCurrency,
  formatQty,
  formatTime,
  normalizeText,
  timestamp,
  todayKey,
} from "./src/utils.js";

const initialState = {
  version: 2,
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
};

let state = loadState();
let isApplyingRemoteState = false;
let hasReceivedRemoteState = false;
let pendingCloudSave = null;
let localDirtySince = 0;
let lastCloudSaveStartedAt = 0;
let editingMealId = null;
let editingOptionKey = "A";
let pendingPurchaseRows = [];
let nutritionBase = null;

function loadState() {
  const stored = readJson(STORE_KEY);
  if (stored) return migrateState(stored);

  const legacy = readJson(LEGACY_STORE_KEY);
  if (legacy) return migrateState(legacy);

  return clone(initialState);
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function migrateState(rawState) {
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
    log: Array.isArray(rawState.log) ? rawState.log : [],
    version: 2,
  };

  normalizeBuiltInText(next);
  migrateIngredientPrices(next);
  enrichStockNutrition(next);
  ensureDietVersionState(next);

  if (rawState.completed && !rawState.dailyLogs) {
    for (const [day, completedMeals] of Object.entries(rawState.completed)) {
      next.dailyLogs[day] = next.dailyLogs[day] || { water: 0, completedMeals: {} };
      next.dailyLogs[day].completedMeals = completedMeals;
    }
  }

  for (const [day, log] of Object.entries(next.dailyLogs)) {
    next.dailyLogs[day] = {
      water: Number(log.water || 0),
      completedMeals: log.completedMeals || {},
    };
  }

  if (typeof rawState.water === "number") {
    currentDayLog(next).water = rawState.water;
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

function enrichStockNutrition(next) {
  for (const baseItem of BASE_STOCK_ITEMS) {
    const current = next.stockItems[baseItem.id];
    if (!current) {
      next.stockItems[baseItem.id] = clone(baseItem);
      continue;
    }
    next.stockItems[baseItem.id] = {
      ...baseItem,
      ...current,
      nutrition: {
        ...(baseItem.nutrition || {}),
        ...(current.nutrition || {}),
      },
    };
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
    notes: "Versao inicial criada a partir da dieta funcional existente.",
  }];
}

function normalizeBuiltInText(next) {
  for (const item of BASE_STOCK_ITEMS) {
    next.stockItems[item.id] = {
      ...(next.stockItems[item.id] || {}),
      ...item,
    };
  }

  for (const baseMeal of BASE_MEALS) {
    const meal = next.meals.find((current) => current.id === baseMeal.id);
    if (!meal) continue;

    meal.title = baseMeal.title;
    meal.subtitle = baseMeal.subtitle;
    meal.macros = baseMeal.macros;

    for (const option of Object.keys(baseMeal.options)) {
      if (!meal.options[option]) meal.options[option] = [];
      baseMeal.options[option].forEach((baseItem, index) => {
        if (!meal.options[option][index]) return;
        meal.options[option][index] = {
          ...meal.options[option][index],
          label: baseItem.label,
          unit: baseItem.unit,
          stockItemId: baseItem.stockItemId,
        };
      });
    }
  }
}

function migrateIngredientPrices(next) {
  for (const [id, price] of Object.entries(next.shoppingPrices || {})) {
    if (!next.stockItems[id]) continue;
    next.stockItems[id].price = {
      unitPrice: Number(price.unitPrice || 0),
      packageQty: Number(price.packageQty || price.qty || 1),
      basis: price.basis || defaultPriceBasis(next.stockItems[id].unit),
    };
  }
}

function migrateStock(stock) {
  const nextStock = {};
  for (const [key, qty] of Object.entries(stock)) {
    if (stateHasStockId(key)) {
      nextStock[key] = Math.max(0, Number(qty || 0));
      continue;
    }
    const stockItemId = findStockItemIdByLegacyKey(key);
    if (stockItemId) {
      nextStock[stockItemId] = Math.max(0, Number(nextStock[stockItemId] || 0) + Number(qty || 0));
    }
  }
  return nextStock;
}

function stateHasStockId(key) {
  return key.startsWith("stk_") || initialState.stockItems[key];
}

function findStockItemIdByLegacyKey(key) {
  const [legacyName] = key.split("__");
  const normalized = normalizeText(legacyName);
  const match = Object.values(initialState.stockItems).find((item) => {
    const itemName = normalizeText(item.name);
    return itemName === normalized || normalized.includes(itemName) || itemName.includes(normalized);
  });
  return match?.id;
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  scheduleCloudSave();
}

function scheduleCloudSave() {
  if (!getCurrentUser() || isApplyingRemoteState || !hasReceivedRemoteState) return;
  localDirtySince = localDirtySince || Date.now();
  clearTimeout(pendingCloudSave);
  pendingCloudSave = setTimeout(async () => {
    lastCloudSaveStartedAt = Date.now();
    try {
      await saveUserState(state);
      localDirtySince = 0;
      setSyncStatus("Sincronizado com Firestore.");
    } catch (error) {
      console.error(error);
      setSyncStatus("Falha ao sincronizar. Dados locais preservados.");
    }
  }, 450);
}

function currentDayLog(source = state) {
  const day = todayKey();
  source.dailyLogs[day] = source.dailyLogs[day] || { water: 0, completedMeals: {} };
  source.dailyLogs[day].completedMeals = source.dailyLogs[day].completedMeals || {};
  return source.dailyLogs[day];
}

function getMeals() {
  return state.meals || initialState.meals;
}

function getOptionKeys(meal) {
  return Object.keys(meal.options || {}).sort((a, b) => OPTION_LETTERS.indexOf(a) - OPTION_LETTERS.indexOf(b));
}

function nextOptionKey(meal) {
  const used = new Set(getOptionKeys(meal));
  return OPTION_LETTERS.find((letter) => !used.has(letter)) || `Op${Date.now()}`;
}

function getSelectedItems() {
  return getMeals().flatMap((meal) => {
    const option = state.selections[meal.id] || getOptionKeys(meal)[0];
    return meal.options[option] || [];
  });
}

function getMealItemsForPlan() {
  const items = [];
  for (const meal of getMeals()) {
    const plan = normalizedCart(meal.id);
    for (const option of getOptionKeys(meal)) {
      const count = Number(plan[option] || 0);
      for (const item of meal.options[option] || []) {
        items.push({ ...item, qty: item.qty * count });
      }
    }
  }
  return items;
}

function getWeeklyPurchaseRows() {
  return aggregate(getMealItemsForPlan())
    .map((row) => ({
      ...row,
      qty: Math.max(0, row.qty - getStockQty(row.stockItemId)),
    }))
    .filter((row) => row.qty > 0);
}

function getWeeklyShoppingRows() {
  return aggregate(getMealItemsForPlan()).map((row) => {
    const inStock = getStockQty(row.stockItemId);
    const toBuy = Math.max(0, row.qty - inStock);
    const price = ingredientPrice(row.stockItemId);
    const unitPrice = Number(price.unitPrice || 0);
    const basis = price.basis || defaultPriceBasis(row.unit);
    const packageQty = Number(price.packageQty || 1);
    const estimate = estimateCost(toBuy, row.unit, unitPrice, basis, packageQty);
    const priceLabel = unitPrice
      ? packageQty > 1
        ? `${formatCurrency(unitPrice)} / ${formatQty(packageQty)} ${basis}`
        : `${formatCurrency(unitPrice)} / ${basis}`
      : "-";

    return {
      ...row,
      inStock,
      toBuy,
      unitPrice,
      basis,
      packageQty,
      estimate,
      priceLabel,
    };
  });
}

function weeklyShoppingTotal(rows = getWeeklyShoppingRows()) {
  return rows.reduce((sum, row) => sum + row.estimate, 0);
}

function cartMealTotals() {
  return getMeals().map((meal) => {
    const cart = normalizedCart(meal.id);
    return {
      meal,
      total: getOptionKeys(meal).reduce((sum, option) => sum + Number(cart[option] || 0), 0),
    };
  });
}

function cartValidationMessage() {
  const totals = cartMealTotals();
  const positiveTotals = totals.map((row) => row.total).filter((total) => total > 0);
  if (!positiveTotals.length) return "Carrinho vazio. Adicione refeições antes de registrar compra.";

  const target = Math.max(...positiveTotals);
  const missing = totals.filter((row) => row.total < target);
  if (!missing.length) return "";

  return [
    `O carrinho parece cobrir ${target} dia(s), mas algumas refeições têm menos opções adicionadas:`,
    ...missing.map((row) => `${row.meal.title}: ${row.total}/${target}`),
  ].join("\n");
}

function normalizedCart(mealId) {
  const meal = getMeals().find((current) => current.id === mealId);
  const plan = state.shoppingCart[mealId] || {};
  return Object.fromEntries(getOptionKeys(meal || { options: { A: [] } }).map((option) => [option, Number(plan[option] || 0)]));
}

function aggregate(items) {
  const map = new Map();
  for (const current of items) {
    const stockItem = state.stockItems[current.stockItemId];
    if (!stockItem) continue;
    const row = map.get(stockItem.id) || {
      stockItemId: stockItem.id,
      name: stockItem.name,
      qty: 0,
      unit: stockItem.unit,
    };
    row.qty += current.qty;
    map.set(stockItem.id, row);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function allStockItems() {
  return Object.values(state.stockItems).sort((a, b) => a.name.localeCompare(b.name));
}

function getStockQty(stockItemId) {
  return Math.max(0, Number(state.stock[stockItemId] || 0));
}

function render() {
  applyTheme();
  renderDate();
  renderTimingControls();
  renderStockManagementControl();
  renderMeals();
  renderNutritionProgress();
  renderCartSummary();
  renderCartPanelState();
  renderShopping();
  renderStockOptions();
  renderStock();
  renderStockEditor();
  renderLog();
  renderWater();
  renderSettings();
  renderActiveDietControl();
  renderDietVersions();
  renderGlobalAlerts();
  refreshIcons();
  saveState();
}

function applyTheme() {
  const isLight = state.theme === "light";
  document.body.classList.toggle("light-mode", isLight);
  document.documentElement.style.colorScheme = isLight ? "light" : "dark";
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.innerHTML = `<i data-lucide="${isLight ? "moon" : "sun"}" aria-hidden="true"></i><span>${isLight ? "Escuro" : "Claro"}</span>`;
  }
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2,
      },
    });
  }
}

function renderDate() {
  document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());
}

function renderTimingControls() {
  if (!document.getElementById("minMealGap")) return;
  document.getElementById("minMealGap").value = String(state.dietTiming.minHoursBetweenMeals);
}

function renderStockManagementControl() {
  const toggle = document.getElementById("stockManagementToggle");
  if (!toggle) return;
  toggle.checked = Boolean(state.stockManagementEnabled);
}

function renderMeals() {
  const grid = document.getElementById("mealGrid");
  grid.innerHTML = "";
  const dayLog = currentDayLog();

  for (const meal of getMeals()) {
    const optionKeys = getOptionKeys(meal);
    const selected = optionKeys.includes(state.selections[meal.id]) ? state.selections[meal.id] : optionKeys[0];
    const completedRecord = dayLog.completedMeals[meal.id];
    const isCollapsed = Boolean(state.collapsedMeals?.[meal.id]);
    const card = document.createElement("article");
    card.className = `meal-card${isCollapsed ? " collapsed" : ""}`;
    card.innerHTML = `
      <header>
        <div>
          <h3><i data-lucide="utensils" aria-hidden="true"></i> ${meal.title}</h3>
          <p>${meal.subtitle} | ${meal.macros}</p>
        </div>
        ${completedRecord ? `<span class="completed-pill"><i data-lucide="check-circle-2" aria-hidden="true"></i> Concluída ${formatTime(completedRecord.completedAt)}</span>` : ""}
      </header>
      <div class="option-control" role="group" aria-label="Opções de ${meal.title}">
        ${optionKeys.map(
          (option) =>
            `<button type="button" class="${selected === option ? "active" : ""}" data-meal="${meal.id}" data-option="${option}">Opção ${option}</button>`,
        ).join("")}
      </div>
      <div class="ingredient-list">
        ${(meal.options[selected] || [])
          .map((ingredient) => {
            const stockItem = state.stockItems[ingredient.stockItemId];
            return `
              <div class="ingredient-row">
                <span>${ingredient.label}<small>${stockItem?.name || "Sem item de estoque"}</small></span>
                <strong>${formatQty(ingredient.qty)} ${ingredient.unit}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="meal-actions">
        <button type="button" ${completedRecord ? `data-undo-meal="${meal.id}" class="secondary-button undo-button"` : `data-complete="${meal.id}"`}>
          <i data-lucide="${completedRecord ? "undo-2" : "check"}" aria-hidden="true"></i>
          ${completedRecord ? "Desfazer" : "Consumir"}
        </button>
        <button class="secondary-button" type="button" data-add-cart="${meal.id}">
          <i data-lucide="shopping-cart" aria-hidden="true"></i>
          Carrinho
        </button>
        <button class="secondary-button" type="button" data-edit-meal="${meal.id}">
          <i data-lucide="pencil" aria-hidden="true"></i>
          Editar
        </button>
        <button class="secondary-button" type="button" data-delete-meal="${meal.id}">
          <i data-lucide="trash-2" aria-hidden="true"></i>
          Excluir
        </button>
      </div>
    `;
    const header = card.querySelector("header");
    header.dataset.toggleMeal = meal.id;
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", String(!isCollapsed));
    const collapseIndicator = document.createElement("span");
    collapseIndicator.className = "meal-collapse-indicator";
    collapseIndicator.innerHTML = `<i data-lucide="${isCollapsed ? "chevron-down" : "chevron-up"}" aria-hidden="true"></i>`;
    header.appendChild(collapseIndicator);
    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selections[button.dataset.meal] = button.dataset.option;
      render();
    });
  });

  grid.querySelectorAll("[data-toggle-meal]").forEach((header) => {
    header.addEventListener("click", (event) => {
      if (isInteractiveToggleChild(event.target, header)) return;
      toggleMealCollapse(header.dataset.toggleMeal);
    });
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleMealCollapse(header.dataset.toggleMeal);
    });
  });

  grid.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => completeMeal(button.dataset.complete));
  });

  grid.querySelectorAll("[data-undo-meal]").forEach((button) => {
    button.addEventListener("click", () => undoMeal(button.dataset.undoMeal));
  });

  grid.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => addSelectedMealToCart(button.dataset.addCart));
  });

  grid.querySelectorAll("[data-edit-meal]").forEach((button) => {
    button.addEventListener("click", () => editMeal(button.dataset.editMeal));
  });

  grid.querySelectorAll("[data-delete-meal]").forEach((button) => {
    button.addEventListener("click", () => deleteMeal(button.dataset.deleteMeal));
  });
}

function toggleMealCollapse(mealId) {
  state.collapsedMeals = state.collapsedMeals || {};
  state.collapsedMeals[mealId] = !state.collapsedMeals[mealId];
  render();
}

function isInteractiveToggleChild(target, container) {
  return Boolean(target?.closest?.("button, input, select, textarea, a, label") && target.closest("button, input, select, textarea, a, label") !== container);
}

function renderNutritionProgress() {
  const totals = currentNutritionTotals();
  const rows = [
    { selector: ".metric-row:nth-of-type(1)", value: totals.kcal, target: DAILY_TARGETS.kcal, suffix: "kcal" },
    { selector: ".metric-row:nth-of-type(2)", value: totals.protein, target: DAILY_TARGETS.protein, suffix: "g" },
    { selector: ".metric-row:nth-of-type(3)", value: totals.carbs, target: DAILY_TARGETS.carbs, suffix: "g" },
    { selector: ".metric-row:nth-of-type(4)", value: totals.fat, target: DAILY_TARGETS.fat, suffix: "g" },
  ];

  for (const row of rows) {
    const element = document.querySelector(row.selector);
    if (!element) continue;
    const progress = row.target ? Math.min(100, Math.max(0, (row.value / row.target) * 100)) : 0;
    element.style.setProperty("--progress", `${progress}%`);
    const strong = element.querySelector("strong");
    if (strong) strong.textContent = `${formatQty(row.value)} / ${formatQty(row.target)} ${row.suffix}`;
  }
}

function currentNutritionTotals() {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const completed = Object.values(currentDayLog().completedMeals || {});
  for (const record of completed) {
    for (const item of record.items || []) {
      addNutrition(totals, item);
    }
  }
  return totals;
}

function addNutrition(totals, item) {
  const nutrition = state.stockItems[item.stockItemId]?.nutrition;
  if (!nutrition) return;
  const qty = Number(item.qty || 0);
  totals.kcal += qty * Number(nutrition.kcal || 0);
  totals.protein += qty * Number(nutrition.protein || 0);
  totals.carbs += qty * Number(nutrition.carbs || 0);
  totals.fat += qty * Number(nutrition.fat || 0);
}

function renderShopping() {
  fillDailyShopping();
  fillWeeklyShopping();
}

function renderCartSummary() {
  const container = document.getElementById("cartSummary");
  if (!container) return;

  const rows = getMeals().map((meal) => {
    const cart = normalizedCart(meal.id);
    return {
      meal,
      options: getOptionKeys(meal).map((option) => ({ option, count: cart[option] || 0 })),
    };
  }).filter((row) => row.options.some((item) => item.count > 0));

  if (!rows.length) {
    container.innerHTML = '<p class="empty-state">Nenhuma refeição adicionada ao carrinho.</p>';
    return;
  }

  container.innerHTML = rows
    .map(
      ({ meal, options }) => `
        <div class="cart-summary-row">
          <div>
            <strong>${meal.title}</strong>
            <span>${meal.subtitle}</span>
          </div>
          <div class="cart-option-strip">
            ${options
              .map(
                ({ option, count }) => `
                  <div class="cart-option-chip ${count > 0 ? "active" : ""}">
                    <span>Opção ${option}</span>
                    <div class="cart-counter">
                      <button type="button" data-cart-delta="-1" data-cart-meal="${meal.id}" data-cart-option="${option}">-</button>
                      <input type="number" min="0" step="1" value="${count}" data-cart-input data-cart-meal="${meal.id}" data-cart-option="${option}" />
                      <button type="button" data-cart-delta="1" data-cart-meal="${meal.id}" data-cart-option="${option}">+</button>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      `,
    )
    .join("");

  container.querySelectorAll("[data-cart-input]").forEach((input) => {
    input.addEventListener("change", () => {
      const mealId = input.dataset.cartMeal;
      const option = input.dataset.cartOption;
      state.shoppingCart[mealId] = normalizedCart(mealId);
      state.shoppingCart[mealId][option] = Math.max(0, Number(input.value || 0));
      render();
    });
  });

  container.querySelectorAll("[data-cart-delta]").forEach((button) => {
    button.addEventListener("click", () => {
      const mealId = button.dataset.cartMeal;
      const option = button.dataset.cartOption;
      state.shoppingCart[mealId] = normalizedCart(mealId);
      state.shoppingCart[mealId][option] = Math.max(0, state.shoppingCart[mealId][option] + Number(button.dataset.cartDelta));
      render();
    });
  });
}

function renderCartPanelState() {
  const panel = document.querySelector(".weekly-plan-card");
  if (!panel) return;
  const isCollapsed = Boolean(state.cartCollapsed);
  panel.classList.toggle("collapsed", isCollapsed);
  const summary = document.getElementById("cartSummary");
  if (summary) summary.hidden = isCollapsed;

  let indicator = panel.querySelector(".cart-collapse-indicator");
  const header = panel.querySelector(".cart-header");
  header?.setAttribute("role", "button");
  header?.setAttribute("tabindex", "0");
  header?.setAttribute("aria-expanded", String(!isCollapsed));
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "cart-collapse-indicator";
    header?.appendChild(indicator);
  }
  indicator.innerHTML = `<i data-lucide="${isCollapsed ? "chevron-down" : "chevron-up"}" aria-hidden="true"></i>`;
}

function toggleCartPanel() {
  state.cartCollapsed = !state.cartCollapsed;
  render();
}

function addSelectedMealToCart(mealId) {
  const meal = getMeals().find((current) => current.id === mealId);
  if (!meal) return;
  const option = state.selections[mealId] || getOptionKeys(meal)[0];
  state.shoppingCart[mealId] = normalizedCart(mealId);
  state.shoppingCart[mealId][option] = Number(state.shoppingCart[mealId][option] || 0) + 1;
  toast(`${meal.title} · Opção ${option} adicionada ao carrinho.`);
  render();
}

function fillDailyShopping() {
  const rows = aggregate(getSelectedItems());
  const tbody = document.getElementById("dailyShopping");
  tbody.innerHTML = rows
    .map((row) => {
      const inStock = getStockQty(row.stockItemId);
      const ok = inStock >= row.qty;
      return `
        <tr>
          <td data-label="Ingrediente">${row.name}</td>
          <td data-label="Necessario hoje"><strong>${formatQty(row.qty)}</strong> ${row.unit}</td>
          <td data-label="Em estoque">${formatQty(inStock)} ${row.unit}</td>
          <td data-label="Status"><span class="status-pill ${ok ? "status-ok" : "status-low"}">${ok ? "Ok" : "Comprar"}</span></td>
        </tr>
      `;
    })
    .join("");
}

function fillWeeklyShopping() {
  const rows = getWeeklyShoppingRows();
  const tbody = document.getElementById("weeklyShopping");
  const total = weeklyShoppingTotal(rows);
  tbody.innerHTML = rows
    .map((row) => {
      return `
        <tr class="${row.toBuy > 0 ? "purchase-needed-row" : ""}">
          <td data-label="Ingrediente">${row.name}</td>
          <td data-label="Necessario"><strong>${formatQty(row.qty)}</strong> ${row.unit}</td>
          <td data-label="Em estoque">${formatQty(row.inStock)} ${row.unit}</td>
          <td data-label="Comprar" class="buy-cell"><strong>${formatQty(row.toBuy)}</strong> ${row.unit}</td>
          <td data-label="Preco">${row.priceLabel}</td>
          <td data-label="Estimativa">${row.unitPrice ? formatCurrency(row.estimate) : "-"}</td>
        </tr>
      `;
    })
    .join("")
    + `<tr class="shopping-total-row"><td colspan="5">Total estimado do carrinho</td><td>${formatCurrency(total)}</td></tr>`;
}

function buildShoppingListPrintHtml() {
  const rows = getWeeklyShoppingRows().filter((row) => row.toBuy > 0);
  const total = weeklyShoppingTotal(rows);
  const date = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const bodyRows = rows.length
    ? rows
      .map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${formatQty(row.toBuy)} ${escapeHtml(row.unit)}</td>
          <td>${escapeHtml(row.priceLabel)}</td>
          <td>${row.unitPrice ? formatCurrency(row.estimate) : "-"}</td>
        </tr>
      `)
      .join("")
    : '<tr><td colspan="4">Carrinho vazio ou estoque suficiente para todos os itens.</td></tr>';

  return `<!doctype html>
    <html lang="pt">
      <head>
        <meta charset="utf-8">
        <title>Lista de compras</title>
        <style>
          @page { margin: 16mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #102033;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }
          h1 {
            margin: 0 0 4px;
            font-size: 22px;
          }
          p {
            margin: 0 0 18px;
            color: #475569;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            border-bottom: 1px solid #d8e1ed;
            padding: 9px 8px;
            text-align: left;
            vertical-align: top;
            word-break: normal;
            overflow-wrap: normal;
            hyphens: none;
          }
          th {
            background: #eef6ff;
            color: #475569;
            font-size: 10px;
            text-transform: uppercase;
          }
          td:nth-child(2),
          td:nth-child(4) {
            font-weight: 700;
            white-space: nowrap;
          }
          tfoot td {
            border-top: 2px solid #2563eb;
            border-bottom: 0;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        <h1>Lista de compras</h1>
        <p>Plano Alimentar Joao - gerada em ${escapeHtml(date)}</p>
        <table>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Comprar</th>
              <th>Preco</th>
              <th>Estimativa</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total estimado</td>
              <td>${formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>`;
}

function printShoppingListPdf() {
  const frame = document.createElement("iframe");
  frame.title = "Lista de compras para impressao";
  frame.className = "print-frame";
  document.body.appendChild(frame);

  const doc = frame.contentDocument || frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    toast("Nao foi possivel preparar a impressao.");
    return;
  }

  doc.open();
  doc.write(buildShoppingListPrintHtml());
  doc.close();

  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1200);
  }, 120);
}

window.printShoppingListPdf = printShoppingListPdf;
globalThis.printShoppingListPdf = printShoppingListPdf;

function defaultPriceBasis(unit) {
  if (unit === "g") return "kg";
  if (unit === "ml") return "l";
  return "unidade";
}

function estimateCost(qty, unit, unitPrice, basis, packageQty = 1) {
  if (!unitPrice || !qty) return 0;
  const baseQty = Number(packageQty || 1);
  if (basis === "kg" && unit === "g") return (qty / (baseQty * 1000)) * unitPrice;
  if (basis === "l" && unit === "ml") return (qty / (baseQty * 1000)) * unitPrice;
  return (qty / baseQty) * unitPrice;
}

function ingredientPrice(stockItemId) {
  const item = state.stockItems[stockItemId];
  const legacy = state.shoppingPrices?.[stockItemId];
  return item?.price || legacy || {};
}

function renderStockOptions() {
  const selects = [document.getElementById("stockItem"), document.getElementById("stockEditorSelect"), document.getElementById("quickMealStockItem")].filter(Boolean);
  for (const select of selects) {
    const current = select.value;
    const addNew = select.id === "stockEditorSelect" ? '<option value="__new">Novo ingrediente</option>' : "";
    select.innerHTML = addNew + allStockItems()
      .map((item) => `<option value="${item.id}">${item.name} (${item.unit})</option>`)
      .join("");
    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  }
}

function renderStock() {
  const tbody = document.getElementById("stockTable");
  const weeklyRows = aggregate(getMealItemsForPlan());
  tbody.innerHTML = allStockItems()
    .map((item) => {
      const qty = getStockQty(item.id);
      const weeklyNeed = weeklyRows.find((row) => row.stockItemId === item.id)?.qty || 0;
      const status = stockStatus(qty, weeklyNeed);
      const price = ingredientPrice(item.id);
      const unitPrice = Number(price.unitPrice || 0);
      const basis = price.basis || defaultPriceBasis(item.unit);
      const packageQty = Number(price.packageQty || 1);
      const priceLabel = unitPrice
        ? packageQty > 1
          ? `${formatCurrency(unitPrice)} / ${formatQty(packageQty)} ${basis}`
          : `${formatCurrency(unitPrice)} / ${basis}`
        : "-";
      const nutrition = item.nutrition || {};
      const macrosLabel = nutrition.kcal
        ? `${formatQty(nutrition.kcal)} kcal | P ${formatQty(nutrition.protein)} C ${formatQty(nutrition.carbs)} G ${formatQty(nutrition.fat)}`
        : "-";
      return `
        <tr>
          <td data-label="Ingrediente">${item.name}</td>
          <td data-label="Estoque"><strong>${formatQty(qty)}</strong></td>
          <td data-label="Unidade">${item.unit}</td>
          <td data-label="Macros">${macrosLabel}</td>
          <td data-label="Preco">${priceLabel}</td>
          <td data-label="Status"><span class="status-pill ${status.className}">${status.label}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderStockEditor() {
  const select = document.getElementById("stockEditorSelect");
  if (!select) return;
  if (select.value === "__new") {
    document.getElementById("stockEditorName").value = "";
    document.getElementById("stockEditorUnit").value = "";
    document.getElementById("stockEditorPrice").value = "";
    document.getElementById("stockEditorPriceQty").value = "";
    document.getElementById("stockEditorPriceBasis").value = "kg";
    document.getElementById("deleteStockItem").disabled = true;
    return;
  }
  const selected = state.stockItems[select.value] || allStockItems()[0];
  if (!selected) return;
  const price = ingredientPrice(selected.id);
  document.getElementById("stockEditorName").value = selected.name;
  document.getElementById("stockEditorUnit").value = selected.unit;
  document.getElementById("stockEditorPrice").value = price.unitPrice || "";
  document.getElementById("stockEditorPriceQty").value = price.packageQty || "";
  document.getElementById("stockEditorPriceBasis").value = price.basis || defaultPriceBasis(selected.unit);
  document.getElementById("deleteStockItem").disabled = false;
}

function stockStatus(qty, weeklyNeed) {
  if (weeklyNeed > 0 && qty < weeklyNeed) return { label: "Abaixo da semana", className: "status-low" };
  return { label: "Ok", className: "status-ok" };
}

function renderLog() {
  const tbody = document.getElementById("logTable");
  const rows = filteredLogRows();
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum movimento registrado ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .slice()
    .reverse()
    .map((entry) => `
      <tr class="${entry.alert ? "alert-row" : ""}">
        <td>${entry.date}</td>
        <td>${displayLogType(entry.type)}${entry.alert ? " ⚠" : ""}</td>
        <td>${entry.detail}${entry.alert ? `<br><small>${entry.alert}</small>` : ""}</td>
        <td>${(entry.items || []).map((row) => `${row.name || labelForStockItem(row.stockItemId)}: ${formatQty(row.qty)} ${row.unit || unitForStockItem(row.stockItemId)}`).join("<br>")}</td>
      </tr>
    `)
    .join("");
}

function filteredLogRows() {
  const typeFilter = document.getElementById("logTypeFilter")?.value || "";
  const startDate = document.getElementById("logStartDateFilter")?.value || "";
  const endDate = document.getElementById("logEndDateFilter")?.value || "";

  return state.log.filter((entry) => {
    const type = normalizeLogType(entry.type);
    const entryDate = logEntryDateKey(entry);
    const afterStart = !startDate || (entryDate && entryDate >= startDate);
    const beforeEnd = !endDate || (entryDate && entryDate <= endDate);
    return (!typeFilter || type === typeFilter) && afterStart && beforeEnd;
  });
}

function normalizeLogType(type) {
  if (type === "inbound") return "entrada";
  if (type === "outbound") return "saida";
  return type;
}

function logEntryDateKey(entry) {
  if (entry.isoDate) return String(entry.isoDate).slice(0, 10);

  const match = String(entry.date || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function displayLogType(type) {
  const labels = {
    inbound: "Entrada",
    entrada: "Entrada",
    outbound: "Saída",
    saida: "Saída",
    ajuste: "Ajuste",
    consumo: "Consumo",
  };
  return labels[normalizeLogType(type)] || labels[type] || type;
}

function renderWater() {
  const water = formatQty(currentDayLog().water);
  document.getElementById("waterValue").textContent = `${water} L`;
  const headerWater = document.getElementById("headerWaterValue");
  if (headerWater) headerWater.textContent = `Água: ${water} L / 3.8 L`;
  document.getElementById("waterProgress").value = Math.min(currentDayLog().water, 3.8);
}

function completeMeal(mealId) {
  const meal = getMeals().find((current) => current.id === mealId);
  const selected = state.selections[mealId] || getOptionKeys(meal)[0];
  const completedAt = new Date().toISOString();
  const ingredients = (meal.options[selected] || []).map((ingredient) => ({
    ...ingredient,
    name: labelForStockItem(ingredient.stockItemId),
    unit: unitForStockItem(ingredient.stockItemId),
  }));
  const shortages = ingredients
    .map((ingredient) => ({
      ...ingredient,
      available: getStockQty(ingredient.stockItemId),
    }))
    .filter((ingredient) => ingredient.available < ingredient.qty);

  if (state.stockManagementEnabled) {
    for (const ingredient of ingredients) {
      state.stock[ingredient.stockItemId] = Math.max(0, getStockQty(ingredient.stockItemId) - ingredient.qty);
    }
  }

  const dayLog = currentDayLog();
  dayLog.completedMeals[mealId] = {
    option: selected,
    completedAt,
    items: ingredients,
    stockChanged: Boolean(state.stockManagementEnabled),
  };
  const timingMessage = timingAlert(mealId, completedAt);
  const stockMessage = state.stockManagementEnabled && shortages.length
    ? `Estoque insuficiente para baixar tudo: ${shortages
        .map((ingredient) => `${ingredient.name} faltou ${formatQty(ingredient.qty - ingredient.available)} ${ingredient.unit}`)
        .join("; ")}. Itens disponíveis foram baixados até zero.`
    : null;
  const alert = [timingMessage, stockMessage].filter(Boolean).join(" | ") || null;

  state.log.push({
    date: timestamp(),
    isoDate: new Date().toISOString(),
    type: state.stockManagementEnabled ? "saida" : "consumo",
    detail: `${meal.title} - Opção ${selected}${state.stockManagementEnabled ? "" : " (sem baixa de estoque)"}`,
    items: ingredients,
    alert,
    stockChanged: Boolean(state.stockManagementEnabled),
  });
  toast(alert ? "Consumo registrado com alerta." : state.stockManagementEnabled ? "Consumo registrado e estoque atualizado." : "Consumo registrado sem alterar estoque.");
  render();
}

function undoMeal(mealId) {
  const dayLog = currentDayLog();
  const record = dayLog.completedMeals[mealId];
  if (!record) return;

  if (record.stockChanged !== false) {
    for (const ingredient of record.items || []) {
      state.stock[ingredient.stockItemId] = getStockQty(ingredient.stockItemId) + ingredient.qty;
    }
  }
  delete dayLog.completedMeals[mealId];
  state.log.push({
    date: timestamp(),
    isoDate: new Date().toISOString(),
    type: "ajuste",
    detail: `Desfeito consumo de ${mealId}`,
    items: record.items || [],
  });
  toast(record.stockChanged === false ? "Consumo desfeito." : "Consumo desfeito e estoque devolvido.");
  render();
}

function timingAlert(mealId, completedAt) {
  if (mealId === "meal1") return firstMealDeviationAlert(completedAt);

  const previousMeal = previousCompletedMeal(mealId);
  if (!previousMeal) return null;

  const gapHours = (new Date(completedAt) - new Date(previousMeal.completedAt)) / 36e5;
  const minHoursBetweenMeals = Number(state.dietTiming.minHoursBetweenMeals || 3);
  const maxHoursBetweenMeals = minHoursBetweenMeals + 1;

  if (gapHours < minHoursBetweenMeals) {
    return `Intervalo curto: ${formatQty(gapHours)}h desde a refeição anterior.`;
  }
  if (gapHours > maxHoursBetweenMeals) {
    return `Intervalo longo: ${formatQty(gapHours)}h desde a refeição anterior.`;
  }
  return null;
}

function previousCompletedMeal(mealId) {
  const meals = getMeals();
  const index = meals.findIndex((meal) => meal.id === mealId);
  const completed = currentDayLog().completedMeals;
  for (let i = index - 1; i >= 0; i -= 1) {
    const record = completed[meals[i].id];
    if (record?.completedAt) return record;
  }
  return null;
}

function firstMealDeviationAlert(completedAt) {
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

function registerStock(items, type, detail) {
  const normalizedType = type === "inbound" ? "entrada" : type === "outbound" ? "saida" : type;
  const factor = normalizedType === "entrada" ? 1 : -1;
  if (normalizedType === "saida") {
    const shortages = items.filter((item) => getStockQty(item.stockItemId) < item.qty);
    if (shortages.length) {
      alert(
        `Estoque insuficiente para registrar saída:\n\n${shortages
          .map((item) => `${labelForStockItem(item.stockItemId)}: disponível ${formatQty(getStockQty(item.stockItemId))} ${unitForStockItem(item.stockItemId)}`)
          .join("\n")}`,
      );
      return false;
    }
  }
  for (const item of items) {
    const current = getStockQty(item.stockItemId);
    state.stock[item.stockItemId] = normalizedType === "entrada"
      ? current + item.qty
      : Math.max(0, current - item.qty);
  }
  state.log.push({ date: timestamp(), isoDate: new Date().toISOString(), type: normalizedType, detail, items });
  render();
  return true;
}

function openPurchaseModal() {
  const validationMessage = cartValidationMessage();
  const rows = getWeeklyPurchaseRows();

  if (!rows.length) {
    toast("Estoque já cobre o carrinho de compras.");
    return;
  }

  pendingPurchaseRows = rows;
  document.getElementById("purchaseWarnings").innerHTML = validationMessage
    ? `<div class="warning-box">${validationMessage.replace(/\n/g, "<br>")}</div>`
    : "";

  document.getElementById("purchaseRows").innerHTML = rows
    .map(
      (row) => `
        <tr data-purchase-row="${row.stockItemId}">
          <td>${row.name}</td>
          <td><strong>${formatQty(row.qty)}</strong></td>
          <td><input type="number" min="0" step="0.1" value="${formatQty(row.qty)}" data-purchase-qty="${row.stockItemId}" /></td>
          <td>${row.unit}</td>
        </tr>
      `,
    )
    .join("");

  document.getElementById("purchaseModal").showModal();
}

function closePurchaseModal() {
  pendingPurchaseRows = [];
  document.getElementById("purchaseModal").close();
}

function confirmPurchase() {
  const items = pendingPurchaseRows
    .map((row) => ({
      ...row,
      qty: Number(document.querySelector(`[data-purchase-qty="${row.stockItemId}"]`)?.value || 0),
    }))
    .filter((row) => row.qty > 0);

  if (!items.length) {
    toast("Informe ao menos uma quantidade comprada.");
    return;
  }

  registerStock(items, "entrada", "Compra confirmada");
  closePurchaseModal();
  toast("Compra registrada no estoque.");
}

function editMeal(mealId) {
  openMealEditor(mealId);
}

function addMeal() {
  const id = `meal_custom_${Date.now()}`;
  state.meals.push({
    id,
    title: `Refeição ${getMeals().length + 1}`,
    subtitle: "Nova refeição",
    macros: "Macros a definir",
    options: { A: [] },
  });
  state.selections[id] = "A";
  state.shoppingCart[id] = { A: 0 };
  render();
  openMealEditor(id);
}

function openMealEditor(mealId) {
  const meal = getMeals().find((current) => current.id === mealId);
  if (!meal) return;

  editingMealId = mealId;
  editingOptionKey = getOptionKeys(meal).includes(state.selections[mealId]) ? state.selections[mealId] : getOptionKeys(meal)[0];
  document.getElementById("mealModalTitle").textContent = `Editar ${meal.title}`;
  document.getElementById("mealEditorTitle").value = meal.title;
  document.getElementById("mealEditorSubtitle").value = meal.subtitle;
  document.getElementById("mealEditorMacros").value = meal.macros;
  renderMealOptionsEditor(meal);
  document.getElementById("mealModal").showModal();
}

function closeMealEditor() {
  editingMealId = null;
  editingOptionKey = "A";
  document.getElementById("mealModal").close();
}

function renderMealOptionsEditor(meal) {
  const container = document.getElementById("mealOptionsEditor");
  const picker = document.getElementById("mealOptionPicker");
  const optionKeys = getOptionKeys(meal);
  if (!optionKeys.includes(editingOptionKey)) editingOptionKey = optionKeys[0];

  picker.innerHTML = optionKeys.map((option) => `<option value="${option}">Opção ${option}</option>`).join("");
  picker.value = editingOptionKey;

  const stockOptions = allStockItems()
    .map((item) => `<option value="${item.id}">${item.name} (${item.unit})</option>`)
    .join("");

  const option = editingOptionKey;
  container.innerHTML = `
    <section class="option-editor-block" data-editor-option="${option}">
      <header>
        <h5>Opção ${option}</h5>
        <div>
          <button class="secondary-button" type="button" data-add-ingredient="${option}">Adicionar ingrediente</button>
          <button class="secondary-button" type="button" data-delete-option="${option}" ${optionKeys.length === 1 ? "disabled" : ""}>Excluir opção</button>
        </div>
      </header>
      <div class="ingredient-editor-list">
        ${(meal.options[option] || [])
          .map(
            (item, index) => `
              <div class="ingredient-editor-row" data-ingredient-row data-option="${option}" data-index="${index}">
                <label>
                  Ingrediente
                  <input data-field="label" type="text" value="${escapeAttr(item.label)}" />
                </label>
                <label>
                  Quantidade
                  <input data-field="qty" type="number" min="0" step="0.1" value="${item.qty}" />
                </label>
                <label>
                  Unidade
                  <input data-field="unit" type="text" value="${escapeAttr(item.unit)}" />
                </label>
                <label>
                  Ingrediente de estoque
                  <select data-field="stockItemId">
                    ${stockOptions}
                  </select>
                </label>
                <button class="secondary-button" type="button" data-delete-ingredient="${option}:${index}">Excluir</button>
              </div>
            `,
          )
          .join("") || '<p class="empty-state">Nenhum ingrediente nesta opção.</p>'}
      </div>
    </section>
  `;

  container.querySelectorAll("[data-field='stockItemId']").forEach((select) => {
    const row = select.closest("[data-ingredient-row]");
    const option = row.dataset.option;
    const index = Number(row.dataset.index);
    select.value = meal.options[option][index].stockItemId;
  });

  container.querySelectorAll("[data-add-ingredient]").forEach((button) => {
    button.addEventListener("click", () => {
      const stockItem = allStockItems()[0];
      meal.options[button.dataset.addIngredient].push({
        label: stockItem?.name || "Novo ingrediente",
        qty: 0,
        unit: stockItem?.unit || "g",
        stockItemId: stockItem?.id || "",
      });
      renderMealOptionsEditor(meal);
    });
  });

  container.querySelectorAll("[data-delete-ingredient]").forEach((button) => {
    button.addEventListener("click", () => {
      const [option, index] = button.dataset.deleteIngredient.split(":");
      meal.options[option].splice(Number(index), 1);
      renderMealOptionsEditor(meal);
    });
  });

  container.querySelectorAll("[data-delete-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const option = button.dataset.deleteOption;
      delete meal.options[option];
      delete state.shoppingCart[meal.id]?.[option];
      if (state.selections[meal.id] === option) state.selections[meal.id] = getOptionKeys(meal)[0];
      editingOptionKey = getOptionKeys(meal)[0];
      renderMealOptionsEditor(meal);
    });
  });
}

function saveMealEditor() {
  const meal = getMeals().find((current) => current.id === editingMealId);
  if (!meal) return;

  meal.title = document.getElementById("mealEditorTitle").value.trim() || meal.title;
  meal.subtitle = document.getElementById("mealEditorSubtitle").value.trim();
  meal.macros = document.getElementById("mealEditorMacros").value.trim();

  persistVisibleOptionEdits(meal);

  const optionKeys = getOptionKeys(meal);
  state.selections[meal.id] = optionKeys.includes(state.selections[meal.id]) ? state.selections[meal.id] : optionKeys[0];
  state.shoppingCart[meal.id] = Object.fromEntries(optionKeys.map((option) => [option, Number(state.shoppingCart[meal.id]?.[option] || 0)]));

  toast("Refeição atualizada.");
  closeMealEditor();
  render();
}

function persistVisibleOptionEdits(meal) {
  const optionBlock = document.querySelector("[data-editor-option]");
  if (!optionBlock) return;
  const option = optionBlock.dataset.editorOption;
  meal.options[option] = [...optionBlock.querySelectorAll("[data-ingredient-row]")]
    .map((row) => ({
      label: row.querySelector("[data-field='label']").value.trim(),
      qty: Number(row.querySelector("[data-field='qty']").value || 0),
      unit: row.querySelector("[data-field='unit']").value.trim(),
      stockItemId: row.querySelector("[data-field='stockItemId']").value,
    }))
    .filter((item) => item.label && item.stockItemId);
}

function addMealOptionToEditor() {
  const meal = getMeals().find((current) => current.id === editingMealId);
  if (!meal) return;
  const option = nextOptionKey(meal);
  meal.options[option] = [];
  state.shoppingCart[meal.id] = normalizedCart(meal.id);
  state.shoppingCart[meal.id][option] = 0;
  editingOptionKey = option;
  renderMealOptionsEditor(meal);
}

function addInlineStockItem() {
  const nameInput = document.getElementById("inlineStockName");
  const unitInput = document.getElementById("inlineStockUnit");
  const name = nameInput.value.trim();
  const unit = unitInput.value.trim();
  if (!name || !unit) {
    toast("Informe nome e unidade do ingrediente.");
    return;
  }

  const id = createStockItemId(name);
  state.stockItems[id] = { id, name, unit };
  nameInput.value = "";
  unitInput.value = "";

  const meal = getMeals().find((current) => current.id === editingMealId);
  if (meal) {
    meal.options[editingOptionKey] = meal.options[editingOptionKey] || [];
    meal.options[editingOptionKey].push({ label: name, qty: 0, unit, stockItemId: id });
    renderMealOptionsEditor(meal);
  }

  toast("Ingrediente adicionado ao estoque.");
}

function deleteMeal(mealId) {
  const meal = getMeals().find((current) => current.id === mealId);
  if (!meal) return;
  if (!confirm(`Excluir ${meal.title}?`)) return;

  state.meals = getMeals().filter((current) => current.id !== mealId);
  delete state.selections[mealId];
  delete state.shoppingCart[mealId];
  for (const log of Object.values(state.dailyLogs)) {
    if (log.completedMeals) delete log.completedMeals[mealId];
  }
  toast("Refeição excluída.");
  render();
}

function deleteStockItem(stockItemId) {
  const usedInMeal = getMeals().some((meal) =>
    getOptionKeys(meal).some((option) => (meal.options[option] || []).some((item) => item.stockItemId === stockItemId)),
  );
  if (usedInMeal) {
    toast("Este ingrediente ainda está ligado a uma refeição.");
    return;
  }
  if (!confirm(`Excluir ${labelForStockItem(stockItemId)}?`)) return;

  delete state.stockItems[stockItemId];
  delete state.stock[stockItemId];
  delete state.shoppingPrices[stockItemId];
  toast("Ingrediente excluído.");
  render();
}

function createStockItemId(name) {
  return `stk_custom_${normalizeText(name).replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
}

function labelForStockItem(stockItemId) {
  return state.stockItems[stockItemId]?.name || stockItemId;
}

function unitForStockItem(stockItemId) {
  return state.stockItems[stockItemId]?.unit || "";
}

function toast(message) {
  const box = document.getElementById("toast");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2400);
}

function setSyncStatus(message) {
  document.getElementById("syncStatus").textContent = message;
}

function updateAccountUi(user) {
  const name = document.getElementById("accountName");
  const email = document.getElementById("accountEmail");
  const signInButton = document.getElementById("signInGoogle");
  const signOutButton = document.getElementById("signOutGoogle");

  if (!user) {
    name.textContent = "Sem login";
    email.textContent = "Firestore desligado";
    signInButton.hidden = false;
    signOutButton.hidden = true;
    setSyncStatus("Local: salvo neste navegador.");
    return;
  }

  name.textContent = user.displayName || "Conta Google";
  email.textContent = user.email || "Conta conectada";
  signInButton.hidden = true;
  signOutButton.hidden = false;
  setSyncStatus("Conectado. Carregando Firestore...");
}

function renderSettings() {
  const provider = document.getElementById("aiProvider");
  if (!provider) return;
  const settings = loadAiSettings();
  provider.value = settings.provider;
  document.getElementById("aiBaseUrl").value = settings.baseUrl;
  document.getElementById("aiModel").value = settings.model;
  document.getElementById("aiApiKey").value = settings.apiKey;
  document.getElementById("aiSettingsStatus").textContent = settings.apiKey
    ? "IA configurada localmente para este navegador."
    : "IA ainda nao configurada.";
  const types = state.appSettings.notificationTypes || {};
  const mealReminders = document.getElementById("pushMealReminders");
  const stockAlerts = document.getElementById("pushStockAlerts");
  const cartAlerts = document.getElementById("pushCartAlerts");
  if (mealReminders) mealReminders.checked = types.mealReminders !== false;
  if (stockAlerts) stockAlerts.checked = Boolean(types.stockAlerts);
  if (cartAlerts) cartAlerts.checked = Boolean(types.cartAlerts);
}

function renderActiveDietControl() {
  const select = document.getElementById("activeDietSelect");
  if (!select) return;
  const current = select.value || state.activeDietVersionId;
  select.innerHTML = (state.dietVersions || [])
    .map((version) => `<option value="${version.id}">${version.status === "active" ? "Ativa" : "Arquivada"} · ${escapeHtml(version.name)}</option>`)
    .join("");
  select.value = [...select.options].some((option) => option.value === current) ? current : state.activeDietVersionId;
}

function renderDietVersions() {
  const container = document.getElementById("dietVersionsList");
  if (!container) return;
  const versions = state.dietVersions || [];
  container.innerHTML = versions
    .map((version) => `
      <div class="alert-item ${version.id === state.activeDietVersionId ? "active" : ""}">
        <strong>${escapeHtml(version.name)}</strong>
        <span>${version.status === "active" ? "Ativa" : "Arquivada"} · inicio ${escapeHtml(version.activatedAt || "-")}${version.archivedAt ? ` · fim ${escapeHtml(version.archivedAt)}` : ""}</span>
        ${version.id !== state.activeDietVersionId ? `<button class="secondary-button" data-activate-diet="${version.id}" type="button">Reativar dieta</button>` : ""}
      </div>
    `)
    .join("") || '<p class="modal-note">Nenhuma dieta versionada ainda.</p>';
  container.querySelectorAll("[data-activate-diet]").forEach((button) => {
    button.addEventListener("click", () => activateDietVersion(button.dataset.activateDiet));
  });
}

function globalAlertRows() {
  const alerts = [];
  const cartMessage = cartValidationMessage();
  if (cartMessage && !cartMessage.startsWith("Carrinho vazio")) {
    alerts.push({ title: "Carrinho desequilibrado", detail: cartMessage.replace(/\n/g, " ") });
  }
  for (const row of aggregate(getMealItemsForPlan())) {
    const stock = getStockQty(row.stockItemId);
    if (row.qty > 0 && stock < row.qty) {
      alerts.push({
        title: `${row.name}: abaixo do carrinho`,
        detail: `Estoque ${formatQty(stock)} ${row.unit}; necessario ${formatQty(row.qty)} ${row.unit}.`,
      });
    }
  }
  return alerts.slice(0, 8);
}

function renderGlobalAlerts() {
  const container = document.getElementById("globalAlerts");
  const alerts = globalAlertRows();
  const badge = document.getElementById("alertsBadge");
  const popover = document.getElementById("alertsPopover");
  if (badge) badge.textContent = String(alerts.length);
  const html = alerts.length
    ? alerts.map((alert) => `
      <div class="alert-item">
        <strong>${escapeHtml(alert.title)}</strong>
        <span>${escapeHtml(alert.detail)}</span>
      </div>
    `).join("")
    : '<p class="modal-note">Sem alertas globais no momento.</p>';
  if (container) container.innerHTML = html;
  if (popover) popover.innerHTML = `<h4>Alertas</h4>${html}`;
}

function toggleAlertsPopover() {
  const popover = document.getElementById("alertsPopover");
  const toggle = document.getElementById("alertsToggle");
  if (!popover || !toggle) return;
  const nextHidden = !popover.hidden ? true : false;
  popover.hidden = nextHidden;
  toggle.setAttribute("aria-expanded", String(!nextHidden));
}
}

async function loadNutritionBase() {
  if (nutritionBase) return nutritionBase;
  const response = await fetch("data/nutrition/dutch-coach-nutrition.normalized.json");
  if (!response.ok) throw new Error("Nao foi possivel carregar a base nutricional.");
  nutritionBase = await response.json();
  return nutritionBase;
}

async function renderNutritionSearch() {
  const status = document.getElementById("nutritionBaseStatus");
  const results = document.getElementById("nutritionResults");
  if (!status || !results) return;

  try {
    const base = await loadNutritionBase();
    const query = normalizeText(document.getElementById("nutritionSearch")?.value || "");
    const items = (base.items || [])
      .filter((item) => !query || normalizeText(`${item.names?.nl || ""} ${item.names?.pt || ""} ${item.names?.en || ""}`).includes(query))
      .slice(0, 20);
    status.textContent = `${base.itemCount || base.items?.length || 0} alimentos carregados. Traducoes em portugues pendentes.`;
    results.innerHTML = `
      <table>
        <thead><tr><th>Nome</th><th>Base</th><th>Kcal</th><th>Proteina</th><th>Carbo</th><th>Gordura</th><th></th></tr></thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td data-label="Nome">${escapeHtml(displayNutritionName(item))}</td>
              <td data-label="Base">${formatQty(item.referenceAmount?.quantity)} ${escapeHtml(item.referenceAmount?.unit || "")}</td>
              <td data-label="Kcal">${formatQty(item.nutrition?.kcal)}</td>
              <td data-label="Proteina">${formatQty(item.nutrition?.protein)}</td>
              <td data-label="Carbo">${formatQty(item.nutrition?.carbs)}</td>
              <td data-label="Gordura">${formatQty(item.nutrition?.fat)}</td>
              <td data-label="Acao"><button class="secondary-button mini-button" data-add-nutrition-stock="${escapeAttr(item.id)}" type="button">Adicionar</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
    results.querySelectorAll("[data-add-nutrition-stock]").forEach((button) => {
      button.addEventListener("click", () => addNutritionItemToStock(button.dataset.addNutritionStock));
    });
  } catch (error) {
    status.textContent = error.message;
  }
}

function displayNutritionName(item) {
  return item.names?.pt || item.names?.en || item.names?.nl || item.id;
}

function addNutritionItemToStock(nutritionId) {
  const item = nutritionBase?.items?.find((current) => current.id === nutritionId);
  if (!item) return;
  const name = displayNutritionName(item);
  const existing = Object.values(state.stockItems).find((stockItem) => normalizeText(stockItem.name) === normalizeText(name));
  if (existing) {
    existing.nutrition = { ...(existing.nutrition || {}), ...(item.nutrition || {}) };
    existing.nutritionSource = item.source;
    toast("Ingrediente atualizado com dados nutricionais.");
    render();
    return;
  }
  const id = createStockItemId(name);
  state.stockItems[id] = {
    id,
    name,
    unit: item.referenceAmount?.unit || "g",
    nutrition: item.nutrition || { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    nutritionSource: item.source,
    aliases: item.aliases || [],
  };
  toast("Ingrediente adicionado ao estoque.");
  render();
}

function openDietImportModal() {
  document.getElementById("dietImportStatus").textContent = "";
  document.getElementById("dietImportModal").showModal();
}

function closeDietImportModal() {
  document.getElementById("dietImportModal").close();
}

async function importDietWithAi() {
  const status = document.getElementById("dietImportStatus");
  status.textContent = "Enviando dieta para IA...";
  const imported = await importDietFromText({
    text: document.getElementById("dietImportText").value,
    settings: loadAiSettings(),
  });
  activateImportedDiet(imported);
  closeDietImportModal();
  toast("Dieta importada e ativada.");
}

function activateImportedDiet(imported) {
  const today = todayKey();
  const previousActive = state.dietVersions.find((version) => version.id === state.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = today;
    previousActive.meals = clone(state.meals);
  }

  const meals = imported.meals.map((meal, index) => ({
    id: `meal_${Date.now()}_${index}`,
    title: meal.title,
    subtitle: meal.subtitle,
    macros: meal.macros,
    options: Object.fromEntries(Object.entries(meal.options).map(([option, items]) => [
      option,
      items.map((item) => {
        const stockItemId = ensureStockItemForIngredient(item.label, item.unit);
        return { ...item, stockItemId };
      }),
    ])),
  }));

  const id = `diet_${Date.now()}`;
  state.dietVersions.push({
    id,
    name: imported.dietName,
    status: "active",
    activatedAt: today,
    archivedAt: "",
    source: "ai_import",
    notes: imported.notes,
    meals: clone(meals),
  });
  state.activeDietVersionId = id;
  state.meals = meals;
  state.selections = Object.fromEntries(meals.map((meal) => [meal.id, getOptionKeys(meal)[0]]));
  state.shoppingCart = Object.fromEntries(meals.map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
  state.collapsedMeals = {};
  render();
}

function createManualDietVersion() {
  const name = prompt("Nome da nova dieta:", `Dieta ${new Date().toLocaleDateString("pt-BR")}`);
  if (!name) return;
  const today = todayKey();
  const previousActive = state.dietVersions.find((version) => version.id === state.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = today;
    previousActive.meals = clone(state.meals);
  }
  const meals = clone(state.meals);
  const id = `diet_${Date.now()}`;
  state.dietVersions.push({
    id,
    name: name.trim(),
    status: "active",
    activatedAt: today,
    archivedAt: "",
    source: "manual",
    notes: "Criada manualmente a partir da dieta atual.",
    meals,
  });
  state.activeDietVersionId = id;
  render();
  toast("Nova dieta criada.");
}

function activateDietVersion(id) {
  const target = state.dietVersions.find((version) => version.id === id);
  if (!target) return;
  const today = todayKey();
  const previousActive = state.dietVersions.find((version) => version.id === state.activeDietVersionId);
  if (previousActive) {
    previousActive.status = "archived";
    previousActive.archivedAt = today;
    previousActive.meals = clone(state.meals);
  }
  target.status = "active";
  target.archivedAt = "";
  state.activeDietVersionId = target.id;
  state.meals = clone(target.meals);
  state.selections = Object.fromEntries(state.meals.map((meal) => [meal.id, getOptionKeys(meal)[0]]));
  state.shoppingCart = Object.fromEntries(state.meals.map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
  state.collapsedMeals = {};
  render();
  toast(`${target.name} ativada.`);
}

function ensureStockItemForIngredient(name, unit) {
  const normalized = normalizeText(name);
  const existing = Object.values(state.stockItems).find((item) => normalizeText(item.name) === normalized);
  if (existing) return existing.id;
  const id = createStockItemId(name);
  state.stockItems[id] = { id, name, unit: unit || "g", nutrition: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
  return id;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    toast("Este navegador nao suporta notificacoes.");
    return;
  }
  const result = await Notification.requestPermission();
  state.appSettings.notificationsEnabled = result === "granted";
  render();
  toast(result === "granted" ? "Notificacoes ativadas." : "Notificacoes nao autorizadas.");
}

function sendTestNotification() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    toast("Ative as notificacoes primeiro.");
    return;
  }
  new Notification("Plano Alimentar", {
    body: "Notificacao de teste ativada.",
    icon: "icons/icon-192.png",
  });
}

function openQuickMealModal() {
  renderStockOptions();
  document.getElementById("quickMealAffectStock").checked = state.stockManagementEnabled;
  document.getElementById("quickMealModal").showModal();
}

function closeQuickMealModal() {
  document.getElementById("quickMealModal").close();
}

function registerQuickMeal() {
  const stockItemId = document.getElementById("quickMealStockItem").value;
  const qty = Number(document.getElementById("quickMealQty").value || 0);
  const note = document.getElementById("quickMealNote").value.trim();
  const affectStock = document.getElementById("quickMealAffectStock").checked;
  if (!stockItemId || !qty) return;
  const item = {
    stockItemId,
    name: labelForStockItem(stockItemId),
    qty,
    unit: unitForStockItem(stockItemId),
  };
  currentDayLog().completedMeals[`quick_${Date.now()}`] = {
    at: timestamp(),
    option: "Avulsa",
    title: "Refeicao avulsa",
    items: [item],
  };
  if (affectStock) {
    registerStock([item], "consumo", note || "Refeicao avulsa");
  } else {
    state.log.unshift({
      at: timestamp(),
      type: "consumo",
      detail: note || "Refeicao avulsa sem baixa de estoque",
      items: [item],
    });
    render();
  }
  closeQuickMealModal();
  toast("Refeicao avulsa registrada.");
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
    document.getElementById("pageTitle").textContent = button.dataset.title;
  });
});

document.getElementById("waterPlus").addEventListener("click", () => {
  const log = currentDayLog();
  log.water = Math.min(9.9, Number(log.water || 0) + 0.25);
  render();
});

document.getElementById("waterMinus").addEventListener("click", () => {
  const log = currentDayLog();
  log.water = Math.max(0, Number(log.water || 0) - 0.25);
  render();
});

document.getElementById("resetDay").addEventListener("click", () => {
  const day = todayKey();
  state.dailyLogs[day] = { water: 0, completedMeals: {} };
  toast("Dia reiniciado. O estoque não foi alterado.");
  render();
});

document.getElementById("addMeal").addEventListener("click", addMeal);
document.getElementById("quickMeal").addEventListener("click", openQuickMealModal);
document.getElementById("importDietAi").addEventListener("click", openDietImportModal);
document.getElementById("newDietManual").addEventListener("click", createManualDietVersion);
document.getElementById("activeDietSelect").addEventListener("change", (event) => {
  if (event.target.value && event.target.value !== state.activeDietVersionId) {
    activateDietVersion(event.target.value);
  }
});
document.getElementById("alertsToggle")?.addEventListener("click", toggleAlertsPopover);

document.getElementById("stockManagementToggle").addEventListener("change", (event) => {
  state.stockManagementEnabled = event.target.checked;
  toast(state.stockManagementEnabled ? "Baixa de estoque ativada." : "Baixa de estoque desativada.");
  render();
});

document.getElementById("clearCart").addEventListener("click", () => {
  state.shoppingCart = Object.fromEntries(getMeals().map((meal) => [meal.id, Object.fromEntries(getOptionKeys(meal).map((option) => [option, 0]))]));
  toast("Carrinho limpo.");
  render();
});

document.getElementById("clearCart").addEventListener("click", (event) => {
  event.stopPropagation();
});

document.querySelector(".weekly-plan-card .cart-header")?.addEventListener("click", (event) => {
  if (isInteractiveToggleChild(event.target, event.currentTarget)) return;
  toggleCartPanel();
});

document.querySelector(".weekly-plan-card .cart-header")?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  toggleCartPanel();
});

document.getElementById("themeToggle")?.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  render();
});

document.getElementById("stockWeekly").addEventListener("click", () => {
  openPurchaseModal();
});

document.getElementById("copyShopping").addEventListener("click", async () => {
  const rows = getWeeklyPurchaseRows()
    .map((row) => `${row.name}\t${formatQty(row.qty)}\t${row.unit}`)
    .join("\n");
  await navigator.clipboard.writeText(`Ingrediente\tComprar\tUnidade\n${rows}`);
  toast("Lista semanal copiada.");
});

document.getElementById("stockForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const stockItemId = document.getElementById("stockItem").value;
  const qty = Number(document.getElementById("stockQty").value);
  const type = document.getElementById("stockType").value;
  if (!qty) return;
  const registered = registerStock([{ stockItemId, name: labelForStockItem(stockItemId), qty, unit: unitForStockItem(stockItemId) }], type, "Registro manual");
  if (!registered) return;
  event.target.reset();
  toast("Movimento manual registrado.");
});

document.getElementById("clearLog").addEventListener("click", () => {
  if (!confirm("Limpar todo o histórico de movimentos?")) return;
  state.log = [];
  render();
});

document.getElementById("exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `plano-alimentar-joao-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("importData").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state = migrateState(JSON.parse(await file.text()));
    toast("Dados importados.");
    render();
  } catch {
    toast("Arquivo inválido.");
  } finally {
    event.target.value = "";
  }
});

document.getElementById("signInGoogle").addEventListener("click", async () => {
  try {
    await signIn();
  } catch (error) {
    console.error(error);
    toast("Não foi possível entrar com Google.");
  }
});

document.getElementById("signOutGoogle").addEventListener("click", async () => {
  try {
    await signOut();
    toast("Conta desconectada. O app continua local.");
  } catch (error) {
    console.error(error);
    toast("Não foi possível sair.");
  }
});

document.getElementById("stockEditorSelect").addEventListener("change", renderStockEditor);

document.getElementById("saveStockItem").addEventListener("click", () => {
  const selectedId = document.getElementById("stockEditorSelect").value;
  const name = document.getElementById("stockEditorName").value.trim();
  const unit = document.getElementById("stockEditorUnit").value.trim();
  const unitPrice = Number(document.getElementById("stockEditorPrice").value || 0);
  const packageQty = Number(document.getElementById("stockEditorPriceQty").value || 1);
  const basis = document.getElementById("stockEditorPriceBasis").value;
  if (!name || !unit) {
    toast("Informe nome e unidade.");
    return;
  }

  const id = selectedId === "__new" ? createStockItemId(name) : selectedId;
  state.stockItems[id] = {
    ...(state.stockItems[id] || {}),
    id,
    name,
    unit,
    price: { unitPrice, packageQty: Math.max(1, packageQty), basis },
  };
  if (state.shoppingPrices) delete state.shoppingPrices[id];
  toast(selectedId === "__new" ? "Ingrediente adicionado." : "Ingrediente atualizado.");
  render();
});

document.getElementById("deleteStockItem").addEventListener("click", () => {
  const id = document.getElementById("stockEditorSelect").value;
  if (id !== "__new") deleteStockItem(id);
});

document.getElementById("logTypeFilter").addEventListener("change", renderLog);
document.getElementById("logStartDateFilter").addEventListener("change", renderLog);
document.getElementById("logEndDateFilter").addEventListener("change", renderLog);

document.getElementById("minMealGap").addEventListener("change", () => {
  state.dietTiming = {
    minHoursBetweenMeals: Number(document.getElementById("minMealGap").value || 3),
  };
  render();
});

document.getElementById("mealEditorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveMealEditor();
});

document.getElementById("closeMealModal").addEventListener("click", closeMealEditor);
document.getElementById("cancelMealEdit").addEventListener("click", closeMealEditor);
document.getElementById("addMealOption").addEventListener("click", addMealOptionToEditor);
document.getElementById("inlineAddStockItem").addEventListener("click", addInlineStockItem);
document.getElementById("mealOptionPicker").addEventListener("change", (event) => {
  const meal = getMeals().find((current) => current.id === editingMealId);
  if (!meal) return;
  persistVisibleOptionEdits(meal);
  editingOptionKey = event.target.value;
  renderMealOptionsEditor(meal);
});

document.getElementById("purchaseForm").addEventListener("submit", (event) => {
  event.preventDefault();
  confirmPurchase();
});
document.getElementById("closePurchaseModal").addEventListener("click", closePurchaseModal);
document.getElementById("cancelPurchase").addEventListener("click", closePurchaseModal);

document.getElementById("saveAiSettings")?.addEventListener("click", () => {
  saveAiSettings({
    provider: document.getElementById("aiProvider").value,
    baseUrl: document.getElementById("aiBaseUrl").value,
    model: document.getElementById("aiModel").value,
    apiKey: document.getElementById("aiApiKey").value,
  });
  renderSettings();
  toast("Configuracoes de IA salvas localmente.");
});

document.getElementById("clearAiSettings")?.addEventListener("click", () => {
  clearAiSettings();
  renderSettings();
  toast("Chave de IA removida deste navegador.");
});

document.getElementById("loadNutritionBase")?.addEventListener("click", renderNutritionSearch);
document.getElementById("nutritionSearch")?.addEventListener("input", renderNutritionSearch);
document.getElementById("enableNotifications")?.addEventListener("click", requestNotificationPermission);
document.getElementById("testNotification")?.addEventListener("click", sendTestNotification);
["pushMealReminders", "pushStockAlerts", "pushCartAlerts"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", () => {
    state.appSettings.notificationTypes = {
      mealReminders: document.getElementById("pushMealReminders")?.checked !== false,
      stockAlerts: Boolean(document.getElementById("pushStockAlerts")?.checked),
      cartAlerts: Boolean(document.getElementById("pushCartAlerts")?.checked),
    };
    render();
  });
});

document.getElementById("closeDietImportModal")?.addEventListener("click", closeDietImportModal);
document.getElementById("cancelDietImport")?.addEventListener("click", closeDietImportModal);
document.getElementById("dietImportFile")?.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  document.getElementById("dietImportText").value = await file.text();
});
document.getElementById("dietImportForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importDietWithAi();
  } catch (error) {
    document.getElementById("dietImportStatus").textContent = error.message;
  }
});
document.getElementById("closeQuickMealModal")?.addEventListener("click", closeQuickMealModal);
document.getElementById("cancelQuickMeal")?.addEventListener("click", closeQuickMealModal);
document.getElementById("quickMealForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  registerQuickMeal();
});

watchSession({
  onUser(user) {
    hasReceivedRemoteState = false;
    updateAccountUi(user);
  },
  async onState(remoteState) {
    hasReceivedRemoteState = true;

    if (!getCurrentUser()) return;

    if (remoteState) {
      if (localDirtySince && (!lastCloudSaveStartedAt || localDirtySince <= lastCloudSaveStartedAt)) {
        setSyncStatus("Sincronizando alteraÃ§Ãµes locais...");
        return;
      }
      const localUiState = {
        collapsedMeals: state.collapsedMeals || {},
        cartCollapsed: Boolean(state.cartCollapsed),
        theme: state.theme,
      };
      isApplyingRemoteState = true;
      state = migrateState(remoteState);
      state.collapsedMeals = localUiState.collapsedMeals;
      state.cartCollapsed = localUiState.cartCollapsed;
      state.theme = localUiState.theme;
      render();
      isApplyingRemoteState = false;
      setSyncStatus("Sincronizado com Firestore.");
      return;
    }

    await saveUserState(state);
    setSyncStatus("Primeiro backup criado no Firestore.");
  },
  onError(error) {
    console.error(error);
    hasReceivedRemoteState = false;
    setSyncStatus("Erro no Firestore. Confira regras e Auth.");
  },
});

window.addEventListener("load", refreshIcons);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js?v=dev-annotations1").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

render();
