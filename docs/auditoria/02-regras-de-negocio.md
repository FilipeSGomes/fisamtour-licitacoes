# 02 — Regras de negócio observadas no código

As regras abaixo estão no aplicativo (`app.js`, `js/*`, `appScript/codigo.gs`, `backend/lib/*`) ou, quando indicado, só na planilha (`LICITACÕES.xlsx` / `scripts/generate_csvs.py`). Onde os dois backends divergem, os dois comportamentos estão registrados. O frontend de produção segue o Apps Script (`js/api.js`).

Hipótese inicial de entidades (users, roles, permissions, customers, organizations, contracts, contract_amendments, service_order_passengers, payments, receivables, documents, audit_logs): **não há tabela, tela, rota nem campo que as implemente.** Foram rejeitadas como modelo atual. O que existe está na seção 1.

## 1. Entidades reais

| Entidade no código | Papel | Onde |
|---|---|---|
| `licitacoes` | Unidade operacional nomeada (órgão/ata), com um único `tipo` | Aba `Catalogo_Licitacoes`; tabela em `backend/migrations/schema.sql` |
| `fornecedores` | Catálogo de nomes | `Catalogo_Fornecedores` |
| `tarifas` | Preço de tabela de uma licitação (`valor`, `custo`, `editavel`) | `Catalogo_Tarifas` |
| `ordens_servico` | OS criada pelo dashboard | `Ordens_Servico` |
| `lancamentos` | Linha do dashboard, manual ou gerada | `Lancamentos` |
| `fechamentos` | Totais gravados ao fechar a competência. Sem tela de consulta | `Fechamentos` |
| `passageiros` | Pessoas com nome, data de nascimento e CPF. Somente leitura na UI | `passageiros` |
| `reg_passagens` | Linhas operacionais quando `licitacoes.tipo = passagens` | `reg_passagens` |
| `reg_hospedagem` | Linhas quando `tipo = hospedagem` | `reg_hospedagem` |
| `reg_veiculo` | Linhas quando `tipo = veiculo` | `reg_veiculo` |

`tarifas` é o catálogo de serviço cobrável. Não existe entidade `services` separada.

Uma licitação tem um tipo só. O tipo escolhe a aba/tabela de detalhe (`REG_SHEET_BY_TIPO` em `appScript/codigo.gs`, `REG_TABLE_BY_TIPO` em `backend/lib/catalogo.js`):

- `passagens` → `reg_passagens`
- `hospedagem` → `reg_hospedagem`
- `veiculo` → `reg_veiculo`
- `calculadora` → nenhuma tabela; a UI manda para `tunas.html`

### Campos e obrigatoriedade

Validação de servidor para lançamento manual (`assertRow_` / `assertRow`): `competencia`, `data`, `licitacao`, `tipo`, `categoria`, `valor`. Fornecedor, descrição, comprovante e custo aceitam vazio. Status default `em_andamento`.

Licitação (`saveLicitacao`): `nome` e `tipo` obrigatórios. `id` opcional; se vazio, é o slug do nome. Status default `ativo`.

Fornecedor: `nome` obrigatório. Status default `ativo`.

Tarifa: `licitacao_id` e `nome` obrigatórios. `codigo` cai para o `id` se vazio. `valor` e `custo` viram 0 se vazios. `editavel` default `sim`, salvo negações (`nao`, `não`, `n`, `0`, `false`, `no`).

OS (`saveOrdem`): não há lista de campos obrigatórios no servidor além do que o formulário HTML marca (`data`, licitação, valor). `competencia` vem da tela ou dos 7 primeiros caracteres da data (`YYYY-MM`). `lucro` é recalculado no servidor. `pago` é normalizado. `status_os` default `pendente` só quando o cliente não envia; o formulário envia `aberta` ou `concluida`.

Registros: o servidor não exige colaborador, CPF nem valor. Exige licitação existente e tipo com tabela. `saveRegistros` **apaga todas as linhas daquela licitação e reinsere** o array enviado (`saveRegistros_` e `backend/lib/registros.js`).

Passageiro na listagem: ignora status diferente de `ativo` e nome vazio. Busca com termo devolve no máximo 50; sem termo, 100 (`listPassageiros_`).

