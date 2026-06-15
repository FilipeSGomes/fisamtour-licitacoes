#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
CONFIG="$AGENT_DIR/config/runtime.env"
CONTRACTS="$AGENT_DIR/sdd/05-change-contracts.md"
BACKLOG="$AGENT_DIR/sdd/07-backlog.md"
REPORT="$AGENT_DIR/reports/GITHUB-PROJECT-SYNC.md"
mkdir -p "$AGENT_DIR/reports" "$AGENT_DIR/runtime/github-sync"
cfg() { grep -E "^$1=" "$CONFIG" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
remote_repo() {
  git -C "$PROJECT" remote get-url origin 2>/dev/null |
    sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##'
}
OWNER="${FISAM_GITHUB_OWNER:-$(cfg github_owner)}"
PROJECT_NUMBER="${FISAM_GITHUB_PROJECT_NUMBER:-$(cfg github_project_number)}"
REPO="${FISAM_GITHUB_REPO:-$(cfg github_repo)}"
[ -n "$REPO" ] || REPO="$(remote_repo)"
if [ -z "$OWNER" ] && [ -n "$REPO" ]; then OWNER="${REPO%%/*}"; fi
if [ -z "$PROJECT_NUMBER" ]; then PROJECT_NUMBER="${FISAM_GITHUB_PROJECT:-}"; fi
{
  echo "# GITHUB-PROJECT-SYNC"
  echo "generated_at: $(date +%Y-%m-%dT%H:%M:%S)"
  echo "repo: ${REPO:-unknown}"
  echo "owner: ${OWNER:-unknown}"
  echo "project_number: ${PROJECT_NUMBER:-unset}"
  echo
} > "$REPORT"
SYNC_ITEMS="$AGENT_DIR/runtime/github-sync/items.tsv"
if [ -f "$BACKLOG" ] && grep -q '^- ID: BLG-' "$BACKLOG"; then
  awk '
    BEGIN { id=""; status=""; tipo=""; prio=""; titulo=""; valor="" }
    /^- ID: / { flush(); id=$3; status=""; tipo=""; prio=""; titulo=""; valor=""; next }
    /^  - Status: / { sub(/^  - Status: /,""); status=$0; next }
    /^  - Tipo: / { sub(/^  - Tipo: /,""); tipo=$0; next }
    /^  - Prioridade: / { sub(/^  - Prioridade: /,""); prio=$0; next }
    /^  - Titulo: / { sub(/^  - Titulo: */,""); titulo=$0; next }
    /^  - Valor: / { sub(/^  - Valor: */,""); valor=$0; next }
    function flush() {
      if (id != "" && titulo != "" && titulo !~ /^$/) {
        printf "%s\t%s\t%s\t%s\t%s\t%s\n", id, status, prio, titulo, tipo, valor
      }
    }
    END { flush() }
  ' "$BACKLOG" > "$SYNC_ITEMS"
  source_doc=".fisam-ai/sdd/07-backlog.md"
elif [ ! -f "$CONTRACTS" ]; then
  echo "status: blocked" >> "$REPORT"
  echo "reason: sdd/05-change-contracts.md ausente" >> "$REPORT"
  cat "$REPORT"
  exit 1
else
  awk '
    BEGIN { id=""; status=""; risco=""; objetivo="" }
    /^- ID: / { flush(); id=$3; status=""; risco=""; objetivo=""; next }
    /^- Status: / { sub(/^- Status: /,""); status=$0; next }
    /^- Risco: / { sub(/^- Risco: /,""); risco=$0; next }
    /^- Objetivo: / { sub(/^- Objetivo: */,""); objetivo=$0; next }
    function flush() {
      if (id != "" && objetivo != "" && objetivo !~ /^$/) {
        printf "%s\t%s\t%s\t%s\tcontract\tContrato de mudanca\n", id, status, risco, objetivo
      }
    }
    END { flush() }
  ' "$CONTRACTS" > "$SYNC_ITEMS"
  source_doc=".fisam-ai/sdd/05-change-contracts.md"
fi
count="$(wc -l < "$SYNC_ITEMS" | tr -d ' ')"
echo "items_detected: $count" >> "$REPORT"
echo "source_doc: $source_doc" >> "$REPORT"
if [ "$count" -eq 0 ]; then
  echo "status: no_action" >> "$REPORT"
  echo "reason: nenhum item acionavel preenchido para sincronizar" >> "$REPORT"
  cat "$REPORT"
  exit 0
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "status: blocked" >> "$REPORT"
  echo "reason: gh CLI ausente" >> "$REPORT"
  cat "$REPORT"
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "status: blocked" >> "$REPORT"
  echo "reason: gh CLI sem autenticacao; rode gh auth login ou defina GH_TOKEN" >> "$REPORT"
  cat "$REPORT"
  exit 1
fi
if [ -z "$REPO" ] || [ -z "$OWNER" ] || [ -z "$PROJECT_NUMBER" ]; then
  echo "status: blocked" >> "$REPORT"
  echo "reason: configure github_owner/github_project_number/github_repo ou variaveis FISAM_GITHUB_*" >> "$REPORT"
  cat "$REPORT"
  exit 1
fi
synced=0
while IFS=$'\t' read -r id status priority title_text item_type value_text; do
  title="[$id] $title_text"
  existing="$(gh issue list --repo "$REPO" --state all --search "$id in:title" --json number --jq '.[0].number // empty' 2>/dev/null || true)"
  if [ -n "$existing" ]; then
    issue="$existing"
    echo "- reused issue #$issue: $title" >> "$REPORT"
  else
    body_file="$AGENT_DIR/runtime/github-sync/$id-body.md"
    cat > "$body_file" <<EOF
Item: $id
Status: $status
Prioridade/Risco: $priority
Tipo: $item_type

$value_text

Fonte: $source_doc

Criado por sync-github-project.sh.
EOF
    issue_url="$(gh issue create --repo "$REPO" --title "$title" --body-file "$body_file")"
    issue="$(printf '%s\n' "$issue_url" | sed -E 's#.*/issues/([0-9]+).*#\1#')"
    echo "- created issue #$issue: $title" >> "$REPORT"
  fi
  url="https://github.com/$REPO/issues/$issue"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$url" >/dev/null 2>&1 || {
    echo "- warn: nao foi possivel adicionar #$issue ao project $OWNER/$PROJECT_NUMBER" >> "$REPORT"
    continue
  }
  synced=$((synced+1))
done < "$SYNC_ITEMS"
echo "status: ok" >> "$REPORT"
echo "items_synced: $synced" >> "$REPORT"
cat "$REPORT"
