const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function migrate(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória para migrar");
  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter((name) => /^\d+.+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    for (const filename of files) {
      const done = await client.query("select 1 from schema_migrations where filename = $1", [filename]);
      if (done.rowCount) continue;
      const sql = fs.readFileSync(path.join(dir, filename), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
        await client.query("commit");
        console.log("aplicada", filename);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${filename}: ${err.message}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
