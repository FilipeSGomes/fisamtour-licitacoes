# Gaps do Projeto

## Técnicos
- Sem `package.json`, framework, bundler ou scripts de automação.
- Sem separação entre configuração de ambiente e código publicado.
- Contrato da API Apps Script inferido e parcialmente validado contra backend real.
- Sem schema formal dos dados; não é bloqueante por enquanto porque o backend está fora deste repositório.
- Cabeçalho real da aba `Lancamentos` precisa ser ajustado para o backend aceitar `add`.
- Frontend não valida se `data` pertence à `competencia`.
- `computeSummary` trata qualquer `tipo` diferente de `receita` como despesa, sem validação defensiva de enum.
- `comprovante_url` é aceito como texto livre no frontend.

## Documentação
- Deploy e rollback não documentados.
- Regras de negócio não documentadas.
- Fluxo de fechamento mensal parcialmente definido: `closeMonth` deve travar competência.
- Regra de exclusão em competência fechada parcialmente definida: backend deve impedir exclusão.
- Política de acesso e propriedade da planilha/API não documentadas.
- Operação `options` precisa ser implementada ou alinhada com o frontend.
- Significado operacional dos status `em_andamento`, `ganho` e `perdido` não documentado.
- Regras de cálculo financeiro por status não documentadas.
- Taxonomia oficial de categorias não documentada.
- Obrigatoriedade de fornecedor e comprovante por tipo/categoria não documentada.

## Testes
- Sem testes unitários.
- Sem testes de integração contra mock de API.
- Sem testes end-to-end.
- Sem checklist manual versionado.
- Teste real contra Apps Script foi executado em 2026-04-26, mas o fluxo completo de CRUD ficou bloqueado por divergência no cabeçalho da aba `Lancamentos`.

## Segurança
- Token no frontend.
- Sem autenticação de usuário detectada.
- Sem documentação de permissões no Apps Script/Google Sheets.
- Sem política de rotação de token.
- Sem validação documentada para URLs de comprovante.
- Token é validado pelo Apps Script, mas permanece exposto publicamente no bundle frontend.

## Operação
- Sem observabilidade, logs de erro ou monitoramento.
- Sem health check da API.
- Sem runbook de incidentes.
- Sem ambientes separados documentados.

## Arquitetura
- Frontend concentra UI, estado, validação, cálculo e integração em um único arquivo.
- Backend real está fora do repositório.
- Persistência real não auditável a partir desta base.

## Memória do Agente
- Prompt 02 foi ajustado em 2026-04-26 para deixar obrigatório registrar execuções na memória `.codex-agent/`, mesmo quando o runtime estiver em modo somente leitura.
