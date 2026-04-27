# Riscos e Gaps Iniciais

## Riscos Principais
- Token de API exposto em JavaScript público.
- Fechamento mensal sem contrato técnico, regra de negócio ou rollback documentados.
- API e persistência externas sem versionamento local.
- Ausência de testes automatizados.
- Possível domínio financeiro/licitatório, exigindo cautela R5.

## Gaps Principais
- Sem documentação de schema.
- Sem documentação de API.
- Sem documentação de deploy.
- Sem documentação de operação/incidentes.
- Sem observabilidade.
- Sem autenticação/autorização clara.
- Sem matriz de permissões.

## Bloqueios Para Alterar Código
- Entender Apps Script e planilha.
- Validar se o token atual protege algo real.
- Formalizar contrato de mudança.
- Definir plano mínimo de teste manual e rollback.
