# CODEX_OPERATIONS.md

Guia curto para operar este repo com seguranca e sem gastar tokens repetindo fluxo ja conhecido.

## Checklist inicial

Sempre comecar por:

```powershell
git branch --show-current
git status --short
git diff --stat
```

- Trabalhos normais: usar `dev`.
- Publicacao: merge/push de `dev` para `main`.
- Nao usar `git add -A`; stage sempre explicito.
- Se aparecer alteracao nao relacionada, arquivo sensivel ou conflito inesperado, parar e avisar.
- Nao commitar `.secrets/`, `node_modules/`, logs, `data/backups/`, tokens, service accounts ou configs locais.

## Ambientes

- Dev Firebase: `dieta-e6bee-dev`.
- Prod Firebase: `dieta-e6bee`.
- `.env.development` aponta para dev.
- `.env.production` aponta para prod.
- `npm.cmd run build` faz build de producao. Nao usar `--mode development` para publicar.
- Deploy sempre com `--project prod` quando for producao. Nunca rodar `firebase deploy` sem projeto explicito.

## Build

```powershell
npm.cmd run build
```

Esperado: `building for production...`. Aviso de chunk grande nao e erro.

## Fluxo rapido de release

```powershell
git checkout dev
git pull origin dev
git fetch origin
git merge origin/main
npm.cmd run build
git add <arquivos explicitos>
git commit -m "<mensagem>"
git push origin dev

git checkout main
git pull origin main
git merge dev
git push origin main
```

Se o merge de `origin/main` em `dev` tiver conflito, preservar o que ja esta em producao e a mudanca atual. Resolver, buildar e commitar.

## Hosting prod

Usar service account local e o patch de gaxios:

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Scion\Documents\Diet\.firebase-cli-config'
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\Users\Scion\Documents\Diet\.secrets\firebase-service-account.json'
$env:NODE_OPTIONS='--require C:\Users\Scion\Documents\Diet\tools\firebase-gaxios-token-patch.cjs'
firebase.cmd deploy --only hosting --project prod --non-interactive
```

## Functions prod

Antes de deploy:

```powershell
cd functions
npm.cmd install
node --check index.js
node -e "import('./index.js').then(m=>console.log(Object.keys(m))).catch(e=>{console.error(e); process.exit(1)})"
cd ..
```

Regras:

- Entrar em `functions` e rodar `npm.cmd install` se dependencias precisarem mudar.
- Nao usar `npm.cmd --prefix functions install`; isso ja acoplou `functions` ao app React/Vite e quebrou discovery.
- Nao usar `NODE_OPTIONS` com `tools/firebase-gaxios-token-patch.cjs` no deploy de Functions.
- Nao mexer em `aiProxy` salvo pedido explicito.

Deploy:

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Scion\Documents\Diet\.firebase-cli-config'
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\Users\Scion\Documents\Diet\.secrets\firebase-service-account.json'
Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
firebase.cmd deploy --only functions --project prod --non-interactive
```

## Firestore indexes prod

```powershell
$env:XDG_CONFIG_HOME='C:\Users\Scion\Documents\Diet\.firebase-cli-config'
$env:GOOGLE_APPLICATION_CREDENTIALS='C:\Users\Scion\Documents\Diet\.secrets\firebase-service-account.json'
firebase.cmd deploy --only firestore:indexes --project prod --non-interactive
```

Se o deploy retornar `409 index already exists`, nao insistir. Tratar como indice ja presente e seguir, salvo se houver outro erro.

## 409 no deploy de Functions

O Google Cloud pode retornar 409 depois de fazer upload/iniciar deploy, por exemplo:

- `Resource ... functions/<name> already exists`
- `unable to queue the operation`

Nao entrar em loop de retry. Primeiro verificar:

```powershell
Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
firebase.cmd functions:list --project prod
```

Se a funcao esperada aparecer com trigger/runtime corretos, considerar o deploy efetivo confirmado e seguir. So repetir deploy se a funcao nao aparecer, estiver errada, ou se o erro nao for esse 409 operacional.

## Dados persistidos

Mudancas em Firestore/localStorage exigem cuidado:

- Atualizar defaults e migracao (`initialState`, `migrateState`) quando aplicavel.
- Preservar dados antigos e campos desconhecidos.
- Nao migrar/apagar producao sem pedido explicito e backup.

## Resumo final

Responder curto com:

- Branch inicial/final.
- Arquivos alterados.
- Build/checks.
- Commit/push/deploy feitos.
- Projeto Firebase usado, se aplicavel.
- Pendencias ou erros reais.
