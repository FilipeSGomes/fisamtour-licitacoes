# 01 — Inventário técnico

Auditoria de discovery do Ponto FISAM Tour. Fonte da verdade: o repositório em `/home/fisam/Documentos/workspace/CLIENTES/fisamtour-licitacoes`. O site https://ponto.fisamtour.com/ é só referência de publicação (GitHub Pages, `CNAME`). Nenhum código de aplicação, schema, dependência ou dado foi alterado nesta etapa.

O repositório **é** o aplicativo. Não está vazio.

## 1. Stack atual

Dois runtimes convivem. O que o browser chama hoje é o Google Apps Script. O Node/Postgres existe no repositório e ainda não está ligado ao frontend.

| Camada | O que o código usa | Evidência |
|---|---|---|
| Frontend | HTML estático, CSS e JavaScript de browser, sem bundler, sem framework, sem `package.json` na raiz | `index.html`, `licitacoes.html`, `licitacao.html`, `fatura.html`, `passageiros.html`, `tunas.html`, `styles.css`, `app.js`, `js/api.js` |
| API em uso | Google Apps Script Web App (`doGet` / `doPost`), planilha como banco | `js/api.js` (`API_URL` aponta para `script.google.com`), `appScript/codigo.gs` |
| API alternativa, não ligada | Node.js + Express 4 + driver `pg`, pensada para Vercel serverless | `backend/package.json`, `backend/api/index.js`, `backend/vercel.json`, `backend/local-server.js` |
| Banco pretendido pelo backend Node | PostgreSQL (comentários e `.env.example` citam Supabase como hospedagem) | `backend/migrations/schema.sql`, `backend/.env.example` |
| Planilha de origem | Google Sheets + espelho local `LICITACÕES.xlsx` e CSVs | `appScript/codigo.gs`, `appScript/csv/`, `scripts/generate_csvs.py` |
| Publicação do site | GitHub Pages no host `ponto.fisamtour.com` | `CNAME` |
| Testes | Um script `curl` contra a URL do Apps Script. Sem suíte, sem CI | `scripts/test_api.sh`; não há `.github/` |

Versões resolvidas em `backend/package-lock.json` (lockfileVersion 3): Express 4.22.2, `pg` 8.22.0, `cors` 2.8.6, `csv-parse` 5.6.0, `dotenv` 16.6.1 (dev). `backend/package.json` não fixa `engines`. Não há TypeScript. `scripts/generate_csvs.py` depende de `openpyxl`, sem `requirements.txt`.

## 2. Estrutura de pastas

```
index.html, licitacoes.html, licitacao.html, fatura.html, passageiros.html, tunas.html
app.js, styles.css, logo.png, CNAME
js/api.js, js/licitacao.js, js/licitacoes.js, js/fatura.js, js/passageiros.js, js/tunas.js
appScript/codigo.gs, appScript/README.md, appScript/csv/*.csv, appScript/Untitled
backend/api/index.js, backend/lib/*.js, backend/migrations/schema.sql
backend/scripts/migrate-csv.js, backend/local-server.js, backend/vercel.json
scripts/generate_csvs.py, scripts/test_api.sh
LICITACÕES.xlsx
.fisam-ai/          # governança de agentes; não é o produto
```

`images/` está vazia. `appScript/Untitled` é uma cópia do catálogo de licitações (7 linhas), sem função no runtime. Não há README na raiz. A documentação de produto está em `backend/README.md` e `appScript/README.md`.

`.fisam-ai/` descreve orquestração interna. ` .fisam-ai/config/runtime.env` tem `github_project_number` e `github_repo` vazios. Esta auditoria não usa essa pasta como especificação.

## 3. Rotas, telas e funções reais

Não há roteador. Cada tela é um arquivo HTML. A “API” é um único endpoint com o parâmetro `op`.

| Tela | Arquivo | Função observada no código |
|---|---|---|
| Dashboard | `index.html` + `app.js` | Competência (`input month`), busca textual, filtro de status, cards Receitas / Despesas / Saldo, tabela de lançamentos, exportar CSV no browser, fechar mês, modal de ordem de serviço ou lançamento avulso, modal de fornecedor |
| Licitações | `licitacoes.html` + `js/licitacoes.js` | Lista com receitas, despesas e lucro; criar/editar licitação; editor de tarifas; atalho para detalhe; escolha de competência e ida para a fatura |
| Detalhe operacional | `licitacao.html?id=` + `js/licitacao.js` | Grade e formulário conforme o `tipo` da licitação (passagens, hospedagem ou veículo); filtro pago; checkbox pago; incluir, editar, excluir e salvar linhas |
| Fatura | `fatura.html?licitacao_id=&competencia=` + `js/fatura.js` | Lista OS elegíveis, Add/Remove manual, totais, impressão (`window.print`), confirmar faturamento |
| Passageiros | `passageiros.html` + `js/passageiros.js` | Busca por nome ou CPF e listagem. Sem botão de incluir, editar ou excluir |
| TUNAS | `tunas.html` + `js/tunas.js` | Calculadora local de desconto 40,01%. Não chama a API e não grava |

