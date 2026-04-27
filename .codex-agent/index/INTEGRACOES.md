# Integrações Externas

## Google Apps Script
Endpoint detectado em `app.js`.

Status do contrato: inferido pelo frontend e parcialmente testado contra o Apps Script em 2026-04-26.

Endpoint base:
- `CONFIG.API_URL` em `app.js`

Autorização:
- O Apps Script valida o `token` recebido.
- O token fica público no navegador e não deve ser tratado como segredo forte.

Operações inferidas:
- `GET op=list&competencia=...&token=...`
- `GET op=options&token=...`
- `POST { op: "add", token, row }`
- `POST { op: "update", token, row }`
- `POST { op: "delete", token, id }`
- `POST { op: "closeMonth", token, competencia }`

Formato esperado para respostas:
- `list`: `{ ok: true, rows: [...] }`; em erro, `{ ok: false, error: "..." }`.
- `options`: `{ ok: true, licitacoes: [...], fornecedores: [...] }`; em erro, `{ ok: false, error: "..." }`.
- `add`, `update`, `delete`: o frontend atual valida apenas HTTP OK e depois chama `refresh()`.
- `closeMonth`: o frontend atual valida HTTP OK, lê JSON, ignora campos retornados e depois chama `refresh()`.

Formato observado em teste real:
- Erros lógicos retornam HTTP 200 com JSON `{ ok: false, error: "..." }`.
- `list` com competência `2099-01` retornou HTTP 200 e `{ ok: true, rows: [] }`.
- `options` retornou HTTP 200 e `{ ok: false, error: "op inválida" }`; operação ainda não está implementada ou usa outro nome no backend.
- `add` retornou HTTP 200 e `{ ok: false, error: "Error: Cabeçalho da aba \"Lancamentos\" diferente do esperado. Ajuste a linha 1 para: id | competencia | data | licitacao | status | tipo | categoria | fornecedor | descricao | valor | comprovante_url | created_at | updated_at" }`.
- `update` com ID inexistente retornou HTTP 200 e `{ ok: false, error: "Error: Nada para atualizar" }`.
- `delete` com ID inexistente retornou HTTP 200 e `{ ok: true }`.
- `closeMonth` para competência `2099-01` retornou HTTP 200 e `{ ok: true, competencia, total_receitas, total_despesas, saldo, fechado_em }`.

Contrato de `row` usado pelo frontend:
- `id`: string, obrigatório para edição/exclusão e para renderizar ações.
- `competencia`: string no formato `YYYY-MM`.
- `data`: string no formato `YYYY-MM-DD`, obrigatória.
- `tipo`: `receita` ou `despesa`, obrigatório.
- `licitacao`: string, obrigatória.
- `status`: `em_andamento`, `ganho` ou `perdido`, obrigatório.
- `categoria`: string, obrigatória.
- `fornecedor`: string, opcional.
- `descricao`: string, opcional.
- `valor`: number, obrigatório; valor `0` é permitido por decisão do projeto.
- `comprovante_url`: string, opcional.

Contrato de `options`:
- `licitacoes`: lista de objetos com pelo menos `nome`.
- `fornecedores`: lista de objetos com pelo menos `nome`.
- O campo `id` pode existir, mas o frontend usa `nome` como valor do select.

Regras confirmadas:
- `closeMonth` deve travar a competência.
- Deve existir regra impedindo excluir lançamentos de mês fechado.
- Não é necessário saber o schema real da planilha por enquanto, pois o backend está fora deste repositório.
- O teste real confirmou o envelope geral de resposta, mas não validou fluxo completo de CRUD porque `add` está bloqueado por divergência de cabeçalho na aba `Lancamentos`.

Schema de cabeçalho esperado pelo backend para aba `Lancamentos`:
- `id | competencia | data | licitacao | status | tipo | categoria | fornecedor | descricao | valor | comprovante_url | created_at | updated_at`

Riscos:
- Token público no navegador.
- Contrato e implementação da API não versionados neste repositório.
- Sem documentação de permissões do Apps Script e da planilha.
- Frontend atual não valida `json.ok` em `add`, `update`, `delete` e `closeMonth`.
- Fechamento e exclusão em competência fechada dependem de regra obrigatória no backend.
- `options` esperado pelo frontend ainda não responde com sucesso no backend testado.
- `delete` retorna sucesso mesmo para ID inexistente, o que pode ocultar erro operacional.

## Google Fonts
Fontes carregadas:
- `Playfair Display`
- `Inter`

## Links Externos
- Instagram: `https://instagram.com/fisamtour`
- WhatsApp: `https://wa.me/5511910218890`

## Domínio
- `CNAME`: `ponto.fisamtour.com`
