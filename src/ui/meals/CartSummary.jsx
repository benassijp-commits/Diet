import { getMeals, getOptionKeys } from "../../state/app-state.js";

export default function CartSummary({ state }) {
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
