# Prompts Codex

## Regra geral

Prompts devem ser delimitados.

Evitar:
- “melhore o app”
- “corrija todos os bugs”
- “refatore tudo”

Preferir:
- objetivo claro;
- arquivos principais;
- fora de escopo;
- validações;
- commit message;
- push explícito.

## Prompt recomendado - Restaurar regressões da migração React

Objetivo:
Restaurar funcionalidades da branch main que desapareceram na branch dev após migração React.

Itens:
1. Colapsar/expandir refeições.
2. Editor deve permitir escolher e editar qualquer opção da refeição.
3. Adicionar nova opção de refeição.
4. Restaurar refeição avulsa.
5. Restaurar intervalo mínimo entre refeições.
6. Corrigir modal mobile cortado, se possível sem grande refatoração.

Não incluir:
- botão reiniciar dia;
- tradução;
- check-in corporal;
- finanças;
- AI chat;
- gráficos;
- offline sofisticado;
- ajuste de quantidades ao consumir;
- dropdown do catálogo nutricional;
- cycle count.
