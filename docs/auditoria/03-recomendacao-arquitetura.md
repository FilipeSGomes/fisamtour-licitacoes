# 03 — Recomendação de arquitetura

Recomendação para as fases seguintes. Nada disto foi implementado. Nenhum banco foi criado, nenhuma migração foi escrita, nenhum Project foi aberto.

## 1. Decisões do proprietário (registrar, não executar)

- Histórico será digitado depois, à mão.
- Sem migração automática de planilha, sem Google Sheets operacional, sem sincronização, sem CSV/Excel como banco.
- O aplicativo precisa subir com banco vazio.
- PostgreSQL é a preferência. Supabase entra só como opção de hospedagem, sem provisionar agora.
- Monólito modular. Sem microsserviços.
- Não publicar em produção nesta modernização.

Consequência direta sobre o que já está no repositório: `backend/scripts/migrate-csv.js`, `scripts/generate_csvs.py` e `appScript/` deixam de ser caminho operacional. `backend/migrations/schema.sql` é um espelho das dez abas, útil como inventário, inadequado como schema definitivo (datas em texto, lançamento duplicado, fornecedor e passageiro sem FK, ids opacos de timestamp).

## 2. Stack proposta

Monólito modular em **Node.js**, com **PostgreSQL** como único sistema de registro, servindo a API e, na mesma aplicação, as telas. Um processo, um banco, módulos com fronteira de código.

Justificativa contra o que existe:

- A linguagem e o contrato (`op`, telas, regras de lucro) já estão em JavaScript. Trocar de linguagem não remove o problema, que é a planilha e o modelo duplicado.
- O Express em `backend/` já mostra o recorte de módulos (`catalogo`, `registros`, `ordens`, `lancamentos`, `sync`) e o uso de transação com `pg_advisory_xact_lock`. Esse recorte serve de mapa. O sync que apaga e recria lançamentos não serve de implementação.
- O frontend sem framework funciona e cobre as seis telas. Reescrever em outro framework antes de ter banco, autenticação e regras estáveis atrasa a fundação. As telas podem continuar multi-página até o módulo financeiro estabilizar.
- Supabase é uma forma de obter PostgreSQL gerenciado (o `.env.example` já fala a connection string). Não é um segundo banco, nem substituto de modelo, nem motivo para ligar Storage/Realtime agora. Auth do Supabase pode ser reavaliada na fundação; o requisito é identidade de verdade, no lugar do token compartilhado. Postgres local ou outro Postgres gerenciado atende a mesma decisão.
- Microsserviços não têm ganho aqui: um domínio, um time, um deploy, e o bug atual é justamente a falta de uma transação só.

Fora do desenho: Apps Script, Vercel como obrigação (o `vercel.json` é um deploy possível, não uma decisão de arquitetura), planilha, importador CSV.

## 3. Módulos do monólito

| Módulo | Responsabilidade | Base no código atual |
|---|---|---|
| Identidade | Login e permissão. Módulo novo: o sistema não tem usuários | Substituir `authOrThrow` / `API_TOKEN` |
| Catálogo | Licitações, tarifas, fornecedores | `backend/lib/catalogo.js`, `js/licitacoes.js` |
| Pessoas | Passageiros, com CPF tratado como dado pessoal | `listPassageiros` hoje é só leitura |
| Operação | OS e os três detalhes (passagem, hospedagem, veículo) | `ordens.js`, `registros.js`, `js/licitacao.js`, `app.js` |
| Financeiro | Receita, custo, lucro, pago, faturamento, fechamento de competência | `lancamentos.js`, `sync.js`, `js/fatura.js` |
| Consulta | Dashboard, fatura imprimível, exportação | `app.js`, `fatura.html` |
| TUNAS | Calculadora 40,01% sem persistir | `js/tunas.js` |

TUNAS permanece ferramenta, não tipo de registro. Licitação `calculadora` não ganha tabela de linhas.

## 4. Esboço relacional (somente o que o código justifica)

