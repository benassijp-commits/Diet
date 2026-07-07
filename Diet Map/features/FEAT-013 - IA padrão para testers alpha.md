# FEAT-013 - IA padrão para testers alpha

Área: IA / Configuração / Onboarding  
Tipo: Feature alpha  
Prioridade: Crítica  
Status: Próximo passo

## Objetivo

Permitir que testers da alpha usem as funções de IA sem precisar preencher chave de API, provider, URL ou modelo manualmente.

## Problema que resolve

Na alpha, o atrito de configuração atrapalha teste real. O ideal é que um usuário novo faça login e já consiga testar importação/análise com IA usando uma configuração padrão.

## Comportamento esperado

- App carrega uma configuração padrão de IA para novos usuários.
- Modelo padrão já vem selecionado.
- Usuário ainda pode trocar a configuração se quiser.
- Interface não deve exigir que o tester entenda detalhes técnicos antes de testar.

## Regras de negócio

- Para alpha, aceitar solução pragmática se ela acelerar testes.
- Não usar chave principal com crédito alto.
- Se a chave ficar no front-end, considerar a chave exposta e revogável.
- Registrar claramente que isso é temporário.

## Dependências

- Configurações atuais de IA.
- Fluxo de onboarding/estado inicial do usuário.
- Possível uso futuro de Firebase Function ou outro proxy.

## Riscos

- Chave embutida no front-end pode ser extraída.
- Custo pode subir se a chave vazar.
- Testers podem ficar presos a um modelo default se a UI não deixar claro como alterar.

## Escopo inicial

- Definir provider/modelo padrão.
- Preencher defaults para usuário novo.
- Validar que usuário novo consegue usar IA sem configurar manualmente.
- Usar chave limitada, se a decisão for manter isso no front-end durante alpha.

## Fora de escopo por enquanto

- Proxy seguro definitivo.
- Controle avançado de cotas por usuário.
- Painel administrativo de modelos.
