#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
CHUNKS="$AGENT_DIR/rag/chunks.jsonl"
QUERY="${1:-}"
LIMIT="${2:-10}"
[ -n "$QUERY" ] || { echo "Uso: query-rag.sh termo [limite]"; exit 1; }
case "$LIMIT" in ''|*[!0-9]*) LIMIT=10 ;; esac
[ -f "$CHUNKS" ] || { echo "RAG nao encontrado. Rode build-rag.sh."; exit 2; }
if [ -s "$AGENT_DIR/rag/embeddings.jsonl" ] && command -v node >/dev/null 2>&1; then
  CONFIG="$AGENT_DIR/config/runtime.env"
  cfg() { grep -E "^$1=" "$CONFIG" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
  EMBED_MODEL="${FISAM_EMBED_MODEL:-$(cfg embedding_model)}"; [ -n "$EMBED_MODEL" ] || EMBED_MODEL="nomic-embed-text"
  OLLAMA_URL="${FISAM_OLLAMA_URL:-$(cfg ollama_base_url)}"; [ -n "$OLLAMA_URL" ] || OLLAMA_URL="http://127.0.0.1:11434"
  if FISAM_QUERY="$QUERY" FISAM_LIMIT="$LIMIT" FISAM_CHUNKS_TSV="$AGENT_DIR/rag/chunks.tsv" FISAM_SYMBOLS="$AGENT_DIR/rag/symbols.tsv" FISAM_EMBEDDINGS="$AGENT_DIR/rag/embeddings.jsonl" FISAM_EMBED_MODEL="$EMBED_MODEL" FISAM_OLLAMA_URL="$OLLAMA_URL" node <<'NODE'
const fs = require('fs');
const http = require('http');
const https = require('https');
const query = process.env.FISAM_QUERY || '';
const limit = Number(process.env.FISAM_LIMIT || 10);
const model = process.env.FISAM_EMBED_MODEL || 'nomic-embed-text';
const base = (process.env.FISAM_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
function unescapeText(s) { return String(s || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); }
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), lib = u.protocol === 'https:' ? https : http, body = JSON.stringify(payload);
    const req = lib.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', timeout: 30000, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { const j = JSON.parse(data); res.statusCode >= 400 ? reject(new Error(data)) : resolve(j); } catch(e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(body);
  });
 }
function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/(Math.sqrt(aa)*Math.sqrt(bb)):0;}
function terms(s){return String(s).toLowerCase().split(/[^a-z0-9_./:-]+/).filter(Boolean);}
(async()=>{
  const qv = (await postJson(base + '/api/embeddings', { model, prompt: query })).embedding;
  if (!Array.isArray(qv)) throw new Error('missing query embedding');
  const chunks = new Map();
  for (const line of fs.readFileSync(process.env.FISAM_CHUNKS_TSV,'utf8').split(/\r?\n/).filter(Boolean).slice(1)) {
    const p=line.split('\t'); chunks.set(p[0], {id:p[0],path:p[1],language:p[2],kind:p[3],start:p[4],end:p[5],text:unescapeText(p.slice(7).join('\t'))});
  }
  const symbolText = fs.existsSync(process.env.FISAM_SYMBOLS) ? fs.readFileSync(process.env.FISAM_SYMBOLS,'utf8').toLowerCase() : '';
  const qterms = terms(query);
  const rows=[];
  for (const line of fs.readFileSync(process.env.FISAM_EMBEDDINGS,'utf8').split(/\r?\n/).filter(Boolean)) {
    const e=JSON.parse(line), c=chunks.get(e.id); if(!c) continue;
    const low=(c.path+' '+c.language+' '+c.kind+' '+c.text).toLowerCase();
    let lexical=0; for(const t of qterms) if(low.includes(t)) lexical += 1;
    const symbolBoost = qterms.some(t => symbolText.includes(t) && c.path.toLowerCase().includes(c.path.toLowerCase())) ? 1.2 : 0;
    const kindBoost = ['source','config'].includes(c.kind) ? 0.3 : 0;
    const semantic = cosine(qv, e.embedding);
    const score = semantic * 10 + lexical * 1.5 + symbolBoost + kindBoost;
    rows.push({score, semantic, lexical, c});
  }
  rows.sort((a,b)=>b.score-a.score);
  for (const r of rows.slice(0, limit)) {
    const snippet = r.c.text.replace(/\s+/g,' ').slice(0,260);
    console.log('\nscore=' + r.score.toFixed(3) + ' semantic=' + r.semantic.toFixed(3) + ' lexical=' + r.lexical + ' [SEMANTIC] ' + r.c.path + ':' + r.c.start + '-' + r.c.end + ' lang=' + r.c.language + ' kind=' + r.c.kind + '\n' + snippet);
  }
})().catch(err=>{ console.error(err.message); process.exit(2); });
NODE
  then
    exit 0
  fi
