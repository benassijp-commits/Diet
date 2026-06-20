export const BASE_STOCK_ITEMS = [
  stockItem("stk_eggs", "Ovo inteiro", "unidades", "proteína", nutrition(72, 6.3, 0.4, 5)),
  stockItem("stk_egg_whites", "Clara de ovo", "unidades", "proteína", nutrition(17, 3.6, 0.2, 0)),
  stockItem("stk_bread", "Pão integral", "fatias", "carboidrato", nutrition(70, 3.5, 12, 1.1)),
  stockItem("stk_banana", "Banana", "unidade", "fruta", nutrition(105, 1.3, 27, 0.3)),
  stockItem("stk_albumin", "Albumina em pó", "g", "proteína", perGram(360, 80, 5, 1)),
  stockItem("stk_oats", "Aveia em flocos", "g", "carboidrato", perGram(389, 17, 66, 7)),
  stockItem("stk_oat_flour", "Farinha de aveia", "g", "carboidrato", perGram(389, 17, 66, 7)),
  stockItem("stk_peanut_butter", "Pasta de amendoim", "g", "gordura", perGram(588, 25, 20, 50)),
  stockItem("stk_butter", "Manteiga", "g", "gordura", perGram(717, 1, 1, 81)),
  stockItem("stk_strawberries", "Morangos", "g", "fruta", perGram(32, 0.7, 7.7, 0.3)),
  stockItem("stk_chicken_breast", "Peito de frango", "g", "proteína", perGram(165, 31, 0, 3.6)),
  stockItem("stk_rice", "Arroz cozido", "g", "carboidrato", perGram(130, 2.7, 28, 0.3)),
  stockItem("stk_olive_oil", "Azeite de oliva", "ml", "gordura", nutrition(8.1, 0, 0, 0.9)),
  stockItem("stk_vegetables", "Legumes variados", "g", "vegetais", perGram(35, 2, 7, 0.3)),
  stockItem("stk_lean_beef", "Carne vermelha magra", "g", "proteína", perGram(190, 29, 0, 8)),
  stockItem("stk_potato_puree", "Purê de batata em pó reconstituído", "g", "carboidrato", perGram(85, 2, 18, 0.1)),
  stockItem("stk_pasta", "Macarrão cozido", "g", "carboidrato", perGram(158, 5.8, 31, 0.9)),
  stockItem("stk_tomato_sauce", "Molho de tomate natural", "porção", "molho", nutrition(35, 1.5, 7, 0.3)),
  stockItem("stk_light_mayo", "Maionese light", "colher de sopa", "gordura", nutrition(35, 0.2, 1, 3.5)),
  stockItem("stk_salmon", "Salmão grelhado", "g", "proteína", perGram(208, 20, 0, 13)),
  stockItem("stk_broccoli_carrot", "Brócolis e cenoura no vapor", "g", "vegetais", perGram(35, 2, 7, 0.3)),
  stockItem("stk_nuts", "Castanhas ou amêndoas", "g", "gordura", perGram(607, 20, 21, 54)),
  stockItem("stk_lactose_free_milk", "Leite desnatado zero lactose", "ml", "laticínio", nutrition(0.34, 0.034, 0.05, 0.001)),
];

