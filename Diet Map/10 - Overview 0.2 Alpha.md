# Diet App - Overview 0.2 Alpha

## Status atual

- App publicado em produção.
- URL: https://dieta-e6bee.web.app
- Versão: 0.2 alpha.
- Produção usa Firebase project `dieta-e6bee`.
- Desenvolvimento usa `dieta-e6bee-dev`.
- Usuário novo inicia limpo.
- Dados antigos de produção foram preservados.

## O que já funciona

- Login com Google.
- Criação e edição manual de refeições/dietas.
- Ingredientes com calorias, proteína, carboidrato e gordura.
- Lista de compras.
- Estoque.
- Registro de consumo.
- Treinos.
- Importação de dieta/treino com IA.
- Configurações de IA.
- Interface PT/EN parcialmente implementada.
- Base de ingredientes local/multilíngue em andamento.

## Arquitetura atual resumida

- React + Vite + Firebase Auth + Firestore + Hosting.
- State do usuário salvo em `users/{uid}/state/current`.
- Dev/prod separados por `.env.development` e `.env.production`.
- Catálogo de ingredientes é local do app.
- Estoque do usuário é dado persistido do usuário.

## Decisões importantes

- Manter documento único `state/current` por enquanto.
- Não fazer migração modular antes da alpha estabilizar.
- Usar `docs/CODEX_OPERATIONS.md` como guia operacional para futuros chats do Codex.
- Não usar `firebase deploy` sem `--project` explícito.
- Não commitar backups, `.vite`, `.secrets`, tokens ou service accounts.

## Próximas prioridades

- [[features/FEAT-013 - IA padrão para testers alpha]]
- [[features/FEAT-014 - Push notifications e alertas]]
- Testar se a base de ingredientes aparece em inglês quando o idioma está em inglês.
- Corrigir textos em português sem acentuação.
- Planejar aba de check-in corporal.
- Planejar migração/versionamento formal do state.
- Futuramente avaliar schema Firestore modular.

## Riscos e atenções

- Não embutir chave real de IA no front-end sem entender que ela fica exposta.
- Notificações web no celular podem ter limitações.
- i18n ainda pode ter textos incompletos.
- Documento único é aceitável agora, mas pode precisar separação no futuro.
