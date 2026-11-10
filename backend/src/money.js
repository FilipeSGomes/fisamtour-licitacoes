// Contas em centavos inteiros. O banco guarda numeric(14,2). Não usar float como persistência.

function toCents(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return toCents(value.toFixed(2));
  }
  let s = String(value).trim().replace(/\s/g, "");
  if (!s) return 0;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return 0;
  const [intPart, frac = ""] = s.split(".");
  const frac2 = (frac + "00").slice(0, 2);
  const roundUp = (frac[2] || "0") >= "5";
  let cents = Number(intPart) * 100 + Number(frac2);
  if (roundUp) cents += 1;
  if (!Number.isSafeInteger(cents)) return 0;
  return neg ? -cents : cents;
}

function centsToSql(cents) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const body = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${body}` : body;
}

function centsToNumber(cents) {
  const neg = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents);
  return neg * (Math.trunc(abs / 100) + (abs % 100) / 100);
}

function lucroCents(valorCents, custoCents) {
  return valorCents - custoCents;
}

function competenciaValida(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

function pagoIn(value) {
  if (value === true) return true;
  if (value === false) return false;
  const s = String(value ?? "").trim().toLowerCase();
  return ["sim", "s", "1", "true", "yes", "x"].includes(s);
}

module.exports = { toCents, centsToSql, centsToNumber, lucroCents, competenciaValida, pagoIn };
