# Nutrition Data

This folder stores nutrition sources before they are imported into Firestore.

## Current Source

- `raw/dutch-coach-nutrition.tsv`: original pasted Dutch table.
- `dutch-coach-nutrition.normalized.json`: structured version generated from the TSV.

The source columns are:

- `Product`
- `Hoeveelheid`
- `Eenheid`
- `Kcal`
- `Eiwit`
- `Koolhydraten`
- `Vet`

Mapped fields:

- `Product` -> `names.nl`
- `Hoeveelheid` -> `referenceAmount.quantity`
- `Eenheid` -> `referenceAmount.unit`
- `Kcal` -> `nutrition.kcal`
- `Eiwit` -> `nutrition.protein`
- `Koolhydraten` -> `nutrition.carbs`
- `Vet` -> `nutrition.fat`

Fiber is intentionally not included for now.

## Translation Strategy

Do not duplicate the whole nutrition database per language.

Each ingredient should keep one stable ID and language-specific names:

```json
{
  "id": "ingredient_id",
  "names": {
    "nl": "original Dutch name",
    "pt": "Portuguese name",
    "en": "English name"
  }
}
```

Portuguese and English names are pending controlled translation. The raw Dutch value is preserved so we can audit or correct translations later.
