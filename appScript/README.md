# Apps Script + CSVs iniciais

Planilha: https://docs.google.com/spreadsheets/d/113JL455cvAy2c95Whyo3AIpMd_jF-x1Ga1psK78A0Sw/edit

## Passo 1 — Importar CSVs (10 abas)

Pasta: [`csv/`](csv/)

| CSV | Nome da aba | Observação |
|-----|-------------|------------|
| `Catalogo_Licitacoes.csv` | `Catalogo_Licitacoes` | Licitações (ativo/inativo) |
| `Catalogo_Fornecedores.csv` | `Catalogo_Fornecedores` | Fornecedores |
| `Catalogo_Tarifas.csv` | `Catalogo_Tarifas` | **Nova** — tarifas por licitação (COREN, TJ VIX, TUNAS) |
| `Ordens_Servico.csv` | `Ordens_Servico` | **Nova** — cabeçalho (OS criadas pelo sistema) |
| `Lancamentos.csv` | `Lancamentos` | Dashboard (coluna `custo` incluída) |
| `Fechamentos.csv` | `Fechamentos` | cabeçalho |
| `reg_passagens.csv` | `reg_passagens` | Detalhe operacional |
| `reg_hospedagem.csv` | `reg_hospedagem` | Detalhe operacional (coluna `pago`) |
| `reg_veiculo.csv` | `reg_veiculo` | Detalhe operacional (coluna `pago`) |
| `passageiros.csv` | `passageiros` | Cadastro |

1. Crie cada aba com o **nome exato** acima.
2. **Arquivo → Importar → Upload** → CSV → **Substituir dados na aba selecionada**.
3. Separador: vírgula. Codificação: UTF-8.

Regenerar CSVs após editar `LICITACÕES.xlsx`:

```bash
python3 scripts/generate_csvs.py
```

### Tarifas iniciais (`Catalogo_Tarifas.csv`)

| licitacao_id | codigo | nome | valor | custo |
|--------------|--------|------|-------|-------|
| `coren-ma` | `carro` | Carro | 481,76 | 143 |
| `coren-ma` | `pedestre` | Pedestre | 32,12 | 11 |
| `tj-vitoria-es` | `diaria` | Hospedagem (diária) | 369,87 | — |
| `tj-vitoria-es` | `refeicao` | Alimentação | 189,98 | — |
| `tunas-pr` | `livre` | Valor livre | — | — (`editavel=true`) |

## Passo 2 — Apps Script

1. Cole [`codigo.gs`](codigo.gs) em **Extensões → Apps Script**.
2. Execute **`setupPlanilha`** (valida cabeçalhos).
3. Execute **`testApi`** — deve logar lançamentos em 2025-07.
4. **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Acesso: **Qualquer pessoa**
5. Atualize `API_URL` em [`js/api.js`](../js/api.js) se a URL mudar.

## Passo 3 — Testar API

```bash
./scripts/test_api.sh
# ou competência específica:
COMPETENCIA=2025-07 ./scripts/test_api.sh
```

## Endpoints

| op | Uso |
|----|-----|
| `list` | Dashboard por competência |
| `options` | Selects do formulário |
| `licitacoes` | Admin em licitacoes.html (`include_inativas=1`) |
| `tarifas&licitacao_id=` | Tarifas da licitação (Nova OS) |
| `ordens&competencia=&licitacao_id=` | Lista ordens de serviço |
| `fatura&competencia=&licitacao_id=` | OS elegíveis para fatura |
| `faturaPreview&ids=` | Preview dos IDs selecionados |
| `registros` | Detalhe em licitacao.html |
| `passageiros` | Busca em passageiros.html |
| POST `saveOrdem` | Criar/editar OS + sync Lancamentos |
| POST `deleteOrdem` | Remove OS |
| POST `saveLicitacao` | CRUD catálogo licitações |
| POST `saveFornecedor` | Adicionar fornecedor |
| POST `saveTarifa` | CRUD tarifas |
| POST `updateRegistroPago` | Checkbox pago em reg_* |
| POST `deleteRegistro` | Excluir linha operacional |
| POST `faturarOrdens` | Marca OS como faturada (`ids: [...]`) |
| POST `saveRegistros` | Salva detalhe + sync Lancamentos |
| POST `syncLancamentos` | Regenera dashboard a partir de reg_* + OS |

Competências com dados: **2025-06** a **2026-05** (mais dados em **2025-07** e **2026-05**).

## Frontend

| Página | Função |
|--------|--------|
| `index.html` | Dashboard + Nova ordem de serviço |
| `licitacoes.html` | CRUD admin, tarifas, link fatura |
| `licitacao.html?id=6-rcc-rs` | Detalhe operacional + checkbox Pago |
| `fatura.html?licitacao_id=&competencia=` | Montagem manual Add/Remove + impressão |
| `passageiros.html` | Cadastro (Página8) |
| `tunas.html` | Calculadora desconto 40,01% |
