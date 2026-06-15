#!/usr/bin/env bash
set -euo pipefail
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENT_DIR="$PROJECT/${FISAM_AGENT_DIR:-.fisam-ai}"
RAG="$AGENT_DIR/rag"
mkdir -p "$RAG"
cd "$PROJECT"
FILES="$RAG/files.tsv"
MANIFEST="$RAG/manifest.tsv"
CHUNKS="$RAG/chunks.jsonl"
CHUNKS_TSV="$RAG/chunks.tsv"
SYMBOLS="$RAG/symbols.tsv"
DELETED="$RAG/deleted.tsv"
PROFILE="$RAG/RAG-PROFILE.md"
EMBEDDINGS="$RAG/embeddings.jsonl"
EMBEDDINGS_TSV="$RAG/embeddings.tsv"
PREV_MANIFEST="$RAG/manifest.previous.tsv"
CONFIG="$AGENT_DIR/config/runtime.env"
CHUNK_LINES="${FISAM_RAG_CHUNK_LINES:-120}"
CHUNK_OVERLAP="${FISAM_RAG_CHUNK_OVERLAP:-24}"
MAX_FILE_BYTES="${FISAM_RAG_MAX_FILE_BYTES:-1048576}"
cfg() { grep -E "^$1=" "$CONFIG" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
EMBED_MODEL="${FISAM_EMBED_MODEL:-$(cfg embedding_model)}"
[ -n "$EMBED_MODEL" ] || EMBED_MODEL="nomic-embed-text"
OLLAMA_URL="${FISAM_OLLAMA_URL:-$(cfg ollama_base_url)}"
[ -n "$OLLAMA_URL" ] || OLLAMA_URL="http://127.0.0.1:11434"
EMBED_STATUS=unavailable
EMBED_COUNT=0
[ "$CHUNK_LINES" -gt 20 ] || CHUNK_LINES=120
[ "$CHUNK_OVERLAP" -lt "$CHUNK_LINES" ] || CHUNK_OVERLAP=24
[ -f "$MANIFEST" ] && cp "$MANIFEST" "$PREV_MANIFEST" || true
: > "$FILES"
: > "$MANIFEST"
: > "$CHUNKS"
: > "$CHUNKS_TSV"
: > "$SYMBOLS"
: > "$DELETED"
: > "$EMBEDDINGS"
: > "$EMBEDDINGS_TSV"
echo -e "path\tlines\tbytes\tlanguage" > "$FILES"
echo -e "path\tsha256\tlines\tbytes\tlanguage\tkind\tstatus" > "$MANIFEST"
echo -e "id\tpath\tlanguage\tkind\tstart_line\tend_line\tsha256\ttext" > "$CHUNKS_TSV"
echo -e "path\tline\tlanguage\tkind\tsymbol" > "$SYMBOLS"
echo -e "path\tprevious_sha256\tstatus" > "$DELETED"
echo -e "id\tmodel\tdimensions\tembedding" > "$EMBEDDINGS_TSV"
count=0
chunks=0
changed=0
unchanged=0
skipped=0
deleted=0
lang_of() {
  case "$1" in
    *.ts) echo typescript ;; *.tsx) echo tsx ;; *.js) echo javascript ;; *.jsx) echo jsx ;;
    *.py) echo python ;; *.go) echo go ;; *.rs) echo rust ;; *.java) echo java ;;
    *.kt|*.kts) echo kotlin ;; *.php) echo php ;; *.rb) echo ruby ;; *.cs) echo csharp ;;
    *.c) echo c ;; *.h) echo c-header ;; *.cpp|*.cc|*.cxx|*.hpp) echo cpp ;;
    *.sh|*.bash|*.zsh) echo shell ;; *.sql) echo sql ;; *.md|*.mdx) echo markdown ;;
    *.json) echo json ;; *.yaml|*.yml) echo yaml ;; *.toml) echo toml ;; *.xml) echo xml ;;
    *.html) echo html ;; *.css|*.scss|*.sass|*.less) echo css ;;
    Dockerfile|*/Dockerfile) echo dockerfile ;; Makefile|*/Makefile) echo makefile ;;
    *) echo text ;;
  esac
}
kind_of() {
  case "$1" in
    *test*|*spec*) echo test ;;
    *.md|*.mdx|README*|CHANGELOG*) echo docs ;;
    package.json|pyproject.toml|go.mod|Cargo.toml|pom.xml|build.gradle|composer.json|*.lock|*.yaml|*.yml|*.toml|*.json) echo config ;;
    Dockerfile|*/Dockerfile|docker-compose.*|terraform/*|infra/*|k8s/*|*.tf) echo infra ;;
    *) echo source ;;
  esac
}
json_escape() { sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g; s/\r$//; s/$/\\n/' | tr -d '\n'; }
json_string_escape() { sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g; s/\r$//'; }
tsv_escape() { sed 's/\\/\\\\/g; s/	/ /g; s/\r$//; s/$/\\n/' | tr -d '\n'; }
old_hash_for() { [ -f "$PREV_MANIFEST" ] || return 0; awk -F '\t' -v p="$1" 'NR > 1 && $1 == p { print $2; exit }' "$PREV_MANIFEST"; }
extract_symbols() {
  local f="$1" rel="$2" lang="$3" kind="$4"
  case "$lang" in
    python) awk -v p="$rel" -v l="$lang" -v k="$kind" '/^[[:space:]]*(def|class)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*/ { line=$0; sub(/^[[:space:]]*/, "", line); print p "\t" NR "\t" l "\t" k "\t" line }' "$f" >> "$SYMBOLS" ;;
    javascript|jsx|typescript|tsx) awk -v p="$rel" -v l="$lang" -v k="$kind" '/^[[:space:]]*(export[[:space:]]+)?(async[[:space:]]+)?function[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*/ || /^[[:space:]]*(export[[:space:]]+)?(const|let|var)[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*[[:space:]]*=/ || /^[[:space:]]*(export[[:space:]]+)?class[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*/ { line=$0; sub(/^[[:space:]]*/, "", line); print p "\t" NR "\t" l "\t" k "\t" line }' "$f" >> "$SYMBOLS" ;;
    go) awk -v p="$rel" -v l="$lang" -v k="$kind" '/^func[[:space:]]+/ || /^type[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+(struct|interface)/ { print p "\t" NR "\t" l "\t" k "\t" $0 }' "$f" >> "$SYMBOLS" ;;
    rust) awk -v p="$rel" -v l="$lang" -v k="$kind" '/^[[:space:]]*(pub[[:space:]]+)?(fn|struct|enum|trait|impl)[[:space:]]+/ { line=$0; sub(/^[[:space:]]*/, "", line); print p "\t" NR "\t" l "\t" k "\t" line }' "$f" >> "$SYMBOLS" ;;
    java|kotlin|csharp|php|ruby) awk -v p="$rel" -v l="$lang" -v k="$kind" '/class[[:space:]]+[A-Za-z_][A-Za-z0-9_]*/ || /function[[:space:]]+[A-Za-z_][A-Za-z0-9_]*/ { line=$0; sub(/^[[:space:]]*/, "", line); print p "\t" NR "\t" l "\t" k "\t" line }' "$f" >> "$SYMBOLS" ;;
  esac
}
while IFS= read -r f; do
  rel="${f#./}"
  case "$rel" in *.png|*.jpg|*.jpeg|*.gif|*.webp|*.pdf|*.zip|*.jar|*.sqlite|*.db|*.so|*.dylib|*.dll|*.exe|*.bin) skipped=$((skipped+1)); continue ;; esac
  if grep -Iq . "$f" 2>/dev/null; then :; else skipped=$((skipped+1)); continue; fi
  lines="$(wc -l < "$f" | tr -d ' ')"
  bytes="$(wc -c < "$f" | tr -d ' ')"
  [ "$bytes" -le "$MAX_FILE_BYTES" ] || { skipped=$((skipped+1)); continue; }
  sha="$(sha256sum "$f" 2>/dev/null | awk '{ print $1 }' || shasum -a 256 "$f" 2>/dev/null | awk '{ print $1 }' || cksum "$f" | awk '{ print $1 }')"
  lang="$(lang_of "$rel")"
  kind="$(kind_of "$rel")"
  old_sha="$(old_hash_for "$rel")"
  if [ -n "$old_sha" ] && [ "$old_sha" = "$sha" ]; then status=unchanged; unchanged=$((unchanged+1)); else status=changed; changed=$((changed+1)); fi
  printf "%s\t%s\t%s\t%s\n" "$rel" "$lines" "$bytes" "$lang" >> "$FILES"
  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$rel" "$sha" "$lines" "$bytes" "$lang" "$kind" "$status" >> "$MANIFEST"
  count=$((count+1))
  extract_symbols "$f" "$rel" "$lang" "$kind"
  start=1; step=$((CHUNK_LINES - CHUNK_OVERLAP)); [ "$step" -gt 0 ] || step="$CHUNK_LINES"
  while [ "$start" -le "$lines" ] || { [ "$lines" -eq 0 ] && [ "$start" -eq 1 ]; }; do
    end=$((start + CHUNK_LINES - 1)); [ "$end" -le "$lines" ] || end="$lines"; [ "$end" -ge "$start" ] || end="$start"
    chunks=$((chunks+1)); id="$(printf "%s:%s:%s" "$sha" "$start" "$end" | cksum | awk '{ printf "C%010d", $1 }')"
    rel_json="$(printf "%s" "$rel" | json_string_escape)"
    text_json="$(sed -n "${start},${end}p" "$f" | json_escape)"
    text_tsv="$(sed -n "${start},${end}p" "$f" | tsv_escape)"
    printf '{"id":"%s","path":"%s","language":"%s","kind":"%s","start_line":%s,"end_line":%s,"sha256":"%s","text":"%s"}\n' "$id" "$rel_json" "$lang" "$kind" "$start" "$end" "$sha" "$text_json" >> "$CHUNKS"
    printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$id" "$rel" "$lang" "$kind" "$start" "$end" "$sha" "$text_tsv" >> "$CHUNKS_TSV"
    [ "$end" -ge "$lines" ] && break
    start=$((start + step))
  done
