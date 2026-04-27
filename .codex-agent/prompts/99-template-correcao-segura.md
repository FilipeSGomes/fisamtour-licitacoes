# PROMPT 99 — Template de Correção Segura

## Modo

Alteração controlada.

## Leitura obrigatória

- .codex-agent/AGENTS.md
- .codex-agent/README-PROJETO.md
- .codex-agent/MAPA-MENTAL.md
- .codex-agent/RISCOS.md
- .codex-agent/DECISOES.md
- contrato de mudança correspondente em .codex-agent/contracts/

## Objetivo

Executar somente a alteração descrita no contrato.

## Regras

- Não alterar arquivos fora do escopo.
- Não refatorar por estética.
- Não mudar comportamento não relacionado.
- Não instalar dependências.
- Não alterar schema sem migration.
- Não remover código sem justificar.
- Diff mínimo.

## Saída obrigatória

1. Arquivos lidos.
2. Arquivos alterados.
3. O que mudou.
4. Por que mudou.
5. Como testar.
6. Como reverter.
7. Riscos remanescentes.
8. Atualizações feitas na documentação viva.
