# Carga manual

Ordem real de cadastro depois que o Postgres está migrado e o administrador entrou. Não há planilha, CSV nem linha de exemplo para copiar para produção. Cada registro nasce na tela, digitado por quem opera.

1. Administrador, pela variável de ambiente, antes do primeiro login. Ver `docs/operacao.md`. Sem isso não existe usuário.
2. Licitação. Tipo `passagens`, `hospedagem`, `veiculo` ou `calculadora`. O tipo não muda depois que existir registro operacional.
3. Fornecedor, se a ordem de serviço for pagar alguém. Pode ser feito no cadastro ou no modal da OS.
4. Tarifa da licitação, quando o preço é de tabela. Valor e custo são os números cadastrados, não uma fórmula da planilha antiga.
5. Passageiro, quando a linha operacional identifica a pessoa. CPF e nascimento ficam neste cadastro.
6. Registro da licitação (passagem, hospedagem ou veículo) ou ordem de serviço. Os dois podem existir. O dashboard não soma os dois: soma só o razão gerado a partir de cada um. Licitação do tipo calculadora não tem linha operacional; a conta da TUNAS continua na calculadora e não grava lançamento.
7. Lançamento manual de receita ou despesa, só para o que não nasceu de OS nem de registro.
8. Marcar pago, quando o pagamento ao fornecedor aconteceu. Isso não fecha o mês e não fatura.
9. Faturar as OS escolhidas na tela de fatura. Isso não cria lançamento novo.
10. Fechar a competência quando os lançamentos daquele mês estiverem certos. Reabrir é ação separada, de administrador, e fica auditada.

Dependências que o banco recusa se a ordem for invertida:

- tarifa exige licitação;
- ordem de serviço exige licitação; tarifa e fornecedor são opcionais, mas a tarifa tem de ser da mesma licitação;
- registro operacional exige licitação do tipo correspondente;
- passageiro na linha, quando preenchido, tem de existir;
- lançamento manual exige licitação;
- não dá para apagar licitação, tarifa, fornecedor ou passageiro que ainda esteja referenciado; o caminho previsto é inativar.

Não carregue o CSV, o XLSX nem o PDF da ata como se fossem a base do sistema novo.
