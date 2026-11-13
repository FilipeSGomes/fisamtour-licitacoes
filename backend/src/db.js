const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória");
}

const pool = new Pool({
  connectionString,
  max: 10,
  ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : false,
});

const DATE_OID = 1082;
const NUMERIC_OID = 1700;
const { types } = require("pg");
types.setTypeParser(DATE_OID, (value) => value);
types.setTypeParser(NUMERIC_OID, (value) => value);

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try { await client.query("rollback"); } catch (_) { /* conexão já caiu */ }
    throw err;
  } finally {
    client.release();
  }
}

async function withLock(client, key) {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [key]);
}

module.exports = { pool, query, withTransaction, withLock };
