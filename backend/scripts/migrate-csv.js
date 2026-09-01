// Importa os CSVs em appScript/csv/ (fonte de verdade atual, exportada do Google Sheets)
// para o Postgres. Rodar uma vez, depois de aplicar migrations/schema.sql.
//
//   DATABASE_URL=postgres://... node scripts/migrate-csv.js
//
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { Pool } = require("pg");

const CSV_DIR = path.join(__dirname, "..", "..", "appScript", "csv");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

// competencia é 'YYYY-MM' texto puro, então não precisa de tratamento numérico.
const NUMERIC_HINTS = [
  "valor", "custo", "lucro", "percentil", "diarias", "refeicoes", "vlr_diaria",
  "prev_vlr_refeicao", "vlr_total", "custo_hospedagem", "custo_refeicao", "custo_tt",
  "total_receitas", "total_despesas", "saldo",
];

function toNumberOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadCsv(filename) {
  const filePath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

async function importTable(client, table, rows, { numericCols = [] } = {}) {
  if (!rows.length) {
    console.log(`  ${table}: 0 linhas (CSV vazio ou ausente)`);
    return;
  }
  const cols = Object.keys(rows[0]);
  let count = 0;

  for (const row of rows) {
    const values = cols.map((c) => {
      if (numericCols.includes(c) || NUMERIC_HINTS.includes(c)) return toNumberOrNull(row[c]) ?? 0;
      return row[c] ?? "";
    });
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(",");
    const conflictTarget = table === "fechamentos" ? "competencia" : "id";

    await client.query(
      `insert into ${table} (${cols.join(",")}) values (${placeholders})
       on conflict (${conflictTarget}) do update set ${updates}`,
      values
    );
    count++;
  }
  console.log(`  ${table}: ${count} linhas importadas`);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Importando CSVs de", CSV_DIR);
    await client.query("BEGIN");

    // Ordem importa por causa das foreign keys (licitacoes primeiro).
    await importTable(client, "licitacoes", loadCsv("Catalogo_Licitacoes.csv"));
    await importTable(client, "fornecedores", loadCsv("Catalogo_Fornecedores.csv"));
    await importTable(client, "tarifas", loadCsv("Catalogo_Tarifas.csv"));
    await importTable(client, "passageiros", loadCsv("passageiros.csv"));
    await importTable(client, "reg_passagens", loadCsv("reg_passagens.csv"));
    await importTable(client, "reg_hospedagem", loadCsv("reg_hospedagem.csv"));
    await importTable(client, "reg_veiculo", loadCsv("reg_veiculo.csv"));
    await importTable(client, "ordens_servico", loadCsv("Ordens_Servico.csv"));
    await importTable(client, "lancamentos", loadCsv("Lancamentos.csv"));
    await importTable(client, "fechamentos", loadCsv("Fechamentos.csv"));

    await client.query("COMMIT");
    console.log("Migração concluída.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Falhou, nada foi gravado:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
