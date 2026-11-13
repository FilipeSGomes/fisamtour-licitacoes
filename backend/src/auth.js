const { createHash, randomBytes } = require("crypto");
const { query } = require("./db");
const { hashPassword, verifyPassword } = require("./password");
const { httpError } = require("./errors");
const { audit } = require("./audit");

const SESSION_MS = 12 * 60 * 60 * 1000;
const loginAttempts = new Map();

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return "";
}

function sessionCookie(token) {
  const secure = process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
  const maxAge = Math.floor(SESSION_MS / 1000);
  return `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function clearCookie() {
  const secure = process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
  return `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function assertLoginRate(ip) {
  const now = Date.now();
  const slot = loginAttempts.get(ip) || { count: 0, reset: now + 10 * 60 * 1000 };
  if (now > slot.reset) {
    slot.count = 0;
    slot.reset = now + 10 * 60 * 1000;
  }
  slot.count += 1;
  loginAttempts.set(ip, slot);
  if (slot.count > 20) throw httpError(429, "Muitas tentativas de login. Aguarde e tente de novo.");
}

async function loadUser(userId) {
  const userRes = await query(
    "select id, nome, email, status from users where id = $1",
    [userId]
  );
  const user = userRes.rows[0];
  if (!user || user.status !== "ativo") return null;
  const permRes = await query(
    `select p.codigo
     from user_roles ur
     join role_permissions rp on rp.role_id = ur.role_id
     join permissions p on p.id = rp.permission_id
     where ur.user_id = $1`,
    [userId]
  );
  user.permissions = permRes.rows.map((row) => row.codigo);
  return user;
}

async function userFromRequest(req) {
  const token = readCookie(req, "sid");
  if (!token) return null;
  const res = await query(
    `select user_id from sessions
     where token_hash = $1 and expires_at > now()`,
    [hashToken(token)]
  );
  if (!res.rows[0]) return null;
  return loadUser(res.rows[0].user_id);
}

function requireAuth(req, res, next) {
  userFromRequest(req).then((user) => {
    if (!user) {
      res.status(401).json({ ok: false, error: "Não autenticado" });
      return;
    }
    req.user = user;
    next();
  }).catch(next);
}

function requirePerm(codigo) {
  return (req, res, next) => {
    if (req.user?.permissions?.includes(codigo)) return next();
    res.status(403).json({ ok: false, error: "Sem permissão" });
  };
}

async function login(req, res) {
  assertLoginRate(req.ip || "local");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const found = await query(
    "select id, password_hash, status from users where lower(email) = $1",
    [email]
  );
  const row = found.rows[0];
  const valid = row ? await verifyPassword(password, row.password_hash) : false;
  if (!row || row.status !== "ativo" || !valid) {
    throw httpError(401, "Credenciais inválidas");
  }
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MS);
  await query(
    "insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [row.id, hashToken(token), expires.toISOString()]
  );
  res.setHeader("Set-Cookie", sessionCookie(token));
  const user = await loadUser(row.id);
  res.json({ ok: true, user: { id: user.id, nome: user.nome, email: user.email } });
}

async function logout(req, res) {
  const token = readCookie(req, "sid");
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  res.setHeader("Set-Cookie", clearCookie());
  res.json({ ok: true });
}

async function me(req, res) {
  res.json({
    ok: true,
    user: { id: req.user.id, nome: req.user.nome, email: req.user.email, permissions: req.user.permissions },
  });
}

module.exports = {
  requireAuth,
  requirePerm,
  login,
  logout,
  me,
  loadUser,
  hashPassword,
  audit,
};
