import { getMeals, getOptionKeys } from "../../state/app-state.js";

export default function CartSummary({ state, dispatch, t }) {
  const rows = getMeals(state).map((meal) => {
    const cart = state.shoppingCart[meal.id] || {};
    return { meal, options: getOptionKeys(meal).map((option) => ({ option, count: cart[option] || 0 })) };
  });
  if (!rows.length) return <p className="empty-state">{t("meals.noCartMeals")}</p>;
  return rows.map(({ meal, options }) => (
    <div className="cart-summary-row" key={meal.id}>
      <div><strong>{meal.title}</strong><span>{meal.subtitle}</span></div>
      <div className="cart-option-strip">
        {options.map(({ option, count }) => (
          <div key={option} className={`cart-option-chip cart-option-control ${count ? "active" : ""}`}>
            <span>{t("common.option")} {option}</span>
            <button
              className="secondary-button"
              type="button"
              onClick={() => dispatch({ type: "cart/set-option-count", mealId: meal.id, option, count: count - 1 })}
              disabled={count <= 0}
              aria-label={t("meals.decreaseOption", { option, meal: meal.title })}
            >
              -
            </button>
            <strong>{count}</strong>
            <button
              className="secondary-button"
              type="button"
              onClick={() => dispatch({ type: "cart/set-option-count", mealId: meal.id, option, count: count + 1 })}
              aria-label={t("meals.increaseOption", { option, meal: meal.title })}
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  ));
}
