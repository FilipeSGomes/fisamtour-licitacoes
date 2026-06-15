#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
CONFIG="$AGENT_DIR/config/runtime.env"
REPORT="$AGENT_DIR/reports/ASYNC-PO-LOOP.md"
LOG="$AGENT_DIR/logs/async-po-loop.log"
mkdir -p "$AGENT_DIR/reports" "$AGENT_DIR/logs"
cfg() { grep -E "^$1=" "$CONFIG" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
SYNC_GITHUB="${FISAM_ASYNC_SYNC_GITHUB:-$(cfg async_sync_github)}"
case "${1:-}" in
  --no-sync) SYNC_GITHUB=no ;;
  --cron-line)
    schedule="$(cfg async_loop_schedule)"; [ -n "$schedule" ] || schedule="0 */6 * * *"
    printf '%s cd %q && %q/scripts/run-async-po-loop.sh >> %q 2>&1\n' "$schedule" "$PROJECT" "$AGENT_DIR" "$LOG"
    exit 0
    ;;
esac
run_step() {
  name="$1"
  shift
  started="$(date +%Y-%m-%dT%H:%M:%S)"
  echo "$started|START|$name" >> "$LOG"
  set +e
  output="$("$@" 2>&1)"
  rc=$?
  set -e
  ended="$(date +%Y-%m-%dT%H:%M:%S)"
  echo "$ended|END|$name|rc=$rc" >> "$LOG"
  {
    echo "## $name"
    echo "started: $started"
    echo "ended: $ended"
    echo "exit_code: $rc"
    echo
    echo '```txt'
    printf '%s\n' "$output" | tail -120
    echo '```'
    echo
  } >> "$REPORT"
  return "$rc"
}
{
  echo "# ASYNC-PO-LOOP"
  echo "generated_at: $(date +%Y-%m-%dT%H:%M:%S)"
  echo "project: $PROJECT"
  echo "sync_github: ${SYNC_GITHUB:-yes}"
  echo
} > "$REPORT"
fail=0
run_step "scan-project" "$AGENT_DIR/scripts/scan-project.sh" || fail=$((fail+1))
run_step "build-rag" "$AGENT_DIR/scripts/build-rag.sh" || fail=$((fail+1))
run_step "plan-agents" "$AGENT_DIR/scripts/plan-agents.sh" || fail=$((fail+1))
run_step "generate-backlog" "$AGENT_DIR/scripts/generate-backlog.sh" || fail=$((fail+1))
run_step "audit-governance" "$AGENT_DIR/scripts/audit-governance.sh" || fail=$((fail+1))
if grep -Eq '^status: fail$' "$AGENT_DIR/reports/GOVERNANCE-AUDIT.md" 2>/dev/null; then
  echo "audit_status: fail" >> "$REPORT"
  fail=$((fail+1))
fi
if [ "${SYNC_GITHUB:-yes}" != "no" ]; then
  run_step "sync-github-project" "$AGENT_DIR/scripts/sync-github-project.sh" || fail=$((fail+1))
fi
{
  echo "status: $([ "$fail" -eq 0 ] && echo ok || echo attention)"
  echo "failed_steps: $fail"
  echo
  echo "Cron suggestion:"
  echo '```cron'
  "$0" --cron-line
  echo '```'
} >> "$REPORT"
cat "$REPORT"
if [ "${FISAM_ASYNC_STRICT:-no}" = "yes" ] && [ "$fail" -gt 0 ]; then exit 1; fi