done < <(find . -path './.git' -prune -o -path './node_modules' -prune -o -path './.fisam-ai*' -prune -o -path './.codex-agent*' -prune -o -type f -print | sort)
if [ -f "$PREV_MANIFEST" ]; then
  while IFS=$'\t' read -r old_path old_sha _rest; do
    [ "$old_path" = "path" ] && continue
    [ -z "$old_path" ] && continue
    if ! awk -F '\t' -v p="$old_path" 'NR > 1 && $1 == p { found=1 } END { exit found ? 0 : 1 }' "$MANIFEST"; then
      printf "%s\t%s\tdeleted\n" "$old_path" "$old_sha" >> "$DELETED"
      deleted=$((deleted+1))
    fi
  done < "$PREV_MANIFEST"
fi
{
  echo "# RAG-PROFILE"
  echo "generated_at: $(date +%Y-%m-%dT%H:%M:%S)"
  echo
  echo "## Linguagens"
  awk -F '\t' 'NR > 1 { c[$5]++ } END { for (k in c) print c[k], k }' "$MANIFEST" | sort -rn | head -30
  echo
  echo "## Tipos"
  awk -F '\t' 'NR > 1 { c[$6]++ } END { for (k in c) print c[k], k }' "$MANIFEST" | sort -rn
  echo
  echo "## Maiores arquivos indexados"
  awk -F '\t' 'NR > 1 { print $4, $1 }' "$MANIFEST" | sort -rn | head -20
  echo
  echo "## Simbolos por arquivo"
  awk -F '\t' 'NR > 1 { c[$1]++ } END { for (k in c) print c[k], k }' "$SYMBOLS" | sort -rn | head -30
} > "$PROFILE"
if [ "${FISAM_ENABLE_EMBEDDINGS:-yes}" = "yes" ] && command -v node >/dev/null 2>&1; then
  if FISAM_CHUNKS_TSV="$CHUNKS_TSV" FISAM_EMBEDDINGS="$EMBEDDINGS" FISAM_EMBEDDINGS_TSV="$EMBEDDINGS_TSV" FISAM_EMBED_MODEL="$EMBED_MODEL" FISAM_OLLAMA_URL="$OLLAMA_URL" node <<'NODE'
