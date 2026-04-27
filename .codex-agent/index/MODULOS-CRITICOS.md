# Módulos Críticos

## Frontend
- `index.html`: define os elementos acoplados aos seletores de `app.js`.
- `styles.css`: controla usabilidade e responsividade.
- `app.js`: arquivo crítico único do comportamento da aplicação.

## Áreas Críticas em `app.js`
- `CONFIG`: contém endpoint externo e token.
- `parseMoney`: normaliza valor informado pelo usuário.
- `computeSummary`: calcula receitas, despesas e saldo.
- `renderTable`: renderiza dados, ações e link de comprovante.
- `fetchRows`: consulta lançamentos por competência.
- `saveRow`: cria e atualiza lançamentos.
- `deleteRow`: exclui lançamentos.
- `closeMonth`: dispara fechamento mensal.
- `fetchOptions`: carrega licitações e fornecedores.
- `exportCSV`: gera arquivo CSV local.

## Contratos Implícitos
- `json.ok` precisa indicar sucesso da API.
- `json.rows` precisa conter lançamentos.
- `json.licitacoes` e `json.fornecedores` precisam conter itens com `nome`.
- IDs de elementos HTML precisam permanecer estáveis.