Entidades a criar porque o comportamento existe. Tipos e constraints ficam para a fase de fundação; isto não é DDL.

- **licitacoes** — `id`, `nome`, `tipo` (`passagens` | `hospedagem` | `veiculo` | `calculadora`), `status` (`ativo` | `inativo`). 1 licitação → N tarifas, N OS, N linhas do único tipo operacional.
- **fornecedores** — `id`, `nome`, `status`. A OS deve referenciar `fornecedor_id`. Hoje grava o nome solto (`app.js`).
- **tarifas** — `id`, `licitacao_id`, `codigo`, `nome`, `valor`, `custo`, `editavel`, `status`. A OS deve referenciar `tarifa_id` e pode copiar valor/custo no momento da gravação (preço praticado), para uma mudança de tabela não reescrever o passado.
- **passageiros** — `id`, `nome`, `data_nasc`, `cpf`, `status`. Cadastro hoje sem escrita na UI; o dado existe (359 linhas no CSV, com CPF). FK a partir da linha operacional é melhoria, não fato atual: hoje `colaborador` e `cpf` são texto.
- **ordens_servico** — competência, data, licitação, tarifa, fornecedor, descrição, valor, custo, lucro calculado, `status_os`, `pago`, `comprovante_url`, `faturado_em`. Sem tabela de passageiros da OS: o código não relaciona os dois.
- **reg_passagens**, **reg_hospedagem**, **reg_veiculo** — manter três tabelas. Os campos não cabem numa linha só (bilhete/assento versus diárias/refeições versus placa). Cada uma N:1 com licitação. `percentil` não entra como coluna editável.
- **lancamentos** — deixar de ser cópia gravada com id novo a cada sync. O dashboard precisa de linhas de receita e de despesa; isso pode ser uma projeção (consulta ou linhas geradas com identidade estável `origem + origem_id + tipo`). Lançamento manual continua persistido, porque o modal cria receita/despesa avulsa sem OS e sem registro.
- **fechamentos** — uma linha por competência: totais e `fechado_em`. Só vale a pena se fechar o mês passar a significar snapshot consultável. Hoje a tabela é escrita e nunca lida.

Não criar nesta fundação, porque o código não tem o conceito: customers, organizations, contracts, contract_amendments, service_order_passengers, payments, receivables, documents, audit_logs, roles como matriz completa. `comprovante_url` permanece atributo da OS/lançamento até existir um fluxo de arquivo. Um papel simples (operador autenticado) basta para substituir o token; não há regra de permissão diferente por tela para copiar.

**users** entra como módulo novo de identidade, não como entidade descoberta. Sem isso a fundação repete o token no JavaScript.

Fatura emitida: a impressão não gera registro. O estado “faturada” mora na OS. Uma tabela `faturas` só se for necessário reimprimir o conjunto exato mais tarde. Não é requisito do código atual; fica fora do primeiro schema.

### Estados a unificar antes de codar a OS

Um conjunto só, alinhado ao que as telas já tentam dizer:

- OS: `aberta` → `concluida` → `faturada`, mais `cancelada`. `pendente` do default de servidor e `inativo` deixam de ser sinônimos soltos. O select precisa conseguir exibir `faturada` sem devolvê-la para `aberta` ao salvar.
- Pago: `sim`/`nao` na OS e no registro, independente de faturada. Salvar OS não pode forçar `nao` (comportamento atual de `app.js`).
- Licitação, tarifa, fornecedor, passageiro, registro: `ativo` / `inativo`.
- Lançamento manual pode manter `em_andamento` como default. `ganho` e `perdido` não têm efeito no sync nem no dado gerado; só permanecem se o proprietário confirmar que o lançamento avulso usa esse ciclo. Não usar esses valores como status da licitação.

## 5. Preservar, melhorar, eliminar

### Preservar

