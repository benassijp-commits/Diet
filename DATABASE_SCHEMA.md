# Database Schema

O app usa Firestore como fonte sincronizada e `localStorage` como cache/fallback local.

Documento principal atual:

```txt
users/{uid}/state/current
```

Formato:

```js
{
  state: AppState,
  updatedAt: serverTimestamp()
}
```

## AppState

```js
{
  version: 2,
  meals: Meal[],
  selections: Record<mealId, optionKey>,
  dailyLogs: Record<yyyy-mm-dd, DailyLog>,
  stockItems: Record<stockItemId, StockItem>,
  stock: Record<stockItemId, number>,
  log: LogEntry[],
  shoppingCart: Record<mealId, Record<optionKey, number>>,
  stockManagementEnabled: boolean,
  dietTiming: {
    minHoursBetweenMeals: number
  }
}
```

## StockItem

Ingredientes de estoque possuem ID estavel. O nome e apenas exibicao.

```js
{
  id: "stk_chicken_breast",
  name: "Peito de frango",
  unit: "g",
  category?: "proteina",
  price?: {
    unitPrice: 8.5,
    basis: "kg" // g | kg | ml | l | unidade
  }
}
```

## Meal

```js
{
  id: "meal1",
  title: "Refeicao 1",
  subtitle: "Cafe da manha",
  macros: "40g P / 50g C / 15g G",
  options: {
    A: MealItem[],
    B: MealItem[],
    C: MealItem[]
  }
}
```

## MealItem

O nome do ingrediente na refeicao pode ser diferente do ingrediente real de estoque.

```js
{
  label: "Peito de frango grelhado",
  qty: 150,
  unit: "g",
  stockItemId: "stk_chicken_breast"
}
```

## DailyLog

```js
{
  water: 2.5,
  completedMeals: {
    meal1: {
      option: "A",
      completedAt: "2026-06-19T12:00:00.000Z",
      items: MealItem[]
    }
  }
}
```

## LogEntry

```js
{
  date: "19/06/2026, 12:00",
  isoDate: "2026-06-19T12:00:00.000Z",
  type: "entrada" | "saida" | "consumo" | "ajuste",
  detail: "Registro manual",
  items: Array<{
    stockItemId: string,
    name: string,
    qty: number,
    unit: string
  }>,
  alert?: string
}
```

## Migration Notes

- `shoppingPrices` e legado. Precos novos pertencem a `stockItems[id].price`.
- `weeklyPlan` e legado. Carrinho novo usa `shoppingCart`.
- `completed` e legado. Logs diarios novos usam `dailyLogs[date].completedMeals`.