export const MEALS = [
  meal("meal1", "Refeição 1", "Café da manhã", "40g P / 50g C / 15g G", {
    A: [
      mealItem("Ovo inteiro mexido", 3, "unidades", "stk_eggs"),
      mealItem("Pão integral", 3, "fatias", "stk_bread"),
      mealItem("Banana média", 1, "unidade", "stk_banana"),
    ],
    B: [
      mealItem("Albumina em pó", 40, "g", "stk_albumin"),
      mealItem("Aveia em flocos", 60, "g", "stk_oats"),
      mealItem("Pasta de amendoim", 15, "g", "stk_peanut_butter"),
    ],
    C: [
      mealItem("Pão integral na chapa", 3, "fatias", "stk_bread"),
      mealItem("Manteiga", 15, "g", "stk_butter"),
      mealItem("Albumina em pó no shake", 35, "g", "stk_albumin"),
      mealItem("Morangos", 150, "g", "stk_strawberries"),
    ],
  }),
  meal("meal2", "Refeição 2", "Almoço", "45g P / 50g C / 12g G", {
    A: [
      mealItem("Peito de frango grelhado", 150, "g", "stk_chicken_breast"),
      mealItem("Arroz branco ou integral cozido", 200, "g", "stk_rice"),
      mealItem("Azeite de oliva", 5, "ml", "stk_olive_oil"),
      mealItem("Legumes cozidos", 100, "g", "stk_vegetables"),
    ],
    B: [
      mealItem("Carne vermelha magra", 160, "g", "stk_lean_beef"),
      mealItem("Purê de batata em pó reconstituído", 180, "g", "stk_potato_puree"),
      mealItem("Salada de legumes", 100, "g", "stk_vegetables"),
    ],
    C: [
      mealItem("Peito de frango", 150, "g", "stk_chicken_breast"),
      mealItem("Macarrão cozido", 180, "g", "stk_pasta"),
      mealItem("Molho de tomate natural", 1, "porção", "stk_tomato_sauce"),
      mealItem("Legumes variados", 100, "g", "stk_vegetables"),
    ],
  }),
  meal("meal3", "Refeição 3", "Lanche / pré-treino", "35g P / 45g C / 10g G", {
    A: [
      mealItem("Peito de frango desfiado", 130, "g", "stk_chicken_breast"),
      mealItem("Purê de batata em pó reconstituído", 220, "g", "stk_potato_puree"),
    ],
    B: [
      mealItem("Albumina em pó batida", 30, "g", "stk_albumin"),
      mealItem("Banana", 1, "unidade", "stk_banana"),
      mealItem("Farinha de aveia", 40, "g", "stk_oat_flour"),
    ],
    C: [
      mealItem("Pão integral sanduíche", 3, "fatias", "stk_bread"),
      mealItem("Peito de frango desfiado", 120, "g", "stk_chicken_breast"),
      mealItem("Maionese light", 1, "colher de sopa", "stk_light_mayo"),
    ],
  }),
  meal("meal4", "Refeição 4", "Jantar", "45g P / 50g C / 18g G", {
    A: [
      mealItem("Salmão grelhado", 200, "g", "stk_salmon"),
      mealItem("Macarrão cozido", 180, "g", "stk_pasta"),
      mealItem("Legumes", 100, "g", "stk_vegetables"),
    ],
    B: [
      mealItem("Peito de frango", 160, "g", "stk_chicken_breast"),
      mealItem("Arroz", 200, "g", "stk_rice"),
      mealItem("Ovo frito na água ou antiaderente", 2, "unidades", "stk_eggs"),
      mealItem("Legumes", 100, "g", "stk_vegetables"),
    ],
    C: [
      mealItem("Salmão grelhado", 200, "g", "stk_salmon"),
      mealItem("Purê de batata em pó reconstituído", 200, "g", "stk_potato_puree"),
      mealItem("Brócolis e cenoura no vapor", 100, "g", "stk_broccoli_carrot"),
    ],
  }),
  meal("meal5", "Refeição 5", "Ceia", "41g P / 46g C / 13g G", {
    A: [
      mealItem("Albumina em pó", 45, "g", "stk_albumin"),
      mealItem("Purê de batata em pó com água e canela", 40, "g", "stk_potato_puree"),
      mealItem("Castanhas ou amêndoas", 15, "g", "stk_nuts"),
    ],
    B: [
      mealItem("Ovo inteiro cozido", 3, "unidades", "stk_eggs"),
      mealItem("Pão integral", 2, "fatias", "stk_bread"),
      mealItem("Leite desnatado zero lactose", 200, "ml", "stk_lactose_free_milk"),
    ],
    C: [
      mealItem("Ovo inteiro", 2, "unidades", "stk_eggs"),
      mealItem("Clara de ovo", 4, "unidades", "stk_egg_whites"),
      mealItem("Pão integral", 3, "fatias", "stk_bread"),
    ],
  }),
];

function stockItem(id, name, unit, category, nutritionValue = nutrition(0, 0, 0, 0)) {
  return { id, name, unit, category, nutrition: nutritionValue };
}

function nutrition(kcal, protein, carbs, fat) {
  return { kcal, protein, carbs, fat };
}

function perGram(kcal, protein, carbs, fat) {
  return nutrition(kcal / 100, protein / 100, carbs / 100, fat / 100);
}

function meal(id, title, subtitle, macros, options) {
  return { id, title, subtitle, macros, options };
}

function mealItem(label, qty, unit, stockItemId) {
  return { label, qty, unit, stockItemId };
}
