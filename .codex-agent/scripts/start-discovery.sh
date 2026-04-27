#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

PROMPT_FILE=".codex-agent/prompts/00-descoberta-inicial.md"

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI não encontrado no PATH."
  echo "Instale/configure o Codex CLI antes de rodar."
  exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Prompt inicial não encontrado: $PROMPT_FILE"
  exit 1
fi

echo "Iniciando descoberta inicial com Codex..."
codex "$(< "$PROMPT_FILE")"
