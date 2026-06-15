#!/usr/bin/env bash
set -euo pipefail
YES="${1:-}"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
need() { command -v "$1" >/dev/null 2>&1 || echo "$1"; }
missing=""
for cmd in git curl sqlite3 node; do
  m="$(need "$cmd" || true)"
  [ -n "$m" ] && missing="$missing $m"
done
if [ -z "$missing" ]; then
  echo "Dependencias basicas OK."
else
  echo "Dependencias ausentes:$missing"
  if [ "$YES" != "--yes" ]; then
    echo "Rode novamente com: install-deps.sh --yes"
    exit 1
  fi
  if sudo -n true >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y git curl sqlite3 nodejs npm
  elif command -v apt-get >/dev/null 2>&1 && command -v dpkg-deb >/dev/null 2>&1 && printf '%s' "$missing" | grep -q 'sqlite3'; then
    mkdir -p "$AGENT_DIR/runtime/sqlite-download" "$AGENT_DIR/runtime/sqlite"
    (cd "$AGENT_DIR/runtime/sqlite-download" && apt-get download sqlite3 && dpkg-deb -x sqlite3_*.deb "$AGENT_DIR/runtime/sqlite")
    echo "sqlite3 instalado localmente em: $AGENT_DIR/runtime/sqlite/usr/bin/sqlite3"
    if printf '%s' "$missing" | grep -Eq '(^| )git|curl|node( |$)'; then
      echo "Algumas dependencias ainda precisam de instalacao do sistema:$missing"
    fi
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y git curl sqlite sqlite nodejs npm
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -Sy --noconfirm git curl sqlite nodejs npm
  elif command -v brew >/dev/null 2>&1; then
    brew install git curl sqlite node
  else
    echo "Gerenciador de pacotes nao detectado. Instale manualmente:$missing"
    exit 2
  fi
fi
if ! command -v ollama >/dev/null 2>&1; then
  if [ "$YES" = "--yes" ]; then
    if command -v curl >/dev/null 2>&1 && [ "$(uname -s 2>/dev/null)" = "Linux" ]; then
      curl -fsSL https://ollama.com/install.sh | sh
    else
      echo "Ollama nao detectado. Instale manualmente via https://ollama.com/download"
    fi
  else
    echo "Ollama nao detectado. Rode install-deps.sh --yes para tentar instalar automaticamente."
  fi
fi
if command -v ollama >/dev/null 2>&1; then
  MEM_MB="$(awk '/MemTotal/ { print int($2/1024) }' /proc/meminfo 2>/dev/null || echo 0)"
  if [ "${MEM_MB:-0}" -lt 8192 ]; then MODEL="llama3.2:3b"; else MODEL="llama3.1:8b"; fi
  PULL_LLM_MODEL="${FISAM_PULL_LLM_MODEL:-no}"
  PULL_EMBED_MODEL="${FISAM_PULL_EMBED_MODEL:-yes}"
  if [ "$YES" = "--yes" ]; then
    if [ "$PULL_LLM_MODEL" = "yes" ]; then
      ollama pull "$MODEL" || true
    else
      echo "Modelo local sugerido, nao baixado automaticamente: $MODEL"
      echo "Defina FISAM_PULL_LLM_MODEL=yes para baixar o modelo executor local."
    fi
    if [ "$PULL_EMBED_MODEL" = "yes" ]; then
      ollama pull nomic-embed-text || true
    else
      echo "Modelo de embedding sugerido, nao baixado: nomic-embed-text"
    fi
  else
    echo "Modelo local sugerido: $MODEL"
    echo "Modelo de embedding sugerido: nomic-embed-text"
  fi
fi
