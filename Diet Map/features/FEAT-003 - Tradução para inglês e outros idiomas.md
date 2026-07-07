# FEAT-003 - Tradução para inglês e outros idiomas

Área: Internacionalização / Banco de dados / IA  
Tipo: Feature grande com validação parcial na alpha  
Prioridade: Alta apenas para validar inglês do catálogo; estratégica no longo prazo  
Status: Validar comportamento atual antes de ampliar escopo  

## Descrição

Adicionar suporte a múltiplos idiomas na interface e no catálogo de ingredientes.

Para a alpha atual, o objetivo não é tradução completa. O foco imediato é confirmar se, ao selecionar inglês, autocomplete/listas do catálogo de ingredientes mostram nomes em inglês quando disponíveis.

## Idiomas inicialmente desejados

- português do Brasil
- inglês
- holandês
- francês
- espanhol
- italiano

## Decisão técnica desejada

Cada ingrediente deve ter um ID interno universal independente do idioma.

Nomes e aliases devem ser por idioma.

## Regra futura

Quando a IA criar um ingrediente novo, ela deve tentar preencher nomes e aliases nos idiomas suportados, para evitar retrabalho no futuro.

## Fallback

Se não existir tradução no idioma selecionado, mostrar inglês ou idioma original.

## Escopo alpha

- Validar catálogo de ingredientes em inglês.
- Corrigir fallback se o app estiver mostrando português quando há inglês disponível.
- Não ampliar todos os idiomas agora.
