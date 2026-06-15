#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
OUT="$AGENT_DIR/index/PROJECT-SCAN.md"
CLASS="$AGENT_DIR/reports/PROJECT-CLASSIFICATION.md"
mkdir -p "$AGENT_DIR/index" "$AGENT_DIR/reports"
cd "$PROJECT"
TOTAL_FILES="$(find . -path './.git' -prune -o -path './node_modules' -prune -o -path './.fisam-ai*' -prune -o -path './.codex-agent*' -prune -o -type f -print | wc -l | tr -d ' ')"
TOTAL_LINES="$(find . -path './.git' -prune -o -path './node_modules' -prune -o -path './.fisam-ai*' -prune -o -path './.codex-agent*' -prune -o -type f -print | xargs wc -l 2>/dev/null | awk '{ if ($2 != "total") s += $1 } END { print s+0 }')"
[ -n "$TOTAL_LINES" ] || TOTAL_LINES=0
if [ "$TOTAL_FILES" -lt 100 ] && [ "$TOTAL_LINES" -lt 20000 ]; then COMPLEXITY=small
elif [ "$TOTAL_FILES" -lt 1000 ] && [ "$TOTAL_LINES" -lt 200000 ]; then COMPLEXITY=medium
elif [ "$TOTAL_FILES" -lt 10000 ] && [ "$TOTAL_LINES" -lt 1000000 ]; then COMPLEXITY=large
else COMPLEXITY=xlarge
fi
case "$COMPLEXITY" in
  small) RECOMMENDED_AGENTS=2; RECOMMENDED_MODE=assisted; RECOMMENDED_BATCH=single ;;
  medium) RECOMMENDED_AGENTS=3; RECOMMENDED_MODE=assisted; RECOMMENDED_BATCH=module ;;
  large) RECOMMENDED_AGENTS=5; RECOMMENDED_MODE=assisted; RECOMMENDED_BATCH=domain ;;
  *) RECOMMENDED_AGENTS=8; RECOMMENDED_MODE=manual_gated; RECOMMENDED_BATCH=domain_batches ;;
esac
STACK_HINTS=""
[ -f package.json ] && STACK_HINTS="$STACK_HINTS node"
[ -f pyproject.toml ] || [ -f requirements.txt ] && STACK_HINTS="$STACK_HINTS python"
[ -f go.mod ] && STACK_HINTS="$STACK_HINTS go"
[ -f Cargo.toml ] && STACK_HINTS="$STACK_HINTS rust"
[ -f pom.xml ] || [ -f build.gradle ] && STACK_HINTS="$STACK_HINTS java"
[ -f composer.json ] && STACK_HINTS="$STACK_HINTS php"
[ -d terraform ] || [ -d infra ] || [ -d k8s ] && STACK_HINTS="$STACK_HINTS infra"
{
  echo "# PROJECT-SCAN"
  echo "generated_at: $(date +%Y-%m-%dT%H:%M:%S)"
  echo "total_files: $TOTAL_FILES"
  echo "total_lines: $TOTAL_LINES"
  echo "complexity: $COMPLEXITY"
  echo "stack_hints:${STACK_HINTS:- unknown}"
  echo
  echo "## Extensoes"
  find . -path './.git' -prune -o -path './node_modules' -prune -o -path './.fisam-ai*' -prune -o -path './.codex-agent*' -prune -o -type f -print | sed -n 's/.*\.//p' | sort | uniq -c | sort -rn | head -30
  echo
  echo "## Configs raiz"
  for f in package.json pyproject.toml go.mod Cargo.toml pom.xml build.gradle composer.json Gemfile Makefile Dockerfile docker-compose.yml; do [ -f "$f" ] && echo "$f"; done
  echo
  echo "## Estrutura"
  find . -maxdepth 2 -type d ! -path './.git*' ! -path './node_modules*' ! -path './.fisam-ai*' ! -path './.codex-agent*' | sort
} > "$OUT"
cat > "$CLASS" <<EOF
# PROJECT-CLASSIFICATION

generated_at: $(date +%Y-%m-%dT%H:%M:%S)
total_files: $TOTAL_FILES
total_lines: $TOTAL_LINES
complexity: $COMPLEXITY
stack_hints:${STACK_HINTS:- unknown}
recommended_agents: $RECOMMENDED_AGENTS
recommended_mode: $RECOMMENDED_MODE
recommended_batch: $RECOMMENDED_BATCH

## Recomendacao

- small: 1 planner + 1 executor/documenter.
- medium: planner + executor + auditor.
- large: agentes por dominio/modulo.
- xlarge: RAG obrigatorio, execucao por lotes e auditoria forte.
EOF
cat > "$AGENT_DIR/orchestration/recommendation.json" <<EOF
{
  "complexity": "$COMPLEXITY",
  "stack_hints": "${STACK_HINTS:-unknown}",
  "recommended_agents": $RECOMMENDED_AGENTS,
  "recommended_mode": "$RECOMMENDED_MODE",
  "recommended_batch": "$RECOMMENDED_BATCH"
}
EOF
echo "Scan: $OUT"
echo "Classification: $CLASS"
