# Riscos Técnicos

## Críticos
- `app.js` expõe `API_TOKEN` no frontend. Esse token não pode ser considerado segredo.
- Operação `closeMonth` deve travar competência e pode afetar fechamento financeiro sem idempotência, trilha de auditoria ou rollback documentados neste repositório.
- Backend Apps Script e planilha não estão versionados neste repositório, criando ponto cego para análise de segurança e regra de negócio.

## Altos
- CRUD financeiro executado diretamente do navegador contra endpoint externo.
- Ausência de testes automatizados para parsing monetário, cálculos, filtros e payloads da API.
- Ausência de autenticação/autorização de usuário no frontend.
- Endpoint e token hardcoded dificultam rotação segura e separação de ambientes.
- Erros de API são tratados de forma mínima e podem deixar o usuário sem diagnóstico operacional.
- `add`, `update`, `delete` e `closeMonth` aceitam HTTP OK como sucesso sem validar `json.ok`, podendo mascarar erro lógico retornado pelo backend.
- Exclusão de lançamentos em competência fechada precisa ser bloqueada pelo backend.
- Backend retorna HTTP 200 para erros lógicos com `{ ok: false, error }`; qualquer cliente precisa validar o corpo JSON, não apenas o status HTTP.
- `options` usado pelo frontend retornou `op inválida` no backend testado, bloqueando carregamento real de licitações e fornecedores.
- `add` está bloqueado por divergência no cabeçalho da aba `Lancamentos`.

## Médios
- Contrato da API foi inferido pelo frontend, mas ainda precisa ser validado contra retorno real do Apps Script.
- `comprovante_url` é renderizado como link externo sem validação de protocolo/formato.
- Cálculo financeiro depende de valores recebidos do backend sem normalização explícita.
- Exportação CSV não documenta encoding, separador esperado ou compatibilidade com planilhas brasileiras.
- Layout e comportamento dependem de IDs fixos entre HTML e JS.
- `delete` com ID inexistente retornou `{ ok: true }`, o que pode dificultar auditoria e detecção de exclusões inválidas.

## Baixos
- Não há lint/formatter configurado.
- Comentários indicam estados provisórios, como mock e integração futura, que podem estar desatualizados.
- Responsividade existe, mas sem teste visual automatizado.

## Riscos que Bloqueiam Alteração
- Qualquer mudança em API, token, fechamento mensal, cálculo financeiro, exclusão, edição ou schema de dados.
- Qualquer mudança que altere regras de negócio de licitações, receitas, despesas ou competência.
- Qualquer mudança que envolva segurança, autorização, dados sensíveis, deploy ou domínio.