### Relacionamentos que o código sustenta

- Licitação 1 — N tarifas (`tarifas.licitacao_id`).
- Licitação 1 — N OS (`ordens_servico.licitacao_id`). A OS também guarda `licitacao_nome` (texto duplicado).
- Licitação 1 — N registros de **um** tipo. Sem mistura de passagens e hospedagem na mesma licitação.
- Tarifa na OS é `tarifa_codigo` + `tarifa_nome` (texto). Não há FK para `tarifas.id`.
- Fornecedor na OS e no lançamento é o **nome** escolhido no `<select>` (`app.js` grava `f_fornecedor.value`). Não há FK para `fornecedores.id`.
- Passageiro não é FK. No detalhe de passagens, um `<datalist>` sugere nomes (`js/licitacao.js`). CPF e data nascem como texto livre na linha. O datalist não preenche CPF nem data.
- Lançamento aponta a origem por texto: `origem` + `origem_id`. Valores usados pelo sync: `manual`, `ordem_servico`, `reg_passagens`, `reg_hospedagem`, `reg_veiculo`. Sem FK.
- Lançamento guarda `licitacao` como **nome**, não como id. O dashboard reencontra a licitação comparando nome (`app.js`, `openModal`).
- Fechamento: uma linha por `competencia` (chave primária no schema Node; no Apps Script, apaga as linhas da competência e acrescenta outra). O fechamento é global, não por licitação.

Cardinalidade que **não** está no código: OS ↔ passageiro, contrato ↔ aditivo, cliente ↔ organização, pagamento ↔ título, documento ↔ entidade (só existe `comprovante_url` texto).

## 2. Vocabulário de estado (há colisão)

| Campo | Valores que o código reconhece | Onde nasce |
|---|---|---|
| `licitacoes.status` | `ativo` (entra em `options`), `inativo` (soma de admin só com `include_inativas=1`) | `licitacoes.html` |
| `fornecedores.status`, `tarifas.status`, `passageiros.status`, `reg_*.status` | `ativo` / `inativo`. Exclusão de registro faz `status = inativo` (soft delete). Listagens pulam `inativo` | `deleteRegistro` |
| `lancamentos.status` | UI: `em_andamento`, `ganho`, `perdido`. O sync **sempre** grava `em_andamento` nas linhas geradas | `index.html`; `buildLancamentosFromOrdem_` / `lancPair_` |
| `ordens_servico.status_os` | Form: `aberta`, `concluida`. Default de servidor: `pendente`. Faturar grava `faturada`. Elegibilidade e listagem também tratam `cancelada` e `inativo`. O `<select>` não oferece `pendente`, `faturada` nem `cancelada` | `index.html`, `saveOrdem`, `faturarOrdens`, `getFaturaElegiveis` |
| `pago` | `sim` ou `nao`. Aceita na entrada `sim/s/1/true/yes` (e `x` só no `isPago` do browser) | `normalizePago` |
| `faturado_em` | Vazio = não faturada. Preenchido com ISO ao confirmar fatura | `faturarOrdens` |
| `editavel` | `sim` / `nao` | tarifa |
| `enviado_faturamento`, `prev_pgto` | Texto livre em hospedagem e veículo. Nenhuma transição é executada | colunas de `reg_*` |

Efeito prático: o filtro “Ganho/Perdido” do dashboard quase não afeta linha gerada, porque o sync fixa `em_andamento`. “Fechar mês” não muda status de lançamento nem impede edição posterior. Não há leitura da aba `Fechamentos` em nenhuma tela.

Ao editar uma OS cujo `status_os` é `faturada`, o `<select>` não tem essa opção. O submit reenvia o valor visível do select (`aberta` se nada for escolhido) em `app.js`. No Express, o `UPDATE` de `saveOrdem` não mexe em `faturado_em`, mas **grava** `status_os`. No Apps Script, `saveOrdem_` regrava todas as colunas de `HEADERS.ordens`, e o cliente não manda `faturado_em` — a célula pode ir vazia. Os dois backends não se comportam igual na edição de OS já faturada.

`app.js` envia `pago: "nao"` em todo `saveOrdem`, inclusive edição. Marcar pago na OS pela tela de dashboard não persiste.

## 3. Dinheiro — o que cada palavra significa aqui

