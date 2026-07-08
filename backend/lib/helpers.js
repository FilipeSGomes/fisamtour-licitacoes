function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizePago(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["sim", "s", "1", "true", "yes"].includes(s) ? "sim" : "nao";
}

function toISODate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v || "").trim();
}

function competenciaFromDate(dateStr) {
  const s = toISODate(dateStr);
  return s && s.length >= 7 ? s.slice(0, 7) : "";
}

function newId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

module.exports = { toNumber, normalizePago, toISODate, competenciaFromDate, newId };
