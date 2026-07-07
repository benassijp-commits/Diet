# CODEX_OPERATIONS.md

## 1. Objetivo deste guia

Guia rápido para novos chats do Codex executarem tarefas recorrentes com segurança, sem redescobrir fluxo de build, release, deploy, git e ambiente Firebase.

## 2. Regra geral antes de qualquer tarefa

- Confirmar branch atual.
- Rodar `git status --short`.
- Ler apenas arquivos relevantes para a tarefa.
- Não usar `git add -A` sem revisar.
- Parar se aparecer arquivo inesperado.
- Não mexer em produção sem pedido explícito.
- Não fazer deploy sem confirmação explícita.

```powershell
git branch --show-current
git status --short
git diff --stat
```

## 3. Branches

- `dev` = desenvolvimento.
- `main` = produção/publicação.
- Trabalhos normais começam em `dev`.
- Publicação acontece com merge de `dev` para `main`.
- Não trabalhar direto em `main`, salvo tarefa de release/deploy.

## 4. Ambientes Firebase

- `.env.development` aponta para `dieta-e6bee-dev`.
- `.env.production` aponta para `dieta-e6bee`.
- `firebase-config.js` usa `import.meta.env`.
- `npm.cmd run dev` usa development.
- `npm.cmd run build` usa production.
- Produção deve usar `dieta-e6bee`.
- Dev deve usar `dieta-e6bee-dev`.

Cuidados:

- Nunca fazer build production com `--mode development`.
- Nunca fazer deploy produção usando bundle development.
- Nunca usar `firebase deploy` sem `--project`.

## 5. Build

Comando normal:

```powershell
npm.cmd run build
```

Esperado:

- Output mostra `building for production...`.
- Aviso de chunk grande pode aparecer e não é erro.

Não usar para produção:

```powershell
npm.cmd run build -- --mode development
```

## 6. Deploy de produção

Comando preferido:

```powershell
firebase.cmd deploy --only hosting --project prod --non-interactive
```

Nunca usar:

```powershell
firebase.cmd deploy
```

`--project prod` é obrigatório. `.firebaserc` deve mapear `prod` para `dieta-e6bee`; `default`/`dev` podem apontar para `dieta-e6bee-dev` para reduzir risco.

## 7. Autenticação Firebase neste repo

Login interativo do Firebase CLI pode falhar neste ambiente. Antes de tentar soluções novas, verificar:

```powershell
tools/release-main-and-deploy.ps1
```

Usar o script como referência, não executar inteiro sem revisar. Ele pode conter `XDG_CONFIG_HOME`, `GOOGLE_APPLICATION_CREDENTIALS`, `NODE_OPTIONS` e fluxo antigo/agressivo com `git add -A`, commit, merge e deploy.

Para deploy isolado, preferir reproduzir só as variáveis necessárias e rodar deploy explícito:

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Scion\Documents\Diet\.firebase-cli-config'
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\Users\Scion\Documents\Diet\.secrets\firebase-service-account.json'
$env:NODE_OPTIONS='--require C:\Users\Scion\Documents\Diet\tools\firebase-gaxios-token-patch.cjs'
firebase.cmd deploy --only hosting --project prod --non-interactive
```

Não expor nem commitar conteúdo de `.secrets/`.

## 8. Release padrão

Fluxo seguro:

1. Estar em `dev`.
2. Verificar `git status`.
3. Rodar `npm.cmd run build`.
4. Commitar apenas arquivos esperados.
5. Push `dev`.
6. Switch `main`.
7. Pull `main`.
8. Merge `--no-ff dev`.
9. Rodar `npm.cmd run build` novamente.
10. Push `main`.
11. Deploy com `--project prod`.

```powershell
git switch dev
git status --short
npm.cmd run build
git add <arquivos explícitos>
git commit -m "release: prepare version X"
git push origin dev
git switch main
git pull origin main
git merge --no-ff dev
npm.cmd run build
git push origin main
firebase.cmd deploy --only hosting --project prod --non-interactive
```

## 9. Arquivos/pastas que não devem ser commitados

- `data/backups/`
- `.vite/`
- `.secrets/`
- `Untitled.base`
- `firebase-service-account.json`
- `FIREBASE_TOKEN`
- tokens
- logs temporários
- service account JSON
- chaves privadas
- chaves de IA pessoais

Se algum aparecer no `git status`: parar, explicar, adicionar ao `.gitignore` se for cache/local, e não commitar.

## 10. Alterações em dados persistidos

Se uma tarefa alterar estrutura persistida em Firestore/localStorage, tratar como mudança de dados e planejar migração.

- Não fazer silenciosamente.
- Avisar que envolve migração.
- Atualizar `initialState`.
- Atualizar `migrateState`.
- Preservar dados antigos do usuário.
- Não apagar campos desconhecidos sem motivo forte.
- Criar transformação compatível da versão anterior para a nova.
- Garantir defaults para campos novos.
- Manter IDs existentes quando possível.
- Rodar build e testar carregamento de estado antigo, se houver amostra.
- Não migrar produção sem backup e autorização explícita.

Objetivo: o usuário não deve perder dados ao avançar de versão; dados antigos devem ser adaptados para a nova base/estrutura.

## 11. Quando parar e pedir confirmação

Parar se:

- Build falhar.
- Aparecer arquivo inesperado no `git status`.
- Houver conflito de merge.
- Firebase project estiver ambíguo.
- Deploy pedir autenticação inesperada.
- Tarefa puder apagar/migrar dados.
- Aparecer arquivo sensível.
- Script fizer `git add -A`, commit, push ou deploy automático sem revisão.
- Houver dúvida entre dev e prod.

## 12. Resumo final de qualquer tarefa

Sempre responder com:

- Branch inicial e final.
- Arquivos alterados.
- Comandos rodados.
- Build passou/falhou.
- Commit/push/deploy feitos ou não.
- Project Firebase usado, se aplicável.
- Se tocou ou não em dados.
- Pendências/riscos.