Navegação comum no header: Dashboard, Licitações, Passageiros, TUNAS. A fatura encurta o menu para Dashboard e Licitações.

Tipo `calculadora` em `js/licitacoes.js` (`detailHref`) abre `tunas.html` em vez de `licitacao.html`.

### Operações da API

Contrato idêntico em `appScript/codigo.gs` (`doGet`/`doPost`) e `backend/api/index.js`. O cliente está em `js/api.js`.

GET: `list`, `options`, `licitacoes`, `registros`, `passageiros`, `tarifas`, `ordens`, `fatura`, `faturaPreview`.

POST: `add`, `update`, `delete`, `closeMonth`, `saveRegistros`, `syncLancamentos`, `saveOrdem`, `deleteOrdem`, `saveLicitacao`, `saveFornecedor`, `saveTarifa`, `updateRegistroPago`, `deleteRegistro`, `faturarOrdens`.

`GET /health` existe só no Express (`backend/api/index.js`) e não exige token.

`faturaPreview` está implementado nos dois backends e **não** é chamado por `js/fatura.js`. Os totais da fatura são calculados no browser.

Não existe operação de criar, alterar ou apagar passageiro. Não existe leitura de `fechamentos`.

## 4. Autenticação e autorização

Não há usuários, papéis, sessão, senha nem OAuth.

Os dois backends comparam um token compartilhado:

- Apps Script: constante `API_TOKEN` em `appScript/codigo.gs`, função `authOrThrow`.
- Express: `process.env.API_TOKEN` em `backend/api/index.js`.
- O browser envia o token em toda chamada, na query string (GET) e no JSON (POST), a partir de `FisamAPI.CONFIG` em `js/api.js`.

Quem possui o token executa qualquer `op`, inclusive exclusão e fechamento. Não há autorização por tela.

O valor do token está commitado em `js/api.js`, `appScript/codigo.gs` e `scripts/test_api.sh`. `backend/README.md` registra que esse segredo já vazou no histórico. Esta auditoria não repete o valor. `backend/.env.example` pede um token novo e não contém segredo real.

CORS do Express usa `ALLOWED_ORIGINS` (`backend/api/index.js`, padrão `https://ponto.fisamtour.com`). O Apps Script, segundo `appScript/README.md`, é implantado com acesso “Qualquer pessoa”. O token no JavaScript público anula essa diferença: o segredo está no cliente.

## 5. Persistência

### Em operação no frontend

`js/api.js` ainda aponta para o Apps Script. A planilha é o banco vivo dessa URL.

Identificador da planilha em `appScript/codigo.gs` (`SPREADSHEET_ID`), mascarado: `113JL455…A0Sw`. A URL completa está em `appScript/README.md`. Dez abas, nomes literais no script:

| Aba | Papel |
|---|---|
| `Catalogo_Licitacoes` | Licitações |
| `Catalogo_Fornecedores` | Fornecedores |
| `Catalogo_Tarifas` | Tarifas por licitação |
| `Ordens_Servico` | Cabeçalho de OS |
| `Lancamentos` | Linhas do dashboard |
| `Fechamentos` | Snapshot do fechamento mensal |
| `reg_passagens` | Detalhe de passagens |
| `reg_hospedagem` | Detalhe de hospedagem |
| `reg_veiculo` | Detalhe de veículo |
| `passageiros` | Cadastro de pessoas |

Cabeçalhos esperados: objeto `HEADERS` em `appScript/codigo.gs`. `setupPlanilha` só valida cabeçalho; não há fórmula gravada pelo script. O script lê e grava valores.

Concorrência no Apps Script: `withLock_` usa `LockService.getScriptLock()` (trava global do script, timeout 30s), não uma transação da planilha. `backend/README.md` descreve o problema: fechar mês e faturar liam tudo, recalculavam e regravavam em várias chamadas.

### Espelho já escrito, desligado do site

`backend/migrations/schema.sql` cria as mesmas dez tabelas, com `id text`, datas em `text`, e FKs apenas de `tarifas`, `ordens_servico` e `reg_*` para `licitacoes`. `backend/scripts/migrate-csv.js` importaria `appScript/csv/`. `backend/README.md` manda trocar `API_URL` depois do deploy. Essa troca **não** está feita em `js/api.js`.

Não há `.env` versionado. Só `backend/.env.example`. Não foi aberto nenhum `.env` local.

### Snapshot CSV no repositório (não é o estado ao vivo da planilha)

Contagens de `appScript/csv/`, geradas por `scripts/generate_csvs.py` a partir de `LICITACÕES.xlsx`:

| Arquivo | Linhas de dados |
|---|---|
| `Catalogo_Licitacoes.csv` | 7 |
| `Catalogo_Fornecedores.csv` | 1 (`Operadora`) |
| `Catalogo_Tarifas.csv` | 5 |
| `Ordens_Servico.csv` | 0 |
| `Fechamentos.csv` | 0 |
| `Lancamentos.csv` | 307 (179 receita, 128 despesa; origem só `reg_*`) |
| `passageiros.csv` | 359 |
| `reg_passagens.csv` | 57 |
| `reg_hospedagem.csv` | 59 |
| `reg_veiculo.csv` | 80 |

Catálogo gravado no CSV e também na lista `LICITACOES` de `scripts/generate_csvs.py`:

| id | nome | tipo |
|---|---|---|
| `4-rcc-rs` | 4º RCC - RS | passagens (aba do xlsx vazia, 0 registros) |
| `6-rcc-rs` | 6º RCC - RS | passagens (9) |
| `13-rcm-sp` | 13º RCM - SP | passagens (22) |
| `cais-lins-sp` | CAIS LINS - SP | passagens (26) |
| `tj-vitoria-es` | TJ VITORIA - ES | hospedagem (59) |
| `coren-ma` | COREN - MA | veiculo (80) |
| `tunas-pr` | TUNAS - PR | calculadora (sem tabela `reg_*`) |

Tarifas do CSV: COREN carro 481,76 / custo 143; COREN pedestre 32,12 / custo 11; TJ diária 369,87; TJ alimentação 189,98; TUNAS “Valor livre” editável. `editavel=false` no CSV corresponde a tarifa travada no formulário de OS (`app.js`, `isEditavel`).

## 6. Google Sheets e Apps Script — mapa

Arquivos que acoplam o produto à planilha:

- `appScript/codigo.gs` — API inteira, ID da planilha, token, cabeçalhos, sync.
- `appScript/README.md` — procedimento de importar CSV, implantar o script e testar.
- `js/api.js` — URL de produção do Web App (deployment mascarado: `https://script.google.com/macros/s/AKfycbw…/exec`).
- `scripts/test_api.sh` — mesma URL e o mesmo token como padrão.
- `scripts/generate_csvs.py` + `LICITACÕES.xlsx` — geram o CSV que o README trata como carga inicial.
- `appScript/csv/*` — carga. `backend/scripts/migrate-csv.js` e `backend/README.md` ainda chamam esse CSV de “fonte de verdade atual”.
- `backend/lib/sync.js` — porta do `syncAllLancamentos_` da planilha (apaga lançamentos não manuais e recria).

Não há fórmula de célula escrita pelo Apps Script. As fórmulas estão no xlsx (seção de regras de negócio). Abas do xlsx: `4º RCC - RS` (vazia), `6º RCC - RS`, `13º RCM - SP`, `CAIS LINS - SP`, `TJ VITORIA - ES`, `COREN -MA`, `TUNAS - PR` (1012 linhas), `Página8` (nome, data de nascimento, CPF).

`generate_csvs.py` descarta linha cujo texto contém `TOTAL` ou cujo primeiro campo é nome de mês. Isso é higiene de importação, não uma regra de runtime.

## 7. Integrações externas

- Google Apps Script / Google Sheets: persistência usada pelo frontend.
- GitHub Pages: site estático (`CNAME`).
- Vercel: só descrita em `backend/README.md` e `backend/vercel.json`. Nenhum projeto Vercel está versionado (`.vercel/` está no `backend/.gitignore`).
- Supabase: só descrita como lugar para colar `DATABASE_URL`. Nada provisionado neste repositório.
- Instagram e WhatsApp: links de rodapé em `js/api.js` (`instagram.com/fisamtour`, `wa.me/5511910218890`).
- Google Fonts: Playfair Display e Inter nos HTML.

Não há SDK Google no Node, nem webhook, nem fila, nem e-mail.

## 8. Git e GitHub Project

- É um repositório git. Remote `origin`: `https://github.com/FilipeSGomes/fisamtour-licitacoes.git`.
- Repositório **público** (`isPrivate: false` na API do GitHub).
- Branch de trabalho: `develop`, alinhada a `origin/develop` (`ebd995b`).
- Branch padrão no GitHub: `master`. `origin/master` é o merge do PR #1 (`80aa86b`) em cima de `develop`. O `master` local (`bdec9c1`) está atrás de `origin/master`.
- Working tree limpa em relação a `origin/develop`, com um arquivo não rastreado: `Ata+de+Ristro+de+Preco+8-2026.pdf`. Não foi aberto e não entra como especificação.
- `gh` autenticado na conta `FilipeSGomes`, com escopo `project`.
- `repository.projectsV2` deste repositório veio vazio. Nenhum GitHub Project está ligado a `fisamtour-licitacoes`. Existem outros projects na conta do usuário; nenhum tem este repositório no vínculo consultado. Nenhum project foi criado nesta auditoria.

Não há workflow de GitHub Actions. Não há `.gitignore` na raiz: o xlsx, os CSVs e `.fisam-ai/` estão versionados. `backend/.gitignore` ignora `node_modules/`, `.env` e `.vercel/`.
