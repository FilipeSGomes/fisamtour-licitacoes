#!/usr/bin/env bash
# Testa endpoints do Apps Script após deploy.
set -euo pipefail

API_URL="${API_URL:-https://script.google.com/macros/s/AKfycbwcakddghwC4hQrfO7spmNHk-O4CEwZMYf227v_rNqwVFPXBnAbpCTMhy1EdPC2X_Sd/exec}"
TOKEN="${API_TOKEN:-fisam-licitacoes-2025-secreto}"
COMP="${COMPETENCIA:-2025-07}"
LIC="${LICITACAO_ID:-coren-ma}"

echo "=== op=options ==="
curl -fsSL "${API_URL}?op=options&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=list competencia=${COMP} ==="
curl -fsSL "${API_URL}?op=list&competencia=${COMP}&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=licitacoes (include_inativas=1) ==="
curl -fsSL "${API_URL}?op=licitacoes&include_inativas=1&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=tarifas licitacao_id=${LIC} ==="
curl -fsSL "${API_URL}?op=tarifas&licitacao_id=${LIC}&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=ordens competencia=${COMP} licitacao_id=${LIC} ==="
curl -fsSL "${API_URL}?op=ordens&competencia=${COMP}&licitacao_id=${LIC}&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=fatura competencia=${COMP} licitacao_id=${LIC} ==="
curl -fsSL "${API_URL}?op=fatura&competencia=${COMP}&licitacao_id=${LIC}&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "=== op=registros id=6-rcc-rs ==="
curl -fsSL "${API_URL}?op=registros&id=6-rcc-rs&token=${TOKEN}" | head -c 500
echo -e "\n"

echo "OK — se viu ok:true acima, a API está respondendo."
