import { ChevronDown, ChevronUp } from "lucide-react";
import {
  getOptionKeys,
  labelForStockItem,
  nutritionSummary,
  optionNutritionTotals,
} from "../../state/app-state.js";
import { formatQty, formatTime } from "../../utils.js";

export default function MealCard({ meal, state, completed, onEdit, onConsume, dispatch }) {
  const optionKeys = getOptionKeys(meal);
  const selected = optionKeys.includes(state.selections[meal.id]) ? state.selections[meal.id] : optionKeys[0];
  const totals = optionNutritionTotals(state, meal, selected);
  const collapsed = Boolean(state.collapsedMeals?.[meal.id]);
  const CollapseIcon = collapsed ? ChevronDown : ChevronUp;
  return (
    <article className={`meal-card${collapsed ? " collapsed" : ""}`}>
      <header
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={(event) => {
          if (event.target.closest("button, input, select, textarea, a, label")) return;
          dispatch({ type: "meal/toggle-collapse", mealId: meal.id });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          dispatch({ type: "meal/toggle-collapse", mealId: meal.id });
        }}
      >
        <div>
          <h3>{meal.title}</h3>
          <p>{meal.subtitle} | {nutritionSummary(totals)}</p>
        </div>
        {completed && <span className="completed-pill">Concluída {formatTime(completed.completedAt)}</span>}
        <span className="meal-collapse-indicator"><CollapseIcon size={18} /></span>
      </header>
      <div className="option-control">
        {optionKeys.map((option) => (
          <button key={option} type="button" className={selected === option ? "active" : ""} onClick={() => dispatch({ type: "meal/select", mealId: meal.id, option })}>Opção {option}</button>
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
          <button type="button" onClick={onConsume}>Consumir</button>
        )}
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "cart/add", mealId: meal.id })}>Carrinho</button>
        <button className="secondary-button" type="button" onClick={onEdit}>Editar</button>
        <button className="secondary-button" type="button" onClick={() => confirm(`Excluir ${meal.title}?`) && dispatch({ type: "meal/delete", mealId: meal.id })}>Excluir</button>
      </div>
    </article>
  );
}