Não há entidades separadas de previsto, realizado, contas a receber ou contas a pagar. Os números do produto são estes:

| Termo na tela | Definição no código | Não confundir com |
|---|---|---|
| Valor | Quantia da receita na linha de OS, passagem ou veículo | Custo |
| Vlr total | Receita da linha de hospedagem (`vlr_total`) | Soma de custo |
| Custo | Quanto a operação custa. Em hospedagem o sync usa `custo_tt`, senão `custo_hospedagem`, senão `custo_refeicao` | Valor cobrado |
| Receita (card) | Soma de `valor` onde `lancamentos.tipo = receita`. Na tela de licitação, soma de `valor` ou `vlr_total` dos registros ativos, **sem** as OS | “Tudo que entrou no caixa” |
| Despesa (card) | Soma de `valor` onde `tipo = despesa`. Na linha gerada, esse `valor` **é o custo** | Uma conta a pagar com vencimento |
| Lucro | `valor - custo` na OS e em passagem/veículo. Em hospedagem, na UI: `vlr_total - (custo_tt ou custo_hospedagem)`. No card da licitação: receitas − despesas dos registros | Saldo de caixa |
| Saldo do dashboard | Receitas − despesas **das linhas visíveis depois do filtro** (`computeSummary` em `app.js`) | Lucro da tela de licitações, e também o saldo gravado no fechamento |
| Saldo do fechamento | Receitas − despesas de **todos** os lançamentos da competência, sem filtro de busca (`closeMonth`) | O card, se houver busca ou status filtrado |
| Pago | Flag `sim`/`nao` na linha operacional e na OS. A fatura só mostra o badge. Não há data, valor parcial nem baixa | Faturado |
| Faturado | OS com `faturado_em` e `status_os = faturada`. Ato manual na tela de fatura, sobre um subconjunto escolhido | Pago ao fornecedor |
| Pendência | Não é um cálculo. O default `status_os = pendente` e o filtro “Não pagos” são coisas diferentes | Saldo em aberto |
| Previsto | Só nos nomes `prev_vlr_refeicao` e `prev_pgto`, copiados da planilha. O aplicativo não calcula um orçado versus um realizado | Receita |

### Como uma OS ou um registro vira lançamento

`lancPair_` / `lancPair` (`appScript/codigo.gs`, `backend/lib/sync.js`):

- Se o valor (receita) for diferente de zero, nasce um lançamento `tipo = receita` com esse valor.
- Se o custo for diferente de zero, nasce outro lançamento `tipo = despesa`, descrição prefixada com `Custo: `, e o `valor` desse lançamento é o custo.
- Data que define a competência: passagem usa `data_ida` ou `data_solicitacao`; hospedagem usa `check_in` ou `dt_solicitacao`; veículo usa `data` ou `data_solicitacao`; OS usa `competencia` da própria OS ou a data.
- Sem data aproveitável, o par não é gerado.

`syncAllLancamentos` apaga todo lançamento com `origem <> manual` e recria o restante com **ids novos** (`lc-` + timestamp). Lançamento manual sobrevive. Edição feita direto num lançamento gerado se perde no próximo sync.

Quem entra no sync:

- Registros com `status` diferente de `inativo`, de todas as licitações.
- OS com `status_os` fora de `inativo` e `cancelada`.

O comentário em `backend/lib/sync.js` diz que só OS faturadas entram. O código **não** filtra `faturado_em`. Salvar uma OS já gera receita e despesa no dashboard, antes da fatura. `faturarOrdens` chama o mesmo sync de novo; faturar não é o que faz o valor aparecer.

O dashboard ainda completa buracos no browser (`rowsFromOrdem` em `app.js`): se a OS da competência não tem lançamento com `origem` `ordem_servico`/`ordens_servico` e o mesmo `origem_id`, a tela fabrica linhas locais `os-rec-` / `os-desp-`. `closeMonth` não vê essas linhas locais. Card e fechamento podem divergir.

Totais da tela Licitações vêm só dos registros (`totaisRegistros`). OS não entram nessa soma. O dashboard soma lançamentos (registros + OS + manuais). Os dois números não medem o mesmo conjunto.

Não há deduplicação entre um registro operacional e uma OS do mesmo fato. Os dois caminhos somam.

