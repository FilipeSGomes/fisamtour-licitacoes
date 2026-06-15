# RAG-MANIFEST
generated_at: 2026-06-12T19:51:41
files_indexed: 4
chunks_indexed: 13
files_changed: 0
files_unchanged: 4
files_skipped: 1
files_deleted: 0
chunk_lines: 120
chunk_overlap: 24
lexical_index: ok
semantic_index: ok
embedding_model: nomic-embed-text
embeddings_indexed: 13
sqlite_fts: ok

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
