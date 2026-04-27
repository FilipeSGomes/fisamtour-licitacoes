# Scorecard Técnico

| Área | Nota 0-5 | Observação |
|---|---:|---|
| Arquitetura | 2 | Simples e compreensível, mas backend real está fora do repositório e o frontend concentra muitas responsabilidades. |
| Testes | 0 | Nenhum teste automatizado detectado. |
| Segurança | 1 | Token exposto no frontend e autenticação/autorização não evidentes. |
| Documentação | 2 | Governança inicial existe; documentação técnica do sistema ainda era placeholder. |
| Deploy | 1 | `CNAME` detectado, mas sem runbook de deploy/rollback. |
| Observabilidade | 0 | Sem logs, métricas, rastreamento ou health check detectados. |
| Manutenibilidade | 2 | Código pequeno e legível, porém sem modularização, testes ou contrato da API. |
| Risco de alteração | 4 | Alto, por domínio financeiro/licitatório, endpoint externo e ausência de testes/contrato. |

## Classificação Geral
Projeto pequeno, mas com risco operacional alto por lidar com dados financeiros/licitatórios e fechamento mensal. Deve permanecer em modo somente leitura para código-fonte até existir contrato de mudança, entendimento do Apps Script/planilha e plano de validação.
