const express = require("express");
const cors = require("cors");

const catalogo = require("../lib/catalogo");
const registros = require("../lib/registros");
const ordens = require("../lib/ordens");
const lancamentos = require("../lib/lancamentos");
const { syncAllLancamentos } = require("../lib/sync");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://ponto.fisamtour.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true }));
app.use(express.json({ limit: "2mb" }));
// js/api.js envia POST com Content-Type: text/plain;charset=utf-8 (limitação do Apps Script legado)
app.use(express.text({ type: "text/plain", limit: "2mb" }));

function authOrThrow(req, body) {
  const token = req.query.token || (body && body.token) || "";
  if (String(token) !== String(process.env.API_TOKEN || "")) {
    const err = new Error("Não autorizado (token inválido)");
    err.status = 401;
    throw err;
  }
}

function parsedBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return req.body || {};
}

function wrap(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.status || 400).json({ ok: false, error: err.message || String(err) });
    }
  };
}

app.get("/", wrap(async (req) => {
  authOrThrow(req);
  const op = (req.query.op || "").trim();

  if (op === "list") {
    const competencia = (req.query.competencia || "").trim();
    if (!competencia) throw new Error("competencia é obrigatória");
    return { rows: await lancamentos.listLancamentos(competencia) };
  }
  if (op === "options") return catalogo.listCatalogoOptions();
  if (op === "licitacoes") {
    const includeInativas = String(req.query.include_inativas || "") === "1";
    return { licitacoes: await catalogo.listLicitacoesComTotais(includeInativas) };
  }
  if (op === "registros") {
    const id = (req.query.id || "").trim();
    if (!id) throw new Error("id da licitação é obrigatório");
    return registros.getRegistros(id);
  }
  if (op === "passageiros") return { passageiros: await catalogo.listPassageiros(req.query.q || "") };
  if (op === "tarifas") {
    const licitacaoId = (req.query.licitacao_id || "").trim();
    if (!licitacaoId) throw new Error("licitacao_id é obrigatório");
    return { tarifas: await catalogo.listTarifas(licitacaoId) };
  }
  if (op === "ordens") {
    return { ordens: await ordens.listOrdens((req.query.competencia || "").trim(), (req.query.licitacao_id || "").trim()) };
  }
  if (op === "fatura") {
    return { ordens: await ordens.getFaturaElegiveis((req.query.competencia || "").trim(), (req.query.licitacao_id || "").trim()) };
  }
  if (op === "faturaPreview") {
    const idsParam = (req.query.ids || "").trim();
    if (!idsParam) throw new Error("ids é obrigatório");
    return ordens.faturaPreview(idsParam.split(",").map((s) => s.trim()).filter(Boolean));
  }

  throw new Error("op inválida");
}));

app.post("/", wrap(async (req) => {
  const body = parsedBody(req);
  authOrThrow(req, body);
  const op = (body.op || "").trim();

  if (op === "add") return { row: await lancamentos.addLancamento(body.row) };
  if (op === "update") return { row: await lancamentos.updateLancamento(body.row) };
  if (op === "delete") { await lancamentos.deleteLancamento(body.id); return {}; }

  if (op === "closeMonth") {
    const competencia = (body.competencia || "").trim();
    if (!competencia) throw new Error("competencia é obrigatória");
    return lancamentos.closeMonth(competencia);
  }

  if (op === "saveRegistros") {
    const licitacaoId = (body.licitacao_id || "").trim();
    if (!licitacaoId) throw new Error("licitacao_id é obrigatório");
    return registros.saveRegistros(licitacaoId, body.items || []);
  }

  if (op === "syncLancamentos") return syncAllLancamentos();

  if (op === "saveOrdem") return { ordem: await ordens.saveOrdem(body.ordem || body.row || body) };
  if (op === "deleteOrdem") { await ordens.deleteOrdem(body.id); return {}; }

  if (op === "saveLicitacao") return { licitacao: await catalogo.saveLicitacao(body.licitacao || body.row || body) };
  if (op === "saveFornecedor") return { fornecedor: await catalogo.saveFornecedor(body.fornecedor || body.row || body) };
  if (op === "saveTarifa") return { tarifa: await catalogo.saveTarifa(body.tarifa || body.row || body) };

  if (op === "updateRegistroPago") {
    const licitacaoId = (body.licitacao_id || "").trim();
    const id = (body.id || "").trim();
    if (!licitacaoId || !id) throw new Error("licitacao_id e id são obrigatórios");
    return { registro: await registros.updateRegistroPago(licitacaoId, id, body.pago) };
  }

  if (op === "deleteRegistro") {
    const licitacaoId = (body.licitacao_id || "").trim();
    const id = (body.id || "").trim();
    if (!licitacaoId || !id) throw new Error("licitacao_id e id são obrigatórios");
    await registros.deleteRegistro(licitacaoId, id);
    return {};
  }

  if (op === "faturarOrdens") {
    const ids = body.ids || [];
    if (!ids.length) throw new Error("ids é obrigatório");
    return ordens.faturarOrdens(ids);
  }

  throw new Error("op inválida");
}));

app.get("/health", (req, res) => res.json({ ok: true }));

module.exports = app;
