# Roadmap

Mapa curto do projeto. A ideia aqui e orientar a proxima decisao, nao documentar tudo.

## Agora

Versao funcional publicada:

https://dieta-e6bee.web.app

Estado atual:

- app de dieta funcionando;
- login Google/Firebase;
- sincronizacao Firestore;
- fallback local;
- PWA basico;
- refeicoes editaveis;
- estoque;
- compras;
- historico;
- tema claro/escuro;
- lista de compras com estimativa em euros;
- impressao da lista de compras via `printShoppingListPdf()`.

Proximo passo imediato:

- trabalhar a versao `0.2` na branch `dev`;
- nao publicar Firebase Hosting a partir da `dev`;
- testar pelo localhost;
- so fazer merge para `main` quando a etapa estiver estavel.

## Regras Do Produto

- Lei do menor esforco: o usuario registra o minimo possivel.
- Privacy-first: dados sensiveis devem ficar sob controle do usuario.
- IDs estaveis: nome exibido nao e chave primaria.
- IA sugere, usuario aprova quando houver risco de erro.
- Dietas antigas nao devem ser apagadas.
- Modularizar antes de adicionar modulos grandes.

## Arquitetura

Por agora:

- front-end;
- Firebase Auth;
- Firestore;
- Firebase Hosting;
- PWA.

Nao criar back-end proprio ainda.

Usar Cloud Functions no futuro quando precisarmos de:

- chave de IA/API externa;
- processamento de PDF/Excel;
- matching nutricional com IA;
- tarefas automaticas;
- logica que nao deve ficar no front-end.

## Proximas Features

0.2:

- Dietas versionadas.
- Base nutricional por ingrediente.
- Importacao de dieta com IA.
- Alertas globais.
- Configuracoes locais de IA.

Depois:

- Check-in corporal.
- Financeiro basico.
- Treinos e progressao de carga.
- Graficos.
- Analises de causa e efeito.

## Dietas Versionadas

Objetivo: importar ou criar uma dieta nova sem perder a anterior.

Regras:

- dieta nova importada vira ativa;
- dieta ativa anterior vira arquivada;
- inicio da dieta = data de ativacao/importacao;
- fim da dieta = quando uma dieta nova substitui ela;
- edicoes manuais pequenas nao precisam criar versao nova.

Usos futuros:

- voltar para dieta antiga;
- comparar resultados por dieta;
- calcular custo por dieta;
- medir assiduidade por dieta.

## Base Nutricional

Objetivo: cada ingrediente ter kcal, proteina, carboidrato e gordura.

Fibra fica fora por enquanto.

Direcao:

- manter uma base propria do app;
- importar uma base inicial confiavel;
- preservar nome original e traducao;
- usar API/IA para sugerir dados ou matches;
- salvar apenas dados aceitos/confiaveis no nosso banco.

Traducoes:

- nao duplicar bases inteiras por idioma;
- cada ingrediente deve ter um ID estavel;
- nomes por idioma devem ser campos/traducoes ligados ao mesmo ID.

Exemplo mental:

```txt
ingredientId: chicken_breast
names:
  pt: Peito de frango
  en: Chicken breast
  nl: Kipfilet
nutritionPer100g:
  kcal
  protein
  carbs
  fat
```

## Normalizacao De Ingredientes

Objetivo: transformar nomes diferentes no mesmo ingrediente base.

Fluxo:

1. limpar texto;
2. procurar nome/alias aprovado;
3. se nao encontrar, sugerir match;
4. usuario aprova;
5. app salva o alias para a proxima vez.

Nao vamos tentar cadastrar todos os aliases do mundo manualmente.

## Importador PDF/Excel

Pipeline desejado:

1. receber PDF ou Excel;
2. extrair texto/tabelas;
3. transformar em refeicoes, opcoes, ingredientes e quantidades;
4. normalizar ingredientes;
5. comparar com base nutricional;
6. pedir aprovacao dos matches duvidosos;
7. criar nova dieta ativa;
8. arquivar dieta anterior.

Provavelmente sera uma feature com Cloud Functions.

## Check-in Corporal

Campos provaveis:

- peso;
- medidas;
- fotos, depois;
- observacoes;
- energia/disposicao;
- sono, depois;
- aderencia percebida.

## Financeiro

Primeiro objetivo: custo alimentar real.

Campos/analises provaveis:

- custo por compra;
- custo por ingrediente;
- custo por dieta;
- custo por periodo;
- estimativa vs gasto real.

## Treino

Primeiro objetivo: progressao de carga.

Campos provaveis:

- exercicio;
- grupo muscular;
- treino;
- series;
- repeticoes;
- carga;
- observacoes.

## Analises

Objetivo mais forte do app: cruzar dados para entender causa e efeito.

Cruzar:

- dieta ativa;
- assiduidade;
- horarios;
- macros;
- estoque/consumo real;
- treino;
- sono;
- check-ins;
- financeiro.

Perguntas futuras:

- qual dieta funcionou melhor?
- o que coincidiu com melhora/piora corporal?
- sono afetou resultado?
- custo subiu sem melhorar resultado?
- aderencia caiu em alguma fase?

## Produto E Privacidade

Possivel diferencial:

- bodybuilding serio;
- dieta + compras + estoque + treino + check-in + financeiro;
- importacao de dieta de coach;
- analises reais, nao apenas registro solto;
- privacidade como principio.

Antes de monetizar:

- testar com uso proprio;
- mostrar para poucas pessoas do meio;
- validar se pagariam;
- revisar seguranca, privacidade, termos e marca.
