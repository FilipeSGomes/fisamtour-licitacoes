#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
REPORT="$AGENT_DIR/reports/GOVERNANCE-AUDIT.md"
CONTRACTS="$AGENT_DIR/sdd/05-change-contracts.md"
VALIDATION="$AGENT_DIR/sdd/06-validation-plan.md"
mkdir -p "$AGENT_DIR/reports"
fail=0
warn=0
note() { printf '%s\n' "$*" >> "$REPORT"; }
reset_report() {
  {
    echo "# GOVERNANCE-AUDIT"
    echo "generated_at: $(date +%Y-%m-%dT%H:%M:%S)"
    echo
  } > "$REPORT"
}
check_file() {
  if [ -f "$1" ]; then note "- ok: $2"; else note "- fail: $2 ausente ($1)"; fail=$((fail+1)); fi
}
reset_report
note "## Estrutura"
check_file "$AGENT_DIR/PROJECT-CONTEXT.md" "contexto do projeto"
check_file "$AGENT_DIR/BRIEFING.md" "briefing"
check_file "$AGENT_DIR/rag/RAG-MANIFEST.md" "manifesto RAG"
check_file "$AGENT_DIR/orchestration/agent-plan.json" "plano de agentes"
check_file "$CONTRACTS" "contratos de mudanca"
check_file "$VALIDATION" "plano de validacao"
note
note "## RAG"
if [ -f "$AGENT_DIR/rag/RAG-MANIFEST.md" ]; then
  lexical="$(awk -F ': ' '$1=="lexical_index" { print $2; exit }' "$AGENT_DIR/rag/RAG-MANIFEST.md")"
  semantic="$(awk -F ': ' '$1=="semantic_index" { print $2; exit }' "$AGENT_DIR/rag/RAG-MANIFEST.md")"
  note "- lexical_index: ${lexical:-unknown}"
  note "- semantic_index: ${semantic:-unknown}"
  if [ "${semantic:-unavailable}" != "ok" ]; then note "- warn: camada semantica indisponivel; RAG fica limitado para busca conceitual"; warn=$((warn+1)); fi
fi
note
note "## Contratos"
contract_count=0
approved_count=0
if [ -f "$CONTRACTS" ]; then
  contract_count="$(grep -Ec '^[-# ]*ID: CHG-|^## Contrato' "$CONTRACTS" || true)"
  approved_count="$(grep -Eic 'Status: *(approved|implemented|validated)' "$CONTRACTS" || true)"
  note "- contratos_detectados: $contract_count"
  note "- contratos_aprovados_ou_finalizados: $approved_count"
fi
note
note "## Git working tree"
changed=0
if command -v git >/dev/null 2>&1 && git -C "$PROJECT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed="$(git -C "$PROJECT" status --porcelain --untracked-files=all | awk '{ print $2 }' | grep -Ev '^(.fisam-ai|.codex-agent)(/|$)' | wc -l | tr -d ' ')"
  note "- arquivos_alterados_fora_governance: $changed"
  if [ "$changed" -gt 0 ] && [ "$approved_count" -eq 0 ]; then
    note "- fail: ha mudancas fora da governanca sem contrato aprovado/implementado/validado"
    fail=$((fail+1))
  fi
else
  note "- warn: projeto nao esta em git; auditoria de diff indisponivel"
  warn=$((warn+1))
fi
note
note "## Validacao"
if [ -f "$VALIDATION" ] && grep -Eq 'Resultado:|Comando:' "$VALIDATION"; then
  note "- ok: plano de validacao contem campos de evidencia"
else
  note "- warn: plano de validacao ainda nao tem evidencia preenchida"
  warn=$((warn+1))
fi
note
if [ "$fail" -eq 0 ]; then
  note "status: pass"
else
  note "status: fail"
fi
note "warnings: $warn"
note "failures: $fail"
cat "$REPORT"
if [ "${FISAM_AUDIT_STRICT:-no}" = "yes" ] && [ "$fail" -gt 0 ]; then exit 1; fi
