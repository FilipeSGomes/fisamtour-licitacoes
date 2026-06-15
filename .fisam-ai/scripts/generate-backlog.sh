#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
BACKLOG="$AGENT_DIR/sdd/07-backlog.md"
CLASS="$AGENT_DIR/reports/PROJECT-CLASSIFICATION.md"
RAG="$AGENT_DIR/rag/RAG-MANIFEST.md"
DOMAINS="$AGENT_DIR/orchestration/domains.tsv"
mkdir -p "$AGENT_DIR/sdd"
[ -f "$CLASS" ] || "$AGENT_DIR/scripts/scan-project.sh" >/dev/null
[ -f "$DOMAINS" ] || "$AGENT_DIR/scripts/plan-agents.sh" >/dev/null
complexity="$(awk -F ': ' '$1=="complexity" { print $2; exit }' "$CLASS" 2>/dev/null || true)"
recommended="$(awk -F ': ' '$1=="recommended_agents" { print $2; exit }' "$CLASS" 2>/dev/null || true)"
lexical="$(awk -F ': ' '$1=="lexical_index" { print $2; exit }' "$RAG" 2>/dev/null || true)"
semantic="$(awk -F ': ' '$1=="semantic_index" { print $2; exit }' "$RAG" 2>/dev/null || true)"
top_domain="$(awk -F '\t' 'NR==1 { print $1; exit }' "$DOMAINS" 2>/dev/null || true)"
top_files="$(awk -F '\t' 'NR==1 { print $2; exit }' "$DOMAINS" 2>/dev/null || true)"
[ -n "$top_domain" ] || top_domain=root
[ -n "$top_files" ] || top_files=0
generated_at="$(date +%Y-%m-%dT%H:%M:%S)"
cat > "$BACKLOG" <<EOF
# 07 - Backlog

generated_at: $generated_at
source: generate-backlog.sh
complexity: ${complexity:-unknown}
recommended_agents: ${recommended:-unknown}

## Itens
- ID: BLG-001
  - Status: ready
  - Tipo: discovery
  - Prioridade: P1
  - Titulo: Completar briefing e mapa de contexto com evidencias RAG
  - Valor: reduz ambiguidade antes de qualquer alteracao de codigo.
  - Evidencias: rag/RAG-MANIFEST.md lexical=${lexical:-unknown} semantic=${semantic:-unknown}
  - Criterio de aceite: 00-project-brief e 01-context-map preenchidos com links para evidencias.
  - Origem: SDD baseline

- ID: BLG-002
  - Status: ready
  - Tipo: task
  - Prioridade: P1
  - Titulo: Revisar dominio principal $top_domain
  - Valor: concentra a primeira analise no maior ponto de superficie do projeto.
  - Evidencias: orchestration/domains.tsv domain=$top_domain files=$top_files
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
EOF
echo "Backlog: $BACKLOG"
