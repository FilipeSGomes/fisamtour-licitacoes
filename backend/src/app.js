const path = require("path");
const express = require("express");
const { mapDbError } = require("./errors");
const { requireAuth, requirePerm, login, logout, me } = require("./auth");
const { register } = require("./routes");

const ROOT = path.resolve(__dirname, "..", "..");
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
}

app.post("/api/auth/login", wrap(login));
app.post("/api/auth/logout", wrap(logout));
app.get("/api/auth/me", requireAuth, wrap(me));

register(app, { requireAuth, requirePerm });

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "Rota não encontrada" });
});

const ALLOWED_EXT = new Set([".html", ".css", ".js", ".png", ".svg", ".ico", ".webp"]);
const BLOCKED_TOP = new Set(["backend", "appScript", "docs", "node_modules", ".git", ".fisam-ai", "scripts"]);

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  let rel = req.path === "/" ? "index.html" : decodeURIComponent(req.path).replace(/^\/+/, "");
  if (!rel || rel.includes("\0")) return res.status(404).end();
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return res.status(404).end();
  const top = path.relative(ROOT, abs).split(path.sep)[0];
  if (BLOCKED_TOP.has(top)) return res.status(404).end();
  if (!ALLOWED_EXT.has(path.extname(abs).toLowerCase())) return res.status(404).end();
  res.sendFile(abs, (err) => {
    if (err) res.status(404).end();
  });
});

app.use((err, _req, res, _next) => {
  const mapped = mapDbError(err);
  const status = mapped.status || 500;
  if (status >= 500) console.error("erro interno");
  res.status(status).json({
    ok: false,
    error: status >= 500 ? "Erro interno" : mapped.message,
  });
});

module.exports = app;
