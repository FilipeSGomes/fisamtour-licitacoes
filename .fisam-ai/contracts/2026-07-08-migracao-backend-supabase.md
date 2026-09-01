# Contrato — Migração do backend para Supabase (Postgres) + Vercel

**Data:** 2026-07-08
**Branch:** develop
**Autor:** Filipe Gomes (com Claude Code)

## Problema
Fechamentos de fatura incorretos. Causa raiz identificada: o backend atual
(`appScript/codigo.gs`, Google Sheets como banco) faz "ler tudo → recalcular em
memória → apagar → regravar" em `closeMonth`, `faturarOrdens_` e
`syncAllLancamentos_` sem `LockService` nem transação — duas operações
concorrentes podem se sobrescrever.

## Escopo desta mudança
- Mantido: frontend estático (`index.html`, `app.js`, `js/*.js`, `*.html`, `styles.css`) — sem reescrita.
- Novo: `backend/` — API Node/Express deployável como função serverless na Vercel,
  replicando o mesmo contrato `op=` que `js/api.js` já usa (GET querystring / POST JSON),
  de forma que a única mudança no frontend seja a URL/token em `js/api.js`.
- Novo: schema Postgres em `backend/migrations/schema.sql`, mapeado 1:1 das 10 abas da planilha.
- Novo: `backend/scripts/migrate-csv.js` para importar os CSVs já exportados em `appScript/csv/`.
- Correção de bug encontrado durante a migração: lançamentos gerados a partir de uma
  Ordem de Serviço gravavam `origem="Ordens_Servico"`, mas `app.js:103-124` compara
  com `origem === "ordem_servico"` — nunca batiam. Corrigido em `backend/lib/sync.js`.
- `closeMonth`, `faturarOrdens` e as operações que disparam `syncAllLancamentos`
  agora rodam em transação real (`BEGIN/COMMIT`) com `pg_advisory_xact_lock`,
  eliminando a condição de corrida da versão em Apps Script.

## Não incluído (fora do escopo)
- `appScript/codigo.gs` e a planilha do Google Sheets continuam existindo como
  fallback até a validação em produção; não foram apagados.
- Autenticação segue com token estático (mesmo modelo atual) — recomendação de
  evolução futura para Supabase Auth, não implementada aqui.
- Integração com compras.gov.br / API PCP (fora do escopo desta mudança).

## Como validar
Ver `backend/README.md` — criar projeto Supabase, rodar `schema.sql`, importar CSVs,
deployar `backend/` na Vercel, atualizar `js/api.js` com a URL/token novos.