fi
SQLITE_BIN="$(command -v sqlite3 || true)"
[ -z "$SQLITE_BIN" ] && [ -x "$AGENT_DIR/runtime/sqlite/usr/bin/sqlite3" ] && SQLITE_BIN="$AGENT_DIR/runtime/sqlite/usr/bin/sqlite3"
if [ -f "$AGENT_DIR/rag/rag.sqlite" ] && [ -n "$SQLITE_BIN" ]; then
  SAFE_QUERY="$(printf "%s" "$QUERY" | tr -cs '[:alnum:]_./:-' ' ' | sed 's/^ *//;s/ *$//;s/ / OR /g;s/'"'"'/''/g')"
  [ -n "$SAFE_QUERY" ] || SAFE_QUERY="$(printf "%s" "$QUERY" | sed "s/'/''/g")"
  "$SQLITE_BIN" -separator $'\t' "$AGENT_DIR/rag/rag.sqlite" <<SQL | awk -F '\t' '{ printf "\nscore=%s [%s] %s:%s-%s lang=%s kind=%s\n%s\n", $1, $2, $3, $4, $5, $6, $7, $8 }'
WITH chunk_hits AS (
  SELECT c.id, c.path, c.start_line, c.end_line, c.language, c.kind,
         snippet(chunks_fts, 4, '[', ']', ' ... ', 24) AS snippet,
         bm25(chunks_fts) AS rank,
         CASE WHEN c.path LIKE '%' || replace('$SAFE_QUERY',' OR ','%') || '%' THEN 2.0 ELSE 0 END AS path_boost,
         CASE WHEN c.kind IN ('source','config') THEN 0.4 ELSE 0 END AS kind_boost
  FROM chunks_fts
  JOIN chunks c ON c.id = chunks_fts.id
  WHERE chunks_fts MATCH '$SAFE_QUERY'
),
symbol_hits AS (
  SELECT NULL AS id, s.path, s.line AS start_line, s.line AS end_line, s.language, s.kind,
         s.symbol AS snippet,
         bm25(symbols_fts) - 1.5 AS rank,
         1.5 AS path_boost,
         0.8 AS kind_boost
  FROM symbols_fts
  JOIN symbols s ON s.path = symbols_fts.path AND s.symbol = symbols_fts.symbol
  WHERE symbols_fts MATCH '$SAFE_QUERY'
)
SELECT printf('%.3f', 10 - rank + path_boost + kind_boost) AS score,
       COALESCE(id, 'SYMBOL'), path, start_line, end_line, language, kind, snippet
FROM (
  SELECT * FROM chunk_hits
  UNION ALL
  SELECT * FROM symbol_hits
)
ORDER BY (rank - path_boost - kind_boost) ASC
LIMIT $LIMIT;
SQL
  exit 0
fi
{
  if [ -f "$AGENT_DIR/rag/symbols.tsv" ]; then
    awk -F '\t' -v q="$(printf "%s" "$QUERY" | tr '[:upper:]' '[:lower:]')" '
      BEGIN { n=split(q, terms, /[[:space:]]+/) }
      NR > 1 {
        low=tolower($0); score=4
        for (i=1; i<=n; i++) if (terms[i] != "" && index(low, terms[i]) > 0) score += 3
        if (score > 4) printf "%06d\tSYMBOL\t%s:%s\t%s\n", score, $1, $2, $5
      }
    ' "$AGENT_DIR/rag/symbols.tsv"
  fi
  awk -v q="$(printf "%s" "$QUERY" | tr '[:upper:]' '[:lower:]')" '
    BEGIN { n=split(q, terms, /[[:space:]]+/) }
    {
      low=tolower($0); score=0
      for (i=1; i<=n; i++) if (terms[i] != "" && index(low, terms[i]) > 0) score++
      if (score > 0) printf "%06d\tCHUNK\t%s\n", score, $0
    }
  ' "$CHUNKS"
} | sort -rn | head -"$LIMIT" | cut -f2-
