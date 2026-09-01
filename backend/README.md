# Backend FISAMTOUR — Node/Express + Supabase (Postgres)

Substitui `appScript/codigo.gs` (Google Sheets). Mesmo contrato de API que
`js/api.js` já usa (`op=` via GET querystring ou POST JSON) — o frontend
(`index.html`, `app.js`, `js/*.js`, `fatura.html`, etc.) **não precisa mudar**,
só a `API_URL`/`API_TOKEN` em [`js/api.js`](../js/api.js).

## Por que essa mudança

O fechamento de mês (`closeMonth`) e o faturamento de OS (`faturarOrdens_`) no
Apps Script liam a planilha inteira, recalculavam em memória e regravavam —
em 3-4 chamadas separadas, sem lock. Duas pessoas fechando o mesmo mês ao
mesmo tempo podiam se sobrescrever. Aqui essas operações rodam dentro de uma
transação Postgres real com `pg_advisory_xact_lock` (ver `lib/lancamentos.js`
e `lib/ordens.js`), o que resolve a causa raiz.

## Passo 1 — Criar o projeto Supabase

1. Crie um projeto em https://supabase.com.
2. Em **Project Settings → Database → Connection string → URI**, copie a
   connection string (prefira a porta `6543`/pooler, funciona melhor em serverless).
3. Rode o schema:
   ```bash
   psql "$DATABASE_URL" -f migrations/schema.sql
   ```
   (ou cole o conteúdo de `migrations/schema.sql` no SQL Editor do Supabase)

## Passo 2 — Importar os dados atuais

Os CSVs já exportados da planilha (`appScript/csv/`) são a fonte de verdade atual.

```bash
cd backend
npm install
cp .env.example .env   # preencha DATABASE_URL
npm run migrate:csv
```

## Passo 3 — Rodar localmente (opcional, para testar antes do deploy)

```bash
npm run dev
# API em http://localhost:3001
curl "http://localhost:3001/?op=options&token=SEU_TOKEN"
```

## Passo 4 — Deploy na Vercel

```bash
cd backend
npx vercel        # primeiro deploy (preview)
npx vercel --prod # produção
```

Configure as env vars no dashboard da Vercel (Project Settings → Environment Variables),
usando `backend/.env.example` como referência: `DATABASE_URL`, `API_TOKEN`, `ALLOWED_ORIGINS`.

`ALLOWED_ORIGINS` deve incluir `https://ponto.fisamtour.com` (domínio do GitHub Pages, ver `CNAME`).

## Passo 5 — Apontar o frontend para o novo backend

Em [`js/api.js`](../js/api.js), atualize:
```js
API_URL: "https://SEU-PROJETO.vercel.app/api",
API_TOKEN: "MESMO_TOKEN_DA_VERCEL",
```

Recomenda-se **trocar o token** — o valor atual (`fisam-licitacoes-2025-secreto`)
já está exposto no histórico do git desde o Apps Script.

## Passo 6 — Validar

Abra o site (GitHub Pages) e confira: dashboard carrega lançamentos do mês,
criar/editar OS, fatura.html monta e confirma faturamento, `licitacoes.html`
fecha o mês. Compare os totais com o que a planilha antiga mostrava antes de
desativar o Apps Script.

Só depois de validar em produção, considere remover `appScript/` (mantido por
enquanto como fallback).

## Estrutura

```
backend/
  api/index.js        # rotas Express — espelha doGet/doPost do Apps Script
  lib/
    db.js              # pool pg + helpers de transação/lock
    helpers.js          # toNumber, normalizePago, competenciaFromDate, etc.
    catalogo.js          # licitações, fornecedores, tarifas, passageiros
    registros.js          # reg_passagens/hospedagem/veiculo (CRUD)
    ordens.js               # ordens de serviço + faturamento
    lancamentos.js            # dashboard + fechamento de mês
    sync.js                     # regenera lançamentos a partir de registros/OS
  migrations/schema.sql  # DDL Postgres (mapeado das 10 abas da planilha)
  scripts/migrate-csv.js # importa appScript/csv/*.csv para o Postgres
```

## Endpoints (idênticos ao Apps Script, ver `appScript/README.md`)

GET `?op=list|options|licitacoes|registros|passageiros|tarifas|ordens|fatura|faturaPreview`
POST `{op: "add"|"update"|"delete"|"closeMonth"|"saveRegistros"|"syncLancamentos"|"saveOrdem"|"deleteOrdem"|"saveLicitacao"|"saveFornecedor"|"saveTarifa"|"updateRegistroPago"|"deleteRegistro"|"faturarOrdens"}`