- As seis telas e os fluxos da seção 6 do documento de regras.
- Competência `YYYY-MM`.
- Receita = valor cobrado (ou `vlr_total`); despesa do dashboard = custo; lucro = diferença. Faturar ≠ pagar ≠ fechar o mês.
- Três detalhes operacionais e a OS como documentos distintos, com a ressalva de dupla contagem abaixo.
- Fatura montada à mão (Add/Remove) e impressão.
- Fechamento por competência como snapshot, se a tela passar a exibir o que gravou.
- Calculadora TUNAS em 40,01%, sem gravar, até o proprietário dizer que as outras taxas da aba importam.
- Transação única nas escritas que hoje disparam sync (a direção de `withTransaction` + lock em `backend/lib/db.js`).

### Melhorar

- Uma API só, autenticada, sem token no fonte do browser.
- FKs de tarifa e fornecedor; nome da licitação obtido por join.
- Identidade estável da projeção financeira, para editar/excluir não ressuscitar linha nem perder alteração.
- Totais da licitação e do dashboard sobre a mesma definição de conjunto (registros, OS e manuais), explícita na tela.
- Edição de OS faturada sem apagar `faturado_em` nem resetar status.
- `pago` persistido na OS.
- Formulário de passageiro, se o cadastro deixar a planilha — hoje a tela não grava.
- Datas como data, números como numeric, ids estáveis.
- Testes das contas (par receita/custo, lucro, fechamento versus filtro, fatura).

### Eliminar

- Google Sheets e Apps Script como banco (`appScript/codigo.gs` e a `API_URL` atual).
- `migrate-csv` e `generate_csvs.py` como rotina do produto. Podem permanecer no histórico do git; não entram no boot.
- Regravação global de lançamentos (`syncAllLancamentos` / `syncAllLancamentos_`).
- Segredo compartilhado commitado e Web App “qualquer pessoa”.
- `ssl: { rejectUnauthorized: false }` como padrão (`backend/lib/db.js`) quando houver conexão real.
- Coluna `percentil` armazenada, valor fixo 174 implícito, e `pago` fabricado pelo gerador.

Dupla contagem é decisão de produto, não de framework: registro operacional e OS ambos alimentam o dashboard. Com carga manual futura, o mesmo fato digitado nos dois lugares soma duas vezes. A fundação pode criar as duas estruturas, porque as duas telas existem. O módulo financeiro não deve ir para produção interna enquanto essa regra não estiver escrita na tela (por exemplo, detalhe legado versus OS nova, sem os dois no mesmo card).

Fórmulas só da planilha (diárias × 369,87, refeição × 189,98, refeições = diárias × 2, valor do carro pela placa, valor 174 da CAIS, margem lucro/valor, 20% numa célula, taxas extras da TUNAS) ficam de fora até confirmação. Os números 369,87, 189,98, 481,76, 32,12, 143 e 11 já estão como tarifas no catálogo; o aplicativo novo deve usar a tarifa, não uma célula absoluta da planilha.

## 6. Riscos

