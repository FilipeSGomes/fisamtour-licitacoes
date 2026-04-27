# Inventário de Dados

Data: 2026-04-26
Origem: `index.html`, `app.js`, `.codex-agent/index/` e memórias existentes.
Modo: leitura de runtime; escrita permitida apenas na memória `.codex-agent/`.

## Entidade: lançamento

Entidade principal do sistema, usada para registrar movimentos financeiros relacionados a licitações em uma competência mensal.

## Campos Observados

| Campo | Tipo/formato observado | Obrigatoriedade no frontend | Fonte/uso |
| --- | --- | --- | --- |
| `id` | string | obrigatório para editar/excluir/renderizar ações | API/backend |
| `competencia` | `YYYY-MM` | sempre enviada no submit | filtro mensal, listagem e fechamento |
| `data` | `YYYY-MM-DD` | obrigatória | formulário, tabela e payload |
| `licitacao` | string | obrigatória | select carregado por `options`, busca e tabela |
| `status` | enum | obrigatória | filtro, formulário e payload |
| `tipo` | enum | obrigatória | formulário, badge e cálculo de resumo |
| `categoria` | string | obrigatória | formulário, busca, tabela e payload |
| `fornecedor` | string | opcional | select carregado por `options`, busca e tabela |
| `descricao` | string | opcional | busca, tabela e payload |
| `valor` | number | obrigatória | cálculo de receitas, despesas e saldo |
| `comprovante_url` | string URL livre | opcional | link na tabela e payload |
| `created_at` | não observado no frontend | backend | cabeçalho esperado na aba `Lancamentos` |
| `updated_at` | não observado no frontend | backend | cabeçalho esperado na aba `Lancamentos` |

## Valores Enumerados Observados

### `tipo`
- `receita`
- `despesa`

### `status`
- `em_andamento`
- `ganho`
- `perdido`

## Validações Observadas no Frontend

- `data`, `tipo`, `licitacao`, `categoria` e `valor` são validados no submit.
- `fornecedor`, `descricao` e `comprovante_url` podem ficar vazios.
- `valor` passa por `parseMoney`, que aceita formatos como `1.234,56` e `1234.56`.
- Valor financeiro `0` é aceito pela validação atual.
- `competencia` vem do campo de mês selecionado; se vazio, usa o mês atual calculado pelo navegador.
- O frontend não valida se `data` pertence à `competencia`.
- O frontend não valida domínio, protocolo ou formato de `comprovante_url`.

## Regras Observadas

- A listagem busca lançamentos por `competencia` via `op=list`.
- O filtro de status compara `row.status` com o valor selecionado, exceto quando o filtro está em `all`.
- A busca textual procura em `licitacao`, `tipo`, `categoria`, `fornecedor` e `descricao`.
- O resumo soma `valor` em receitas quando `tipo === "receita"`; qualquer outro tipo cai como despesa no cálculo atual.
- O saldo exibido é `receitas - despesas`.
- `closeMonth` recebe somente `competencia` e deve travar a competência, conforme decisão já registrada.
- Deve existir regra impedindo exclusão em mês fechado, conforme decisão já registrada.

## Hipóteses

- `competencia` é o recorte contábil/operacional do lançamento, não necessariamente derivado da `data`.
- `categoria` é uma classificação livre até que exista taxonomia oficial.
- `licitacao` e `fornecedor` devem vir da operação `options`, mas o backend testado ainda não implementa ou não reconhece essa operação.
- `created_at` e `updated_at` são gerados no backend.

## Dúvidas Pendentes

- A `data` do lançamento precisa estar dentro da `competencia`?
- Lançamentos com status `perdido` devem entrar nos totais financeiros?
- Existem categorias obrigatórias ou proibidas por tipo/status?
- `fornecedor` deve ser obrigatório para despesas?
- `comprovante_url` deve ser obrigatório para algum tipo, categoria ou valor mínimo?
- `closeMonth` pode ser repetido sem efeito colateral?
- Existe regra oficial para editar lançamento depois de fechado, ou só exclusão deve ser bloqueada?

## Bloqueios

- O backend real e a planilha não estão versionados neste repositório.
- O cabeçalho real da aba `Lancamentos` precisa ser alinhado ao schema esperado pelo backend antes de validar CRUD completo.
- A operação `options` precisa ser implementada ou alinhada com o frontend.
- Regras fiscais, financeiras, jurídicas e de licitação dependem de confirmação humana.
