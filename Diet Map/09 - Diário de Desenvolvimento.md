# Diário de Desenvolvimento

## 2026-07-06

- Branch dev já está em React/Vite.
- App.jsx foi dividido em componentes menores.
- Build passou no Codex.
- Login Google em dev via IP local exigiu autorizar IP no Firebase.
- Bug de snapshot/sync ainda existe na dev.
- Bug afeta botões de refeição, água e cards colapsáveis.
- Deslogado do Google, o bug desaparece.
- Regressões percebidas após migração React:
  - colapsar/expandir refeições desapareceu ou ficou instável;
  - editor mostra apenas Opção A;
  - adicionar opção desapareceu;
  - refeição avulsa desapareceu;
  - intervalo mínimo entre refeições desapareceu;
  - modal mobile fica cortado.

## 2026-07-07

- Vault do Obsidian criado.
- 0.2 alpha preparada e publicada em produção.
- URL de produção: https://dieta-e6bee.web.app
- Produção usa Firebase `dieta-e6bee`.
- Desenvolvimento usa Firebase `dieta-e6bee-dev`.
- Login Google funcionando.
- Usuário novo inicia com estado limpo.
- Dados antigos de produção foram preservados.
- Estado do usuário salvo em `users/{uid}/state/current`.
- Regressões principais da migração React e sync foram movidas para resolvidos no vault.
- Próxima prioridade definida: [[features/FEAT-013 - IA padrão para testers alpha]].
- Segunda prioridade definida: [[features/FEAT-014 - Push notifications e alertas]].
- Também ficou registrado validar inglês do catálogo de ingredientes e corrigir textos em português sem acentuação.
- Regra de versionamento alpha registrada em [[05 - Decisões Técnicas]].
- Triagem de resolvidos no vault:
  - [[bugs/Resolvidos/BUG-006 - Dropdown de ingrediente usa estoque em vez de catálogo nutricional]] arquivado com base nos commits `5b9fe87` e `46206bb`.
  - [[features/Resolvidos/UI-001 - Melhorar visualização mobile de Estoque e Compras]] arquivado com base no commit `f58e1fc`.
- Itens restantes foram mantidos ativos por falta de evidência suficiente de conclusão completa.
