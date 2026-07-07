# Arquitetura Atual

## Branch

Branch principal de desenvolvimento: dev

## Stack

- React
- Vite
- Firebase Auth
- Firestore
- Firebase Hosting
- localStorage
- IA para importação/resolução de ingredientes

## Estrutura conhecida

- `src/ui/App.jsx`: composição principal
- `src/ui/layout`: Sidebar, Topbar
- `src/ui/meals`: componentes de refeições
- `src/ui/workouts`: componentes de exercícios
- `src/ui/tabs`: abas secundárias
- `src/ui/shared`: componentes compartilhados
- `src/state/app-state.js`: estado inicial, reducer, migração e persistência
- `src/hooks/useAppStore.js`: integração entre estado local, localStorage e Firestore
- `src/services/cloud-store.js`: autenticação e sync com Firebase

## Firebase

- Produção: `dieta-e6bee`
- Desenvolvimento: `dieta-e6bee-dev`
- Hosting de produção: https://dieta-e6bee.web.app
- Estado principal do usuário: `users/{uid}/state/current`

## Observações

App.jsx foi reduzido após extração de componentes.

Documento único de estado continua aceitável para a alpha. Migração para schema modular deve ser reavaliada quando check-ins, histórico avançado, coach ou permissões por módulo virarem prioridade.