### Fechamento e fatura

`closeMonth`: soma receita e despesa da competência, grava `total_receitas`, `total_despesas`, `saldo`, `fechado_em`. Pode ser refeito. Não trava a competência.

Fatura (`getFaturaElegiveis` + filtro extra em `js/fatura.js`): OS da competência e da licitação, sem `faturado_em`, status fora de `inativo`, `cancelada` e (na UI) `faturada`. O operador move itens para a coluna da direita. Confirmar chama `faturarOrdens` com os ids selecionados. Imprimir não grava documento. Não existe tabela de fatura emitida; o histórico é o carimbo na OS. `faturaPreview` soma `valor`, `custo` e `lucro` no servidor e a tela não o usa. Na tela, lucro da seleção = soma dos valores − soma dos custos.

Receita avulsa / despesa avulsa (`index.html`, modo diferente de `ordem_servico`): um lançamento `origem = manual`, sem par automático de custo. O campo custo fica oculto nesse modo.

Tarifa no formulário de OS (`applyTarifa`): se `editavel` é falso e há número, valor e custo ficam somente leitura e são preenchidos pela tarifa. Se editável, o operador digita. Lucro do formulário = valor − custo, exibido e também recalculado no servidor.

### Calculadora TUNAS (aplicativo)

`js/tunas.js`: desconto = referência × 0,4001; valor final = referência − desconto; por pessoa = valor final / quantidade (mínimo 1). Nada é salvo. O texto da tela cita a planilha TUNAS.

## 4. Fórmulas que existem na planilha e o aplicativo não executa

Inspeção de fórmulas de `LICITACÕES.xlsx` (padrão da fórmula e célula de parâmetro numérico). Não copiar isto para o sistema novo sem confirmação do proprietário. Várias são células de total ou parâmetro solto, não regra de linha.

Passagens `6º RCC - RS` e `13º RCM - SP`:

- Lucro = valor − custo (`=N-O`). O aplicativo também faz isso.
- `percentil` = lucro / valor (`=P/N`). Coluna existe no schema e no CSV (20 de 57 linhas preenchidas). O formulário de `js/licitacao.js` **não** mostra nem calcula `percentil`.

`CAIS LINS - SP`:

- A coluna valor das linhas repete a célula `N$2`, cujo valor cacheado é 174. Não há tarifa `cais-lins-sp` no catálogo.
- Há uma célula de total no formato valor + 20% (`J+(J*0.2)`). Uma ocorrência, não uma regra de cada linha.
- A aba não tem coluna Pago. `generate_csvs.py` joga a coluna 14 (enviado/valor constante) no campo `pago` do CSV. Uma linha ficou com pago `174.0`. Isso é defeito de mapeamento, não um estado de pagamento.

`TJ VITORIA - ES` (parâmetros na coluna O: O3 = 369,87 e O4 = 189,98, os mesmos números das tarifas TJ):

- Diárias = check-out − check-in; em branco se a diferença é 0.
- Valor da diária = diárias × 369,87.
- Previsto de refeição = refeições × 189,98.
- Valor total = valor da diária + previsto de refeição.
- Parte das linhas calcula refeições = diárias × 2.
- Lucro = valor total − custo total.
- A aba não tem coluna Pago. O gerador grava `pago = nao` em todas.

O detalhe de hospedagem no aplicativo deixa diárias, valores e custos digitados. Só recalcula lucro.

`COREN -MA` (O2 = 32,12 pedestre, O3 = 481,76 carro):

- Valor = 481,76 se a placa é diferente de `-`; senão 32,12.
- Custo está digitado (143 ou 11), alinhado à tarifa.
- Lucro = valor − custo.
- Sem coluna Pago. CSV com `pago = nao` fixo.

No aplicativo, essa escolha carro/pedestre acontece no formulário de **OS** via tarifa. A grade `reg_veiculo` não aplica a placa.

`TUNAS - PR` (aba com 1012 linhas, bem maior que a calculadora):

- `B5 = 0,401` (40,1%). A tela usa 40,01% (`0.4001`). Os dois números não são o mesmo.
- Também aparecem taxa 0,23, fator 0,98664, gross-up `valor / (1 - desconto)` e acréscimo sobre o valor. A página `tunas.html` não implementa isso.
- `VLOOKUP` do nome na `Página8` para trazer data de nascimento e CPF. O aplicativo só sugere o nome.

