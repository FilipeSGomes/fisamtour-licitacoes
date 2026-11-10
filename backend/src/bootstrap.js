const { query, withTransaction } = require("./db");
const { hashPassword } = require("./password");
const { audit } = require("./audit");

async function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) return { created: false };
  const count = await query("select count(*)::int as n from users");
  if (count.rows[0].n > 0) return { created: false };
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD precisa de pelo menos 10 caracteres");
  }
  const nome = String(process.env.ADMIN_NOME || "Administrador").trim() || "Administrador";
  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    const inserted = await client.query(
      "insert into users (nome, email, password_hash) values ($1, $2, $3) returning id",
      [nome, email, passwordHash]
    );
    const userId = inserted.rows[0].id;
    const linked = await client.query(
      `insert into user_roles (user_id, role_id)
       select $1, id from roles where codigo = 'admin'
       returning role_id`,
      [userId]
    );
    if (!linked.rowCount) throw new Error("Papel admin não encontrado. Rode as migrações.");
    await audit(client, {
      userId,
      entity: "users",
      entityId: userId,
      action: "criar",
      changes: { nome, email, origem: "bootstrap" },
    });
  });
  console.log("Administrador inicial criado");
  return { created: true };
}

module.exports = { ensureAdmin };
