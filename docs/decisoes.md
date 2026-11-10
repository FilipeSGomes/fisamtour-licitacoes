# Decisões da fundação

Fonte: `docs/auditoria/03-recomendacao-arquitetura.md`, seção 8, mais as decisões fechadas para esta fundação. O que foi descartado fica registrado para não voltar como default implícito.

## 1. Fonte única do financeiro

Dashboard e o relatório de licitações somam somente `lancamentos`. Passagem, hospedagem, veículo e ordem de serviço guardam valor (receita) e custo (despesa), mas esses campos não entram de novo na soma junto com o razão.

Lucro = receita − despesa. Receita é o valor cobrado. Despesa é o custo. Na linha de despesa gerada, o valor do lançamento é o custo.

Pago, faturado e fechamento de mês são atos distintos:

- pago marca a linha operacional ou a OS, sem reescrever o razão;
- faturar só carimba a OS (`status_os = faturada`, `faturado_em`) e não gera lançamento novo;
- fechar a competência grava o snapshot e bloqueia alteração do razão daquele mês.

A impressão da fatura soma as OS que o operador selecionou naquela montagem. Esse total é o documento que está sendo emitido, não o card do dashboard.

Descartado: somar registros operacionais e o razão no mesmo card; o sync que apagava e recriava lançamentos não manuais; tratar pago, faturado e fechamento como o mesmo estado.

## 2. Razão estável

Cada documento gera, no máximo, uma receita e uma despesa, com identidade `(origem, origem_id, tipo)`. Gravar de novo atualiza a mesma linha. Valor zero remove só aquele tipo.

Descartado: `syncAllLancamentos`, que apagava todo lançamento não manual e inseria linhas novas.

## 3. Status da ordem de serviço

Estados: `aberta`, `concluida`, `faturada`. A tela atual oferecia aberta e concluída; faturar gravava faturada. O select agora inclui faturada para a edição não devolver a OS a aberta. OS nova não pode nascer faturada. OS faturada não volta para aberta ou concluída.

Descartado: default `pendente`. Ele existia só no servidor antigo, sem opção visível na interface. Descartado também `cancelada`, sugerida na recomendação de arquitetura, porque a aplicação atual não usa esse estado. Inativação da OS é `ativo = false`, não um quarto status.

## 4. ganho e perdido

Não entram. Licitação usa `ativo` / `inativo`. Lançamento manual fica em `em_andamento`. `ganho` e `perdido` apareciam só no filtro do dashboard e não eram usados pelo sync nem pela licitação.

## 5. Tarifa é dado, não constante

Diárias 369,87 e 189,98, valor de carro por placa, valor 174 da CAIS e margem lucro/valor da planilha não são constantes no código. O preço mora na tarifa. Tarifa não editável substitui o valor e o custo digitados pelo cadastro da tarifa no momento da gravação.

A calculadora TUNAS continua com o desconto 40,01% que a tela já usava (`js/tunas.js`). Ela não grava lançamento. As outras taxas da aba da planilha não foram copiadas.

## 6. Fechar e reabrir o mês

Fechar grava receitas, despesas e saldo da competência e marca `fechada`. Um gatilho no banco impede incluir, alterar ou apagar lançamentos dessa competência. Reabrir é ação administrativa explícita, com `reaberto_em`, `reaberto_por` e registro de auditoria. As duas operações usam trava de concorrência da competência.

Pago e faturar não alteram valores do razão. Faturar continua possível com o mês fechado. Alterar valor, custo ou lançamento do mês fechado é recusado.

## 7. Passageiro

`passageiros` é a entidade. Passagem, hospedagem e veículo referenciam `passageiro_id` quando a linha identifica a pessoa. CPF e data de nascimento ficam no cadastro, não são copiados para a linha. A referência é opcional: a linha antiga podia existir sem pessoa.

Descartado: repetir nome e CPF como texto em cada linha operacional.

## 8. Tipos, integridade e auditoria

Valores monetários em `numeric`. Datas em `date` ou `timestamptz`. Chave primária `uuid`. Chaves estrangeiras, checks e índices. Alteração das entidades operacionais vai para `audit_logs` (quem, quando, entidade, ação). Senha, hash, CPF, cookie e token não entram no JSON de auditoria.

`audit_logs` não existia no modelo antigo. A auditoria de arquitetura pedia para não inventar essa entidade como se ela já existisse. Esta fundação a cria porque a trilha de alteração passou a ser requisito.

Descartado: `float`, data em texto, id de timestamp e o schema espelho `backend/migrations/schema.sql`.

## 9. Carga inicial

A migração cria papéis, permissões e o papel `admin` com todas as permissões. Nenhum cliente, passageiro, licitação, ordem ou valor de negócio entra no seed. O primeiro administrador nasce só se a tabela de usuários estiver vazia e `ADMIN_EMAIL` / `ADMIN_PASSWORD` estiverem no ambiente. Testes criam e apagam os próprios dados num banco separado.

Descartado: `migrate:csv`, CSV e XLSX como caminho de subida, e dados fictícios no seed da aplicação.

## 10. Banco vazio

A aplicação sobe com o schema aplicado e zero linhas de negócio. As telas abrem. Listas vazias não são erro.

## Fora desta fundação

- Redesign visual. As telas continuam as páginas atuais.
- Publicação, DNS e o site ponto.fisamtour.com.
- Supabase. Postgres local via Docker é o banco desta etapa.
- Entidades que a auditoria rejeitou: customers, organizations, contracts, contract_amendments, payments, receivables, documents.
- Usuários, papéis e permissões entram só como acesso. Não são entidades que o código antigo já tinha.
