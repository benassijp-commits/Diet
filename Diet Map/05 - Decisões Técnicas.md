# Decisões Técnicas

## Desenvolvimento

- O app usa React + Vite na branch dev.
- O desenvolvimento deve seguir roadmap modular com ciclos pequenos.
- Codex deve receber tarefas delimitadas.
- Não usar prompt gigante estilo waterfall para construir tudo de uma vez.
- O guia operacional para conversas futuras do Codex fica em `docs/CODEX_OPERATIONS.md`.

## Sync

- O bug de snapshot remoto sobrescrevendo alterações locais recentes foi tratado na fase 0.2 alpha.
- A estratégia offline/local/nuvem avançada continua separada e congelada por enquanto.
- Estado visual de interface não deve ser sincronizado indiscriminadamente na nuvem.

## Estado sincronizado vs estado de interface

Dados reais do usuário devem sincronizar:
- refeições;
- dietas;
- estoque;
- histórico;
- carrinho como conteúdo;
- treinos;
- registros de treino;
- preços;
- configurações importantes.

Estado visual deve ficar local:
- cards colapsados;
- painel aberto/fechado;
- aba ativa;
- modal aberta;
- scroll;
- filtros temporários;
- estado de loading.

## Ingredientes e tradução

- Ingredientes devem ter ID interno universal independente do idioma.
- Nomes e aliases devem ser por idioma.
- Quando a IA criar ingrediente novo no futuro, deve tentar preencher nomes e aliases nos idiomas suportados.
- Idiomas inicialmente desejados:
  - pt-BR
  - en
  - nl
  - fr
  - es
  - it

## Estoque

- Estoque não deve ficar negativo.
- Futuramente, considerar registros/eventos de estoque para compras, consumo, perdas e conferência.

## IA para testers alpha

- Para a alpha, a prioridade é reduzir atrito: o tester deve conseguir usar IA sem configurar provider, modelo e chave manualmente.
- Embutir chave real no front-end é inseguro, porque qualquer usuário pode extrair a chave pelo bundle ou pelas requisições.
- Se for usado front-end por rapidez, usar chave limitada, revogável e com baixo teto de custo.
- Caminho melhor para depois: proxy/backend, por exemplo Firebase Function, mantendo a chave fora do navegador.

## Versionamento alpha

- Versões grandes de alpha usam formato como `0.3`, `0.4`, `0.5`.
- Pacotes pequenos de feature podem usar incrementos como `0.21`, `0.22`, `0.25`.
- Hotfixes rápidos podem usar sufixo de letra, por exemplo `0.21A`, `0.21B`, `0.21C`.
- A versão 1.0 fica reservada para uma etapa beta/madura, não para a alpha atual.
