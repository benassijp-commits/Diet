import { useMemo, useState } from "react";
import {
  allIngredientCatalogItems,
  ingredientNameForLanguage,
  ingredientSearchLabelForLanguage,
  ingredientSearchText,
  labelForIngredient,
} from "../../state/app-state.js";
import { normalizeText } from "../../utils.js";

export default function IngredientAutocomplete({ state, value, onChange, label = "Ingrediente", disabled = false, language = "pt", t }) {
  const selected = value ? state.stockItems[value] : null;
  const [query, setQuery] = useState(selected ? ingredientSearchLabelForLanguage(selected, language) : "");
  const [open, setOpen] = useState(false);
  const items = allIngredientCatalogItems(state);
  const results = useMemo(() => {
    const needle = normalizeText(query);
    const ranked = items
      .filter((item) => !needle || normalizeText(`${ingredientSearchText(item, language)} ${item.unit || ""}`).includes(needle))
      .slice(0, 18);
    return ranked.length ? ranked : items.slice(0, 18);
  }, [items, language, query]);

  const choose = (item) => {
    setQuery(ingredientSearchLabelForLanguage(item, language));
    setOpen(false);
    onChange?.(item.id, item);
  };

  return (
    <label className="ingredient-autocomplete">
      {label}
      <input
        value={open ? query : (selected ? ingredientSearchLabelForLanguage(selected, language) : query)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery(selected ? ingredientNameForLanguage(selected, language) || labelForIngredient(state, value) : query);
          setOpen(true);
        }}
        disabled={disabled}
        placeholder={t ? t("ingredients.search") : "Buscar ingrediente"}
        autoComplete="off"
      />
      {open && !disabled && (
        <div className="ingredient-results" role="listbox">
          {results.map((item) => (
            <button type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
              <strong>{ingredientNameForLanguage(item, language)}</strong>
              <span>{item.unit || "un"}</span>
            </button>
          ))}
          {!results.length && <span className="empty-state">{t ? t("ingredients.none") : "Nenhum ingrediente encontrado."}</span>}
        </div>
      )}
    </label>
  );
}
