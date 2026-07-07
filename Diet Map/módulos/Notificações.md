# Notificações

## Objetivo

Criar lembretes úteis para refeições e treino sem deixar o app invasivo.

## Fluxos desejados

- Alertas de refeições no horário planejado.
- Alertas de descanso no treino.
- Som opcional dentro da sessão de treino.
- Vibração/notificação quando o dispositivo e o navegador suportarem.

## Decisões iniciais

- Pedir permissão de notificação só quando a feature estiver configurada ou ativada.
- Manter controle simples para ligar/desligar.
- Tratar push real como incremental, porque PWA/mobile varia muito por navegador.

## Feature relacionada

- [[../features/FEAT-014 - Push notifications e alertas]]