`Página8` é a lista de pessoas (nome, data de nascimento, CPF). Fórmulas residuais dessa aba são cache do Excel, não regra de negócio.

`generate_csvs.py` grava o lucro de hospedagem como texto cru da célula. No CSV resultante, 29 linhas de `reg_hospedagem.lucro` não são número puro. Outro motivo para não tratar o CSV como banco.

## 5. Relatórios e filtros que existem

Não há módulo de relatório além das próprias telas.

| Superfície | Filtros | O que soma |
|---|---|---|
| Dashboard | Competência, texto (licitação, tipo, categoria, fornecedor, descrição), status do lançamento | Cards sobre as linhas filtradas. Exporta CSV dessas linhas (`exportCSV` em `app.js`) |
| Licitações | Nenhum filtro; inclui inativas | Receita, despesa e lucro dos registros ativos daquele tipo |
| Detalhe | Pago: todos / sim / não | Rodapé da grade filtrada |
| Fatura | Licitação + competência na URL; elegibilidade no servidor; seleção manual | Receitas, despesas e lucro da seleção |
| Passageiros | Texto em nome ou CPF | Contagem da página (teto 50/100) |
| TUNAS | Nenhum | Conta local |

Competência é sempre `YYYY-MM`. O dashboard abre no mês corrente do browser (`monthToday`), não no último mês com dados.

## 6. Fluxos de cadastro e atualização

1. Nova licitação: nome, tipo, status → `saveLicitacao`. Id estável se for edição.
2. Tarifa: modal em Licitações → `saveTarifa` por linha. Não há exclusão na UI (daria para mandar `status = inativo` se o cliente enviasse; a UI não envia).
3. Fornecedor: botão “+” no dashboard → `saveFornecedor`.
4. Nova OS: dashboard → `saveOrdem` → sync de lançamentos.
5. Lançamento avulso: mesmo modal, tipo receita ou despesa → `add` / `update`. Excluir lançamento de OS chama `deleteOrdem`; excluir os outros chama `delete` do lançamento.
6. Detalhe: “Nova linha” altera o array local; “Aplicar” já chama `saveRegistros` com o conjunto inteiro; o botão “Salvar” do header também. Checkbox pago chama `updateRegistroPago` sem passar pelo sync. Excluir chama `deleteRegistro` (inativa e sincroniza).
7. Fatura: selecionar OS → imprimir (sem gravação) ou confirmar → `faturarOrdens`.
8. Fechar mês: confirmação → `closeMonth`. Alerta “Mês fechado!” sem mostrar o snapshot depois.
9. Passageiros: somente busca. Inclusão de pessoa, hoje, só existe na planilha / CSV.
10. TUNAS: cálculo descartável.

`syncLancamentos` é uma `op` pública. Qualquer cliente com o token regenera todos os lançamentos não manuais.

## 7. O que não reproduzir da planilha

- Planilha, CSV ou xlsx como persistência, sincronismo ou carga automática. Decisão do proprietário, e o código mostra por que: sync destrutivo, ids instáveis, mapeamento de `pago` errado em CAIS, lucro de hospedagem não numérico, OS e fechamentos vazios no snapshot.
- Linhas de TOTAL e nomes de mês (`is_total_row` em `scripts/generate_csvs.py`).
- Coluna `percentil` como dado digitado. Se a margem lucro/valor ainda interessar, ela é conta, não campo importado.
- Parâmetros numéricos estacionados em colunas de texto (O2/O3/O4 da TJ e da COREN, `N2 = 174` da CAIS).
- A aba TUNAS inteira. A regra de tela é só o desconto da calculadora.
- `Lancamentos` como segunda cópia gravada do mesmo fato, recriada com id novo a cada sync.
- Travar `pago = nao` ao salvar OS e ao gerar CSV de hospedagem/veículo.
- Tratar `ganho`/`perdido` como ciclo de licitação: no dado gerado todos os 307 lançamentos estão `em_andamento`, e o sync não usa os outros status.
- Token compartilhado dentro do JavaScript.
