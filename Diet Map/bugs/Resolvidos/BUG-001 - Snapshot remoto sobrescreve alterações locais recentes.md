# BUG-001 - Snapshot remoto sobrescreve alterações locais recentes

Área: Sync / Google / Firestore  
Tipo: Bug crítico  
Prioridade: Crítica  
Status: Confirmado na main e na dev  

## Descrição

Quando o usuário está logado com Google/Firebase, qualquer alteração local rápida pode ser revertida para um estado anterior. Isso afeta seleção de opções de refeição, água e cards colapsáveis.

Quando o usuário desloga, o problema desaparece.

## Causa provável

O listener de Firestore aplica snapshots remotos antigos sobre o estado local recente.

O app parece sincronizar um objeto grande de estado, incluindo dados reais e estado de UI.

## Resultado atual

Usuário toca em um botão, a tela muda por um instante e depois volta para o estado anterior.

## Resultado esperado

Snapshots remotos não devem sobrescrever alterações locais pendentes ou muito recentes.

Estado visual local, como cards colapsados, não deveria ser controlado por snapshot remoto.

## Prioridade

Crítica.
