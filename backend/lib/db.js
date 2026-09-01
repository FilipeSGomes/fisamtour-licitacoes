const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 5,
});

async function query(text, params) {
  return pool.query(text, params);
}

// Roda `fn` dentro de uma transação real (BEGIN/COMMIT/ROLLBACK).
// Isso é o que faltava no Apps Script: lá, "ler tudo -> recalcular -> apagar -> regravar"
// eram 3-4 chamadas separadas à planilha, sem atomicidade nem lock — a causa mais provável
// dos fechamentos/faturamentos incorretos quando duas operações coincidem.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Serializa operações concorrentes sobre a mesma chave lógica (ex: "closeMonth:2025-07")
// usando advisory lock do Postgres, liberado automaticamente no fim da transação.
async function withLock(client, key) {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [key]);
}

module.exports = { pool, query, withTransaction, withLock };
