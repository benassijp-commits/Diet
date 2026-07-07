# BUG-014 - Loading e feedback para chamadas de IA

Área: IA / Importação / Dieta / Exercícios / Ingredientes
Tipo: Bug de feedback / UX
Prioridade: Média
Status: Aberto

## Descrição

Toda operação que faz chamada para IA deve mostrar estado de carregamento e feedback claro ao usuário.

Isso inclui:
- importação/processamento de dieta;
- importação/processamento de treino;
- resolução de ingredientes;
- criação de ingredientes via IA;
- qualquer geração ou normalização de JSON com IA.

## Problema atual

O usuário não sabe se:
- a IA ainda está processando;
- pode fechar o modal;
- trocar de aba cancela a operação;
- a operação falhou;
- a operação terminou;
- os dados foram adicionados.

## Resultado esperado

Durante chamadas de IA:
- mostrar loading;
- bloquear botões perigosos;
- informar sucesso ou erro;
- deixar claro se a operação continua ou cancela ao fechar modal;
- evitar que o usuário duplique chamadas por clicar várias vezes.

## Prioridade

Média por enquanto, mas importante antes de uso real com mais pessoas.