# Notification Architecture

Este documento define a arquitetura recomendada para timers de treino e lembretes de refeicao no app React/Vite/Firebase PWA.

## Contexto

O app usa Firebase Cloud Messaging para push remoto e uma Cloud Function `processScheduledNotifications` para processar documentos em `users/{uid}/scheduledNotifications`.

Esse modelo funciona bem para lembretes tolerantes a atraso, como refeicoes, mas nao e a melhor base para timers curtos de treino. Descansos de 30, 45, 60 ou 90 segundos precisam de feedback preciso, enquanto Cloud Scheduler e execucao server-side tem granularidade, cold start, rede e permissao envolvidos.

## Camadas de notificacao

### 1. Timer local enquanto o app esta aberto

Quando o app esta aberto, o timer de treino deve ser local:

- `setTimeout`/estado React para contagem regressiva visual.
- Notificacao local via Web Notification quando permitido.
- Audio curto e vibracao como fallback imediato.
- Persistencia de `timerEndsAt` para recuperar o estado se a tela dormir ou o app for reaberto.

Essa camada e a mais precisa no PWA enquanto o navegador mantem o app vivo. Ela deve ser a experiencia principal para descanso de treino com app aberto.

### 2. FCM push remoto como fallback

FCM push remoto deve ser tratado como fallback, nao como cronometro de precisao. Ele e util quando:

- o app esta em background;
- o navegador permite push;
- o atraso de alguns segundos ou mais e aceitavel;
- o evento nao depende de precisao sub-minuto.

Para refeicoes, esse fallback e aceitavel. Para descanso de treino, ele pode avisar tarde ou nao avisar se o job server-side nao rodar exatamente no intervalo esperado.

### 3. Limite do Cloud Scheduler

Cloud Scheduler e adequado para jobs recorrentes globais, mas nao para notificacoes individuais de baixa latencia.

Limites relevantes:

- A frequencia pratica minima e de 1 minuto.
- Um job global "varre" documentos vencidos, entao uma notificacao pode atrasar ate o proximo ciclo.
- Se a Function tiver cold start, permissao, indice faltando ou Scheduler pausado, o documento pode ficar `pending`.
- O scheduler nao foi desenhado para milhares de timers individuais de treino.

Esse modelo e aceitavel para refeicoes, porque lembretes de refeicao toleram atraso de ate alguns minutos. Nao e ideal para descanso curto de treino.

### 4. Cloud Tasks como alternativa server-side

Cloud Tasks permite agendar uma tarefa HTTP individual para um horario especifico.

Vantagens:

- Melhor granularidade que um scheduler global de 1 minuto.
- Cada notificacao vira uma task independente.
- Evita varreduras frequentes em collection group.
- Pode reduzir dependencias de indices compostos para documentos vencidos.

Custos e cuidados:

- Exige uma Function HTTP/callable ou endpoint protegido para receber a task.
- Precisa deduplicacao por usuario/tipo/dedupeKey.
- Precisa cancelar ou ignorar tasks obsoletas quando o usuario altera/cancela um lembrete.
- Ainda e push remoto: entrega FCM continua dependendo de rede, sistema operacional e permissao.

Cloud Tasks e boa evolucao para lembretes de refeicao e eventos server-side com tolerancia moderada. Ainda nao resolve perfeitamente timers de treino sub-minuto.

### 5. Capacitor Local Notifications

Para Android/iOS, a arquitetura recomendada para treino com app fechado e usar Capacitor com Local Notifications nativas.

Vantagens:

- O agendamento fica no sistema operacional do dispositivo.
- Melhor precisao para timers curtos que push remoto.
- Funciona sem depender de Cloud Scheduler, Cloud Tasks ou rede no momento do alarme.
- Permite som, vibracao e canais Android especificos.

Limites:

- Requer empacotar o app como app nativo via Capacitor.
- Requer fluxo de permissao nativo.
- Requer testar politicas de bateria, background e notificacoes por fabricante Android.
- No iOS, comportamento depende das regras de notificacao local e permissao do usuario.

## Arquitetura recomendada

### Refeicoes

Usar notificacoes remotas.

Opcao atual:

- `scheduledNotifications` no Firestore.
- `processScheduledNotifications` varrendo documentos vencidos.
- Suficiente se o atraso de ate alguns minutos for aceitavel.

Opcao melhor:

- Cloud Tasks por lembrete de refeicao.
- Endpoint backend protegido para enviar FCM e marcar status.
- Firestore continua sendo historico/diagnostico, nao mecanismo principal de timing.

Recomendacao: manter scheduler global no curto prazo e planejar migracao para Cloud Tasks se precisarmos de confiabilidade melhor, menos varredura e diagnostico mais direto.

### Treino com app aberto

Usar timer local como fonte de verdade.

Componentes:

- `timerEndsAt` persistido.
- UI local atualizada por intervalo curto.
- Web Notification local quando permitido.
- Audio e vibracao no fim do descanso.

FCM remoto pode existir como fallback, mas nao deve ser considerado responsavel pelo alarme principal de treino.

### Treino com app fechado

Usar Capacitor Local Notifications.

Fluxo recomendado:

- Ao iniciar descanso, agendar notificacao local nativa para `timerEndsAt`.
- Ao cancelar ou avancar descanso antes do fim, cancelar a notificacao local.
- Ao terminar naturalmente, deixar o OS entregar a notificacao.
- Ao abrir o app, reconciliar estado com `timerEndsAt`.

FCM remoto deve ficar reservado para lembretes de refeicao ou notificacoes assicronas, nao para descanso de treino de precisao.

## Proximos passos tecnicos para Capacitor

Sem implementar ainda:

1. Decidir se o PWA continua como canal web e Capacitor vira canal mobile empacotado.
2. Adicionar Capacitor ao projeto:
   - `@capacitor/core`
   - `@capacitor/cli`
   - `@capacitor/android`
   - `@capacitor/ios`, se iOS entrar no escopo
   - `@capacitor/local-notifications`
3. Criar `capacitor.config.*` com app id, app name e `webDir: "dist"`.
4. Gerar plataformas nativas com `npx cap add android` e, futuramente, `npx cap add ios`.
5. Criar um servico interno de notificacoes com interface unica:
   - `scheduleWorkoutRestNotification({ sessionId, dueAt, title, body })`
   - `cancelWorkoutRestNotification(sessionId)`
   - `requestLocalNotificationPermission()`
6. Implementar deteccao de ambiente:
   - Web/PWA: timer local + Web Notification/audio/vibracao.
   - Capacitor Android/iOS: Local Notifications nativas.
7. Criar canal Android para descanso de treino:
   - som curto;
   - vibracao;
   - prioridade alta;
   - nome claro para o usuario.
8. Reconciliar estado ao abrir o app:
   - se `timerEndsAt` ja passou, mostrar descanso concluido;
   - se ainda falta tempo, retomar contador;
   - se usuario cancelou, cancelar notificacao local pendente.
9. Testar em Android real:
   - app aberto;
   - app em background;
   - tela bloqueada;
   - modo economia de bateria;
   - permissao negada e concedida.
10. Manter FCM remoto para refeicoes e diagnostico, sem acoplar descanso curto de treino a Cloud Scheduler.

## Decisao

Para o app atual:

- Refeicoes: manter remoto no curto prazo; considerar Cloud Tasks para maior confiabilidade.
- Treino app aberto: timer local com audio/vibracao/Web Notification.
- Treino app fechado: planejar Capacitor Local Notifications como solucao correta.
- Cloud Scheduler: manter apenas para tarefas tolerantes a atraso, nao para timers curtos.
