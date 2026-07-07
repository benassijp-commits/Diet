# FEAT-014 - Push notifications e alertas

Área: Notificações / Refeições / Treino  
Tipo: Feature alpha  
Prioridade: Alta  
Status: Próximo passo depois da IA padrão

## Objetivo

Criar alertas úteis para uso diário da dieta e do treino, começando por lembretes de refeição e descanso de exercícios.

## Problema que resolve

O app precisa lembrar o usuário nos momentos certos, principalmente em celular, para melhorar aderência à dieta e ao treino.

## Comportamento esperado

- Usuário pode ativar/desativar alertas.
- App pede permissão de notificação quando fizer sentido.
- Refeições podem gerar lembretes no horário planejado.
- Treino pode avisar quando o descanso terminar.
- Som e vibração devem ser opcionais quando suportados.

## Regras de negócio

- Alertas devem respeitar configurações do usuário.
- Não enviar notificações invasivas por padrão sem consentimento.
- Tratar limitações de notificações web no celular.
- Preferir implementação incremental: primeiro alertas simples, depois push mais completo.

## Dependências

- Horários planejados de refeição.
- Estado de treino/descanso.
- Permissões do navegador.
- Possível service worker/web push.

## Riscos

- Push notifications em PWA/mobile podem variar por navegador e sistema.
- iOS/Android podem exigir instalação ou permissões específicas.
- Notificações mal calibradas podem irritar testers.

## Escopo inicial

- Alertas de refeições.
- Alertas de descanso no treino.
- Configuração simples para ligar/desligar.
- Fallback dentro do app caso push real não esteja disponível.

## Fora de escopo por enquanto

- Central completa de notificações.
- Notificações por e-mail ou WhatsApp.
- Personalização avançada por dia da semana.
