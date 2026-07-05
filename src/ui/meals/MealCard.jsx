import {
  getOptionKeys,
  labelForStockItem,
  nutritionSummary,
  optionNutritionTotals,
} from "../../state/app-state.js";
import { formatQty, formatTime } from "../../utils.js";

export default function MealCard({ meal, state, completed, onEdit, dispatch, notify }) {
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