| Risco | Evidência | Efeito na modernização |
|---|---|---|
| Repositório público com token de API | `js/api.js`, `appScript/codigo.gs`, `scripts/test_api.sh`; GitHub `isPrivate: false` | Quem tem o código chama a planilha viva. Trocar o token e restringir a implantação do Apps Script é contenção, fora do escopo desta auditoria, e não depende do schema novo |
| CPF, data de nascimento e nome no git | `appScript/csv/passageiros.csv`, `reg_passagens.csv`, `reg_veiculo.csv`, `LICITACÕES.xlsx` aba `Página8` | Dado pessoal (LGPD) em repositório público. A fundação não copia esses arquivos para o banco. O histórico git continua com eles até uma ação própria de remoção, que esta etapa não faz |
| PDF de ata não rastreado | `Ata+de+Ristro+de+Preco+8-2026.pdf` | Não usado como especificação. Não versionar sem revisão |
| Planilha como banco, sync sem atomicidade de negócio | `appScript/codigo.gs`; comentários em `backend/lib/db.js` | Dois fechamentos ou dois syncs se atropelam. Some no dia em que a planilha sair |
| SQL | Consultas do backend usam parâmetros. Nome de tabela vem de mapa fixo (`REG_TABLE_BY_TIPO`), não do cliente | Sem injeção explorável nesse mapa. Manter parâmetro e whitelist ao reescrever |
| XSS | A maior parte dos textos passa por `FisamAPI.escapeHtml`. `badge()` em `app.js` interpola `tipo` em `innerHTML` sem escape | Corrigir na UI nova; o dado hoje é controlado pelo próprio sync |
| Token na query string | `apiGet` em `js/api.js` | Vaza em log de proxy e histórico do browser |
| `saveRegistros` substitui o conjunto inteiro | `backend/lib/registros.js` | Um cliente com lista parcial apaga o resto da licitação |
| Sem teste de regra | só `scripts/test_api.sh` | Regressão de lucro/fatura/fechamento passa batido |
| Dois backends já divergem | carimbo de OS faturada; comentário “só faturadas” versus código | Não evoluir os dois. Um morre (Apps Script), o outro não é copiado cegamente |

## 7. Ordem das próximas fases

### Fase 1 — Fundação

- Aplicação sobe com PostgreSQL vazio, sem ler planilha, CSV ou xlsx.
- Identidade mínima no lugar do token do frontend.
- Esqueleto dos módulos acima e schema só das entidades da seção 4, sem `percentil`, sem carga.
- Saúde do processo e uma tela que abre com listas vazias.
- Não rodar `schema.sql` atual nem `migrate:csv`.

### Fase 2 — Módulos

1. Catálogo: licitação, tarifa, fornecedor.
2. Passageiros, agora com escrita, CPF só no banco novo.
3. Operação: três registros e OS, com o status único da seção 4.
4. Financeiro por último nesta fase: projeção estável, pago, faturar, fechar competência. Depende das confirmações da seção 8.

### Fase 3 — UI

Reconectar as seis telas ao monólito, na ordem dashboard → licitações/tarifas → detalhe → fatura → passageiros → TUNAS. Conferir no browser os fluxos de incluir, editar, excluir, filtrar, faturar e fechar, com banco vazio e com poucos registros digitados na hora.

### Fase 4 — Testes

Casos automáticos das contas, antes de chamar a fundação de pronta para uso interno: par receita/custo, lucro, hospedagem pelo `custo_tt`, OS não zera `pago`, OS faturada não volta a `aberta`, fechamento ignora filtro de tela, seleção parcial da fatura, `save` de registros não apaga outra licitação, app vazio não quebra.

Dados históricos ficam fora de todas as fases até o proprietário cadastrar.

## 8. O que não bloqueia a fundação — e o que bloqueia o financeiro

A fundação (app vazio, Postgres, login, módulos, sem Sheets) pode começar. Git remote e `gh` estão utilizáveis; não há Project ligado, e isso não impede a fundação.

Antes de fechar o schema e as regras do módulo financeiro, o proprietário precisa cravar:

1. Registro operacional e OS podem representar o mesmo serviço ao mesmo tempo? Se sim, o card de receita precisa de uma regra anti-duplicidade visível. Se não, qual dos dois caminhos vale para o trabalho novo.
2. Lista final de `status_os` e se `ganho`/`perdido` sobrevivem no lançamento avulso.
3. Quais fórmulas da planilha continuam valendo: diárias e refeições da TJ a partir da tarifa, valor de veículo pela placa, preço único da CAIS, margem lucro/valor, células de 20% e as taxas da aba TUNAS além de 40,01%. Sem esse sim, o sistema novo só calcula lucro = valor − custo, que é o que o aplicativo já faz.
4. Fechar o mês apenas grava totais, ou também impede alteração da competência.
5. Passageiro na linha operacional continua texto livre ou passa a FK. Não bloqueia a tabela `passageiros`; bloqueia a coluna na linha de passagem/veículo.
