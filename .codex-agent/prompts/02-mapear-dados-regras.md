# PROMPT 02 — Mapear Dados e Regras de Negócio

## Modo obrigatório
SOMENTE LEITURA para runtime/código-fonte.

Memória do agente NÃO é somente leitura: toda execução deste prompt deve registrar o aprendizado nos arquivos `.codex-agent/`.

Não assuma regra fiscal, financeira ou jurídica.

## Objetivo
Mapear entidades, campos, validações e regras inferidas sem alterar código.

## Tarefas
1. Ler `index.html`, `app.js` e `.codex-agent/index/`.
2. Mapear entidade `lançamento` e campos associados.
3. Mapear regras aparentes de competência, status, tipo e valor.
4. Separar fato observado de hipótese.
5. Refletir cada achado contra a memória já existente antes de registrar:
   - se confirmar algo existente, consolidar ou tornar mais preciso;
   - se contradizer algo existente, registrar a contradição como gap/pergunta;
   - se for hipótese, marcar explicitamente como hipótese;
   - se for dúvida ou bloqueio, registrar mesmo sem resposta.
6. Atualizar obrigatoriamente `MAPA-MENTAL.md`, `DECISOES.md`, `GAPS.md` e `CHANGELOG-AGENTE.md`.
7. Atualizar ou criar inventário de dados quando houver novos campos, formatos, validações, contratos ou dúvidas sobre schema.

## Saída
Liste fatos, hipóteses, perguntas pendentes, bloqueios para alteração e arquivos de memória atualizados.
