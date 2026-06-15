#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
ORCH="$AGENT_DIR/orchestration"
RUNTIME="$AGENT_DIR/config/runtime.env"
CLASS="$AGENT_DIR/reports/PROJECT-CLASSIFICATION.md"
MANIFEST="$AGENT_DIR/rag/manifest.tsv"
mkdir -p "$ORCH/agent-prompts"
cfg() { grep -E "^$1=" "$RUNTIME" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
meta() { awk -F ': ' -v k="$1" '$1 == k { print $2; exit }' "$CLASS" 2>/dev/null || true; }
if [ ! -f "$CLASS" ]; then "$AGENT_DIR/scripts/scan-project.sh" >/dev/null; fi
complexity="$(meta complexity)"; if [ -z "$complexity" ]; then complexity=small; fi
recommended="$(meta recommended_agents)"; if [ -z "$recommended" ]; then recommended=2; fi
max_parallel="$(cfg max_parallel_agents)"; if [ -z "$max_parallel" ]; then max_parallel="$recommended"; fi
case "$recommended" in ''|*[!0-9]*) recommended=2 ;; esac
case "$max_parallel" in ''|*[!0-9]*) max_parallel="$recommended" ;; esac
active_agents="$recommended"
if [ "$active_agents" -gt "$max_parallel" ]; then active_agents="$max_parallel"; fi
if [ "$active_agents" -lt 1 ]; then active_agents=1; fi
planner_runtime="$(cfg planner_runtime)"; if [ -z "$planner_runtime" ]; then planner_runtime=ollama; fi
executor_runtime="$(cfg executor_runtime)"; if [ -z "$executor_runtime" ]; then executor_runtime=ollama; fi
auditor_runtime="$(cfg auditor_runtime)"; if [ -z "$auditor_runtime" ]; then auditor_runtime=codex; fi
documenter_runtime="$(cfg documenter_runtime)"; if [ -z "$documenter_runtime" ]; then documenter_runtime=ollama; fi
if [ -f "$MANIFEST" ]; then
  awk -F '\t' 'NR > 1 { split($1,a,"/"); d=(a[2] ? a[1] : "root"); files[d]++; lines[d]+=$3; source[d]+=($6=="source"); tests[d]+=($6=="test"); docs[d]+=($6=="docs"); config[d]+=($6=="config"); infra[d]+=($6=="infra") } END { for (d in files) printf "%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\n", d, files[d], lines[d], source[d], tests[d], docs[d], config[d], infra[d] }' "$MANIFEST" | sort -k2,2nr -k3,3nr > "$ORCH/domains.tsv"
else
  printf 'root\t0\t0\t0\t0\t0\t0\t0\n' > "$ORCH/domains.tsv"
fi
printf 'role\tdomain\truntime\tstatus\tprompt\tevidence\n' > "$ORCH/task-queue.tsv"
printf 'planner\tglobal\t%s\tready\torchestration/agent-prompts/planner.md\treports/PROJECT-CLASSIFICATION.md\n' "$planner_runtime" >> "$ORCH/task-queue.tsv"
cat > "$ORCH/agent-prompts/planner.md" <<EOF
# Planner

Use PROJECT-CONTEXT.md, reports/PROJECT-CLASSIFICATION.md, rag/RAG-MANIFEST.md, orchestration/domains.tsv e sdd/ antes de abrir arquivos originais.
Crie ou refine contratos em sdd/05-change-contracts.md antes de orientar execucao.
EOF
i=1
while IFS=$'\t' read -r domain files lines source tests docs config infra; do
  if [ -z "$domain" ]; then continue; fi
  safe_domain="$(printf '%s' "$domain" | tr -cs 'A-Za-z0-9._-' '-')"
  prompt="orchestration/agent-prompts/executor-$i-$safe_domain.md"
  printf 'executor-%02d\t%s\t%s\tready\t%s\trag/manifest.tsv\n' "$i" "$domain" "$executor_runtime" "$prompt" >> "$ORCH/task-queue.tsv"
  cat > "$AGENT_DIR/$prompt" <<EOF
# Executor $i - $domain

Dominio: $domain
Arquivos estimados: $files
Linhas estimadas: $lines

Regras:
- Leia primeiro rag/RAG-MANIFEST.md, rag/manifest.tsv e sdd/05-change-contracts.md.
- Trabalhe somente no dominio atribuido, salvo contrato aprovado.
- Registre evidencias e comandos de validacao em sdd/06-validation-plan.md.
EOF
  i=$((i+1))
done < "$ORCH/domains.tsv"
printf 'auditor\tglobal\t%s\tready\torchestration/agent-prompts/auditor.md\tsdd/06-validation-plan.md\n' "$auditor_runtime" >> "$ORCH/task-queue.tsv"
printf 'documenter\tglobal\t%s\tready\torchestration/agent-prompts/documenter.md\tsdd/README.md\n' "$documenter_runtime" >> "$ORCH/task-queue.tsv"
cat > "$ORCH/agent-prompts/auditor.md" <<'EOF'
# Auditor

Revise contratos, diffs e validacoes. Priorize risco, regressao e ausencia de teste.
EOF
cat > "$ORCH/agent-prompts/documenter.md" <<'EOF'
# Documenter

Atualize SDD, ADRs e notas de decisao com base nas evidencias geradas pela execucao.
EOF
generated_at="$(date +%Y-%m-%dT%H:%M:%S)"
cat > "$ORCH/agent-plan.json" <<EOF
{
  "generated_at": "$generated_at",
  "complexity": "$complexity",
  "recommended_agents": $recommended,
  "active_agents": $active_agents,
  "max_parallel_agents": $max_parallel,
  "domains_tsv": "orchestration/domains.tsv",
  "task_queue_tsv": "orchestration/task-queue.tsv",
  "runtimes": {"planner":"$planner_runtime","executor":"$executor_runtime","auditor":"$auditor_runtime","documenter":"$documenter_runtime"}
}
EOF
{
  echo "# Execution Plan"
  echo
  echo "generated_at: $generated_at"
  echo "complexity: $complexity"
  echo "recommended_agents: $recommended"
  echo "active_agents: $active_agents"
  echo "max_parallel_agents: $max_parallel"
  echo
  echo "## Strategy"
  case "$complexity" in
    small) echo "Single executor with planner/auditor checkpoints." ;;
    medium) echo "Planner, executor by domain, auditor after each meaningful change." ;;
    large) echo "Domain batches with bounded parallelism and mandatory validation gates." ;;
    *) echo "Manual-gated domain batches, strict contracts, and staged validation." ;;
  esac
  echo
  echo "## Domains"
  awk -F '\t' '{ printf "- %s: files=%s lines=%s source=%s tests=%s docs=%s config=%s infra=%s\n", $1,$2,$3,$4,$5,$6,$7,$8 }' "$ORCH/domains.tsv"
  echo
  echo "## Queue"
  awk -F '\t' 'NR > 1 { printf "- %s / %s / %s / %s\n", $1,$2,$3,$4 }' "$ORCH/task-queue.tsv"
} > "$ORCH/execution-plan.md"
echo "Agent plan: $ORCH/execution-plan.md"
