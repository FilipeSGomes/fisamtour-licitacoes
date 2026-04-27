# Decisões e Hipóteses

## Decisões Confirmadas
- Projeto permanece em modo somente leitura para código-fonte.
- Alterações documentais dentro de `.codex-agent` são permitidas para a descoberta inicial solicitada.
- Prompts de descoberta devem persistir a execução na memória `.codex-agent/`; "somente leitura" não bloqueia atualização documental de memória.
- Qualquer mudança em runtime deve passar por contrato de mudança em `.codex-agent/contracts/`.
- Documentação dentro de `.codex-agent/` é memória viva e pode ser alterada por agentes para registrar aprendizados, decisões, riscos, gaps, contratos, inventários e contexto operacional.
- O Apps Script valida o token recebido.
- Não é necessário conhecer o schema real da planilha por enquanto, pois o backend está fora deste repositório.
- `closeMonth` deve travar a competência.
- Deve existir regra para impedir exclusão em mês fechado.
- Valor financeiro igual a `0` pode passar na validação.
- Teste real autorizado contra Apps Script pode usar dados sintéticos e sujar a base de desenvolvimento.

## Hipóteses
- Hospedagem estática pode ser GitHub Pages, inferida pela presença de `CNAME`; precisa confirmação.
- Persistência pode ser Google Sheets, inferida por comentário em `app.js` e uso de Google Apps Script; precisa confirmação.
- Endpoint Apps Script pode ser ambiente produtivo; precisa confirmação antes de qualquer chamada real ou alteração.
- `competencia` pode ser recorte contábil/operacional independente da `data` do lançamento; não há validação observada que amarre os dois campos.
- `categoria` parece texto livre no frontend; não há taxonomia oficial documentada.
- `created_at` e `updated_at` parecem campos de backend/planilha, não controlados pelo frontend.

## Perguntas Pendentes
- Onde está versionado o código do Google Apps Script?
- Qual é a planilha fonte de dados e quem tem permissão de leitura/escrita?
- Existe ambiente de homologação?
- Qual é o procedimento atual de deploy e rollback?
- Quais regras oficiais definem fechamento mensal, status de licitação e categorias financeiras?
- A operação `options` deve ser implementada no backend ou o frontend deve usar outro nome de operação?
- `delete` deve retornar `{ ok: false }` quando o ID não existe?
- A `data` do lançamento deve obrigatoriamente pertencer à `competencia` selecionada?
- Lançamentos com status `perdido` devem entrar nos totais financeiros?
- Existem categorias permitidas por `tipo` ou `status`?
- `fornecedor` deve ser obrigatório para despesas?
- `comprovante_url` deve ser obrigatório em algum cenário?
- Editar lançamento em competência fechada também deve ser bloqueado, além de excluir?

## Resultados de Teste Real
- Data: 2026-04-26.
- Competência sintética usada: `2099-01`.
- `list` retornou `{ ok: true, rows: [] }`.
- `options` retornou `{ ok: false, error: "op inválida" }`.
- `add` retornou erro de cabeçalho divergente na aba `Lancamentos`.
- `update` com ID inexistente retornou `{ ok: false, error: "Error: Nada para atualizar" }`.
- `delete` com ID inexistente retornou `{ ok: true }`.
- `closeMonth` retornou `{ ok: true, competencia, total_receitas, total_despesas, saldo, fechado_em }`.

## Assunções que Não Devem Ser Feitas
- Não assumir que o token é seguro por estar nomeado como token.
- Não assumir que a validação de token substitui autenticação/autorização de usuário.
- Não assumir que a API valida idempotência ou toda regra financeira.
- Não assumir que o fechamento mensal pode ser repetido sem efeito colateral.
- Não assumir que os dados da planilha podem ser modificados em teste.
- Não assumir regra fiscal, financeira, jurídica ou de licitação sem confirmação humana.
- Não assumir que `data` e `competencia` são equivalentes sem confirmação.
- Não assumir que status de licitação altera ou não altera cálculo financeiro sem regra oficial.
