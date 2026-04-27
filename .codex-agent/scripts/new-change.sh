#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_DIR"

TITLE="${1:-}"

if [ -z "$TITLE" ]; then
  echo "Uso:"
  echo "  ./.codex-agent/scripts/new-change.sh \"corrigir login quando senha expira\""
  exit 1
fi

SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
TS="$(date +"%Y%m%d%H%M%S")"
CONTRACT=".codex-agent/contracts/${TS}-${SLUG}.md"

cat > "$CONTRACT" <<EOF2
# Contrato de Mudança — $TITLE

## Status

RASCUNHO — não executar ainda.

## Objetivo

Descrever objetivamente o problema a resolver.

## Contexto

Descrever o contexto técnico e funcional.

## Arquivos permitidos para leitura

- A preencher

## Arquivos permitidos para alteração

- A preencher

## Arquivos proibidos

- A preencher

## Risco

Classificar: baixo, médio, alto, crítico.

## Plano de execução

1. A preencher
2. A preencher
3. A preencher

## Plano de teste

1. A preencher
2. A preencher
3. A preencher

## Plano de rollback

A preencher.

## Critérios de aceite

- A preencher

## Prompt de execução

Depois de aprovado, usar:
.codex-agent/prompts/99-template-correcao-segura.md
EOF2

echo "Contrato criado:"
echo "$CONTRACT"
