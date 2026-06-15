#!/usr/bin/env bash
set -euo pipefail
ROLE="${1:-}"
PROMPT_INPUT="${2:-}"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
CONFIG="$AGENT_DIR/config/runtime.env"
[ -n "$ROLE" ] && [ -n "$PROMPT_INPUT" ] || { echo "Uso: run-prompt.sh planner prompt.md"; exit 1; }
cfg() { grep -E "^$1=" "$CONFIG" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
runtime="${FISAM_RUNTIME:-}"; [ -n "$runtime" ] || runtime="$(cfg "${ROLE}_runtime")"; [ -n "$runtime" ] || runtime="$(cfg primary_runtime)"
model="${FISAM_MODEL:-}"; [ -n "$model" ] || model="$(cfg "${ROLE}_model")"; [ -n "$model" ] || model="$(cfg primary_model)"
if [ -f "$PROMPT_INPUT" ]; then prompt="$(cat "$PROMPT_INPUT")"; elif [ -f "$AGENT_DIR/$PROMPT_INPUT" ]; then prompt="$(cat "$AGENT_DIR/$PROMPT_INPUT")"; else prompt="$PROMPT_INPUT"; fi
case "$runtime" in  codex) codex exec -C "$PROJECT" "$prompt" ;;
  claude) claude -p "$prompt" ;;
  ollama) printf '%s\n' "$prompt" | ollama run "${model:-llama3.1:8b}" ;;
  cursor) echo "Cursor runtime configurado. Abra o projeto no Cursor e use este prompt:"; printf '%s\n' "$prompt" ;;
  copilot) echo "Copilot runtime configurado. Use este prompt no Copilot Chat/Agent:"; printf '%s\n' "$prompt" ;;
  shell) printf '%s\n' "$prompt" ;;
  *) echo "Runtime desconhecido: $runtime"; exit 2 ;;
esac