const fs = require('fs');
const http = require('http');
const https = require('https');
const chunksPath = process.env.FISAM_CHUNKS_TSV;
const outJsonl = process.env.FISAM_EMBEDDINGS;
const outTsv = process.env.FISAM_EMBEDDINGS_TSV;
const model = process.env.FISAM_EMBED_MODEL || 'nomic-embed-text';
const base = (process.env.FISAM_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
function unescapeText(s) { return String(s || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'); }
function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = lib.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', timeout: 30000, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) reject(new Error(data));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
 }
async function embed(text) {
  const r = await postJson(base + '/api/embeddings', { model, prompt: text.slice(0, 8000) });
  if (!Array.isArray(r.embedding)) throw new Error('missing embedding');
  return r.embedding;
 }
(async () => {
  const lines = fs.readFileSync(chunksPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(1);
  fs.writeFileSync(outJsonl, '');
  fs.writeFileSync(outTsv, 'id\tmodel\tdimensions\tembedding\n');
  for (const line of lines) {
    const parts = line.split('\t');
    const id = parts[0], path = parts[1], language = parts[2], kind = parts[3];
    const text = unescapeText(parts.slice(7).join('\t'));
    const vector = await embed([path, language, kind, text].join('\n'));
    fs.appendFileSync(outJsonl, JSON.stringify({ id, model, dimensions: vector.length, embedding: vector }) + '\n');
    fs.appendFileSync(outTsv, id + '\t' + model + '\t' + vector.length + '\t' + vector.join(',') + '\n');
  }
 })().catch(err => { console.error(err.message); process.exit(2); });
NODE
  then
    EMBED_STATUS=ok
    EMBED_COUNT="$(wc -l < "$EMBEDDINGS" | tr -d ' ')"
  else
    EMBED_STATUS=unavailable
    : > "$EMBEDDINGS"
    echo -e "id\tmodel\tdimensions\tembedding" > "$EMBEDDINGS_TSV"
  fi
fi
SQLITE_STATUS=unavailable
SQLITE_BIN="$(command -v sqlite3 || true)"
[ -z "$SQLITE_BIN" ] && [ -x "$AGENT_DIR/runtime/sqlite/usr/bin/sqlite3" ] && SQLITE_BIN="$AGENT_DIR/runtime/sqlite/usr/bin/sqlite3"
if [ -n "$SQLITE_BIN" ]; then
  rm -f "$RAG/rag.sqlite"
  "$SQLITE_BIN" "$RAG/rag.sqlite" <<SQL
CREATE TABLE chunks(id TEXT PRIMARY KEY, path TEXT, language TEXT, kind TEXT, start_line INTEGER, end_line INTEGER, sha256 TEXT, text TEXT);
CREATE TABLE files(path TEXT PRIMARY KEY, sha256 TEXT, lines INTEGER, bytes INTEGER, language TEXT, kind TEXT, status TEXT);
CREATE TABLE symbols(path TEXT, line INTEGER, language TEXT, kind TEXT, symbol TEXT);
CREATE TABLE embeddings(id TEXT PRIMARY KEY, model TEXT, dimensions INTEGER, embedding TEXT);
CREATE VIRTUAL TABLE chunks_fts USING fts5(id UNINDEXED, path, language, kind, text, tokenize='porter unicode61');
CREATE VIRTUAL TABLE symbols_fts USING fts5(path, language, kind, symbol, tokenize='porter unicode61');
.mode tabs
.import --skip 1 '$CHUNKS_TSV' chunks
.import --skip 1 '$MANIFEST' files
.import --skip 1 '$SYMBOLS' symbols
.import --skip 1 '$EMBEDDINGS_TSV' embeddings
INSERT INTO chunks_fts(id,path,language,kind,text) SELECT id,path,language,kind,text FROM chunks;
INSERT INTO symbols_fts(path,language,kind,symbol) SELECT path,language,kind,symbol FROM symbols;
CREATE INDEX idx_chunks_path ON chunks(path);
CREATE INDEX idx_chunks_language ON chunks(language);
CREATE INDEX idx_chunks_kind ON chunks(kind);
SQL
  SQLITE_STATUS=ok
fi
cat > "$RAG/RAG-MANIFEST.md" <<EOF
# RAG-MANIFEST
generated_at: $(date +%Y-%m-%dT%H:%M:%S)
files_indexed: $count
chunks_indexed: $chunks
files_changed: $changed
files_unchanged: $unchanged
files_skipped: $skipped
files_deleted: $deleted
chunk_lines: $CHUNK_LINES
chunk_overlap: $CHUNK_OVERLAP
lexical_index: $SQLITE_STATUS
semantic_index: $EMBED_STATUS
embedding_model: $EMBED_MODEL
embeddings_indexed: $EMBED_COUNT
sqlite_fts: $SQLITE_STATUS

## Artefatos
- manifest.tsv: hash/status incremental por arquivo.
- chunks.jsonl/chunks.tsv: chunks com overlap, linguagem e tipo.
- symbols.tsv: funcoes, classes e tipos detectados por heuristica.
- deleted.tsv: arquivos que existiam no indice anterior e sumiram.
- RAG-PROFILE.md: resumo por linguagem, tipo, tamanho e simbolos.
- embeddings.jsonl/embeddings.tsv: vetores locais quando Ollama/modelo de embedding estiver disponivel.
- rag.sqlite: camada lexical FTS5 e metadados quando sqlite3 estiver instalado.

## Modelo de recuperacao
- FTS/SQLite e apenas a camada lexical.
- Embeddings locais sao a camada semantica.
- RAG e o pipeline que combina lexical + semantico + evidencias para o LLM.
EOF
echo "RAG: files=$count chunks=$chunks sqlite_fts=$SQLITE_STATUS"
