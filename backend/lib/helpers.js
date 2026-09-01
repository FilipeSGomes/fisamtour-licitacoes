function toNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (v instanceof Date) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return 0;
  let n;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    n = Number(s.replace(/\./g, "").replace(",", "."));
  } else if (/^-?\d+(\.\d+)?$/.test(s)) {
    n = Number(s);
  } else {
    n = Number(s.replace(",", "."));
  }
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
