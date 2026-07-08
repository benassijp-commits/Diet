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
  appSettings: {
    notificationsEnabled: boolean,
    notificationTypes: {
      mealReminders: boolean,
      stockAlerts: boolean,
      cartAlerts: boolean
    },
    language: "pt" | "en"
  },
  dietTiming: {
    minHoursBetweenMeals: number
  },
  mealReminder: {
    nextMealReminderAt: string,
    lastMealReminderBaseMealId: string,
    lastMealReminderNotifiedAt: string
  },
  workoutPlans: WorkoutPlan[],
  activeWorkoutPlanId: string,
  workoutSession?: WorkoutSession | null,
  workoutLogs: WorkoutSession[]
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

## WorkoutPlan

Treinos sao versionados como dietas. O plano ativo fica em `activeWorkoutPlanId`; planos antigos podem ser reativados.

```js
{
  id: "workout_123",
  name: "Treino hipertrofia",
  status: "active" | "archived",
  activatedAt: "2026-06-21",
  archivedAt: "",
  source: "manual" | "ai_import" | "baseline",
  notes: "Observacoes do coach",
  days: WorkoutDay[]
}
```

## WorkoutDay

```js
{
  id: "wday_123_A",
  label: "A",
  title: "Peito e triceps",
  notes: "",
  exercises: WorkoutExercise[]
}
```

## WorkoutExercise

```js
{
  id: "wex_123",
  name: "Supino reto",
  group: "Peito",
  notes: "",
  sets: [
    {
      reps: "8-12",
      load: "80 kg",
      restSeconds: 90,
      notes: ""
    }
  ]
}
```

## WorkoutSession

Sessao de execucao separada do plano original. Permite editar/adicionar exercicios durante o treino sem perder a referencia do plano.

```js
{
  id: "session_123",
  planId: "workout_123",
  planName: "Treino hipertrofia",
  dayId: "wday_123_A",
  dayLabel: "A",
  dayTitle: "Peito e triceps",
  startedAt: "2026-06-21T12:00:00.000Z",
  finishedAt: "2026-06-21T13:00:00.000Z",
  exercises: WorkoutExercise[],
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  phase: "ready" | "rest" | "done",
  remainingSeconds: 90,
  timerEndsAt: "2026-06-21T12:02:00.000Z",
  setLogs: [
    {
      exerciseIndex: 0,
      exerciseName: "Supino reto",
      setIndex: 0,
      reps: "8-12",
      load: "80 kg",
      restSeconds: 90,
      completedAt: "2026-06-21T12:01:00.000Z"
    }
  ]
}
```

## Migration Notes

- `shoppingPrices` e legado. Precos novos pertencem a `stockItems[id].price`.
- `weeklyPlan` e legado. Carrinho novo usa `shoppingCart`.
- `completed` e legado. Logs diarios novos usam `dailyLogs[date].completedMeals`.
