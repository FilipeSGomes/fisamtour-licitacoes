# 07 - Backlog

generated_at: 2026-06-12T19:51:41
source: generate-backlog.sh
complexity: small
recommended_agents: 2

## Itens
- ID: BLG-001
  - Status: ready
  - Tipo: discovery
  - Prioridade: P1
  - Titulo: Completar briefing e mapa de contexto com evidencias RAG
  - Valor: reduz ambiguidade antes de qualquer alteracao de codigo.
  - Evidencias: rag/RAG-MANIFEST.md lexical=ok semantic=ok
  - Criterio de aceite: 00-project-brief e 01-context-map preenchidos com links para evidencias.
  - Origem: SDD baseline

- ID: BLG-002
  - Status: ready
  - Tipo: task
  - Prioridade: P1
  - Titulo: Revisar dominio principal root
  - Valor: concentra a primeira analise no maior ponto de superficie do projeto.
  - Evidencias: orchestration/domains.tsv domain=root files=4
  - Criterio de aceite: riscos, dependencias e arquivos principais registrados no context map.
  - Origem: plan-agents.sh

- ID: BLG-003
  - Status: ready
  - Tipo: risk
  - Prioridade: P2
  - Titulo: Executar auditoria de governanca antes de abrir mudancas
  - Valor: evita execucao sem contrato, validacao ou rastreabilidade.
  - Evidencias: scripts/audit-governance.sh
  - Criterio de aceite: reports/GOVERNANCE-AUDIT.md com status pass ou riscos residuais explicitos.
  - Origem: governance baseline
