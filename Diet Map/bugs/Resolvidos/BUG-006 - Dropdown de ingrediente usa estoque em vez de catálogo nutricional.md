# BUG-006 - Dropdown de ingrediente usa estoque em vez de catálogo nutricional

Área: Refeições / Ingredientes / Catálogo nutricional  
Tipo: Bug funcional  
Prioridade: Alta  
Status: Resolvido  

## Descrição

Ao adicionar ou editar um item de refeição, o dropdown de ingrediente parece listar apenas itens relacionados ao estoque.

O correto é listar ingredientes do catálogo nutricional/banco de dados.

## Resultado esperado

O campo de ingrediente deve permitir selecionar itens do catálogo nutricional.

Se o ingrediente também existir no estoque, o app pode vincular para baixa de estoque ao consumir.

Se não existir em estoque, a refeição ainda deve poder ser criada.

## Evidência de resolução

- `5b9fe87 feat: integrate nutrition catalog with meal editing`
- `46206bb fix: improve ingredient combobox behavior`
