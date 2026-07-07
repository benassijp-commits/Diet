# Sync Local Nuvem Offline

## Bug atual

Quando o usuário está logado, snapshots remotos podem sobrescrever alterações locais recentes.

Este é um bug operacional e deve ser corrigido antes de qualquer estratégia offline sofisticada.

## Regra mínima desejada

Enquanto o usuário fez alteração local recente, snapshot remoto antigo não deve sobrescrever a tela.

## Estado visual

Estado visual não deve ser salvo indiscriminadamente na nuvem.

Exemplos de estado visual:
- cards colapsados;
- painel aberto/fechado;
- aba ativa;
- modal aberta;
- scroll.

## Estratégia futura

Cenário futuro:
Usuário usa celular offline, depois usa PC online e altera dados. Quando celular reconecta, existem dados locais e dados de nuvem divergentes.

Abordagens futuras possíveis:
- escolher local ou nuvem manualmente;
- última alteração vence por módulo;
- merge por domínio;
- histórico de eventos;
- resolução de conflito guiada.

Status:
Congelado por agora.
