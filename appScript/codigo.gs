/***********************
 * FISAM TOUR - API Google Sheets
 *
 * GET:
 *   ?op=list&competencia=YYYY-MM&token=...
 *   ?op=options&token=...
 *   ?op=licitacoes&token=...&include_inativas=1
 *   ?op=registros&id=<licitacao_id>&token=...
 *   ?op=passageiros&q=<busca>&token=...
 *   ?op=tarifas&licitacao_id=<id>&token=...
 *   ?op=ordens&competencia=YYYY-MM&licitacao_id=<id>&token=...
 *   ?op=fatura&competencia=YYYY-MM&licitacao_id=<id>&token=...
 *   ?op=faturaPreview&ids=id1,id2&token=...
 *
 * POST:
 *   { op:"add"|"update"|"delete", token, row|id }
 *   { op:"closeMonth", token, competencia }
 *   { op:"saveRegistros", token, licitacao_id, items:[...] }
 *   { op:"syncLancamentos", token }
 *   { op:"saveOrdem", token, ordem:{...} }
 *   { op:"deleteOrdem", token, id }
 *   { op:"saveLicitacao", token, licitacao:{...} }
 *   { op:"saveFornecedor", token, fornecedor:{...} }
 *   { op:"saveTarifa", token, tarifa:{...} }
 *   { op:"updateRegistroPago", token, licitacao_id, id, pago }
 *   { op:"deleteRegistro", token, licitacao_id, id }
 *   { op:"faturarOrdens", token, ids:[...] }
 ************************/

const SPREADSHEET_ID = "113JL455cvAy2c95Whyo3AIpMd_jF-x1Ga1psK78A0Sw";

const SHEET_LANC = "Lancamentos";
const SHEET_FECH = "Fechamentos";
const SHEET_LIC = "Catalogo_Licitacoes";
const SHEET_FORN = "Catalogo_Fornecedores";
const SHEET_ORDENS = "Ordens_Servico";
const SHEET_TARIFAS = "Catalogo_Tarifas";
const SHEET_REG_PASS = "reg_passagens";
const SHEET_REG_HOSP = "reg_hospedagem";
const SHEET_REG_VEIC = "reg_veiculo";
const SHEET_PASS = "passageiros";

const API_TOKEN = "fisam-licitacoes-2025-secreto";

const HEADERS = {
  lancamentos: [
    "id", "competencia", "data", "licitacao", "status", "tipo", "categoria", "fornecedor",
    "descricao", "valor", "custo", "comprovante_url", "origem", "origem_id", "created_at", "updated_at"
  ],
  fechamentos: ["competencia", "total_receitas", "total_despesas", "saldo", "fechado_em"],
  catalogo: ["id", "nome", "tipo", "status"],
  fornecedores: ["id", "nome", "status"],
  ordens: [
    "id", "competencia", "data", "licitacao_id", "licitacao_nome", "tarifa_codigo", "tarifa_nome",
    "fornecedor", "descricao", "valor", "custo", "lucro", "status_os", "pago", "comprovante_url",
    "faturado_em", "created_at", "updated_at"
  ],
  tarifas: ["id", "licitacao_id", "codigo", "nome", "valor", "custo", "editavel", "status"],
  passageiros: ["id", "nome", "data_nasc", "cpf", "status"],
  reg_passagens: [
    "id", "licitacao_id", "data_solicitacao", "data_ida", "data_chegada", "de", "para",
    "horario_saida", "horario_chegada", "assento", "bilhete", "classe", "colaborador", "cpf",
    "dt_nasc", "valor", "custo", "lucro", "percentil", "pago", "status"
  ],
  reg_hospedagem: [
    "id", "licitacao_id", "dt_solicitacao", "check_in", "check_out", "diarias", "colaborador",
    "refeicoes", "vlr_diaria", "prev_vlr_refeicao", "vlr_total", "custo_hospedagem",
    "custo_refeicao", "custo_tt", "lucro", "prev_pgto", "enviado_faturamento", "pago", "status"
  ],
  reg_veiculo: [
    "id", "licitacao_id", "data_solicitacao", "modelo_veiculo", "placa", "saida", "data",
    "colaborador", "cpf", "dt_nascimento", "valor", "custo", "lucro", "prev_pgto",
    "enviado_faturamento", "pago", "status"
  ]
};

const REG_SHEET_BY_TIPO = {
  passagens: SHEET_REG_PASS,
  hospedagem: SHEET_REG_HOSP,
  veiculo: SHEET_REG_VEIC
};

const HEADERS_BY_SHEET = {
  [SHEET_REG_PASS]: "reg_passagens",
  [SHEET_REG_HOSP]: "reg_hospedagem",
  [SHEET_REG_VEIC]: "reg_veiculo"
};


function doGet(e) {
  try {
    const op = (e.parameter.op || "").trim();
    authOrThrow(e);

    if (op === "list") {
      const competencia = (e.parameter.competencia || "").trim();
      if (!competencia) return json({ ok: false, error: "competencia é obrigatória" });
      return json({ ok: true, rows: listLancamentos(competencia) });
    }

    if (op === "options") {
      return json({
        ok: true,
        licitacoes: listCatalog_(SHEET_LIC),
        fornecedores: listCatalog_(SHEET_FORN)
      });
    }

    if (op === "licitacoes") {
      const includeInativas = String(e.parameter.include_inativas || "") === "1";
      return json({ ok: true, licitacoes: listLicitacoesComTotais_(includeInativas) });
    }

    if (op === "registros") {
      const id = (e.parameter.id || "").trim();
      if (!id) return json({ ok: false, error: "id da licitação é obrigatório" });
      return json({ ok: true, ...getRegistros_(id) });
    }

    if (op === "passageiros") {
      const q = (e.parameter.q || "").trim().toLowerCase();
      return json({ ok: true, passageiros: listPassageiros_(q) });
    }

    if (op === "tarifas") {
      const licitacaoId = (e.parameter.licitacao_id || "").trim();
      if (!licitacaoId) return json({ ok: false, error: "licitacao_id é obrigatório" });
      return json({ ok: true, tarifas: listTarifas_(licitacaoId) });
    }

    if (op === "ordens") {
      const competencia = (e.parameter.competencia || "").trim();
      const licitacaoId = (e.parameter.licitacao_id || "").trim();
      return json({ ok: true, ordens: listOrdens_(competencia, licitacaoId) });
    }

    if (op === "fatura") {
      const competencia = (e.parameter.competencia || "").trim();
      const licitacaoId = (e.parameter.licitacao_id || "").trim();
      return json({ ok: true, ordens: getFaturaElegiveis_(competencia, licitacaoId) });
    }

    if (op === "faturaPreview") {
      const idsParam = (e.parameter.ids || "").trim();
      if (!idsParam) return json({ ok: false, error: "ids é obrigatório" });
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      return json({ ok: true, ...faturaPreview_(ids) });
    }

    return json({ ok: false, error: "op inválida" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


function doPost(e) {
  try {
    const body = parseBody(e);
    authOrThrow(e, body);
    const op = (body.op || "").trim();

    if (op === "add") return json({ ok: true, row: addLancamento(body.row) });
    if (op === "update") return json({ ok: true, row: updateLancamento(body.row) });
    if (op === "delete") {
      deleteLancamento(body.id);
      return json({ ok: true });
    }

    if (op === "closeMonth") {
      const competencia = (body.competencia || "").trim();
      if (!competencia) return json({ ok: false, error: "competencia é obrigatória" });
      return json({ ok: true, ...closeMonth(competencia) });
    }

    if (op === "saveRegistros") {
      const licitacaoId = (body.licitacao_id || "").trim();
      if (!licitacaoId) return json({ ok: false, error: "licitacao_id é obrigatório" });
      const saved = saveRegistros_(licitacaoId, body.items || []);
      syncAllLancamentos_();
      return json({ ok: true, ...saved });
    }

    if (op === "syncLancamentos") {
      return json({ ok: true, ...syncAllLancamentos_() });
    }

    if (op === "saveOrdem") {
      const ordem = body.ordem || body.row || body;
      return json({ ok: true, ordem: saveOrdem_(ordem) });
    }

    if (op === "deleteOrdem") {
      deleteOrdem_(body.id);
      syncAllLancamentos_();
      return json({ ok: true });
    }

    if (op === "saveLicitacao") {
      const licitacao = body.licitacao || body.row || body;
      return json({ ok: true, licitacao: saveLicitacao_(licitacao) });
    }

    if (op === "saveFornecedor") {
      const fornecedor = body.fornecedor || body.row || body;
      return json({ ok: true, fornecedor: saveFornecedor_(fornecedor) });
    }

    if (op === "saveTarifa") {
      const tarifa = body.tarifa || body.row || body;
      return json({ ok: true, tarifa: saveTarifa_(tarifa) });
    }

    if (op === "updateRegistroPago") {
      const licitacaoId = (body.licitacao_id || "").trim();
      const id = (body.id || "").trim();
      if (!licitacaoId || !id) return json({ ok: false, error: "licitacao_id e id são obrigatórios" });
      return json({ ok: true, registro: updateRegistroPago_(licitacaoId, id, body.pago) });
    }

    if (op === "deleteRegistro") {
      const licitacaoId = (body.licitacao_id || "").trim();
      const id = (body.id || "").trim();
      if (!licitacaoId || !id) return json({ ok: false, error: "licitacao_id e id são obrigatórios" });
      deleteRegistro_(licitacaoId, id);
      syncAllLancamentos_();
      return json({ ok: true });
    }

    if (op === "faturarOrdens") {
      const ids = body.ids || [];
      if (!ids.length) return json({ ok: false, error: "ids é obrigatório" });
      return json({ ok: true, ...faturarOrdens_(ids) });
    }

    return json({ ok: false, error: "op inválida" });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/* =========================
   Lançamentos (dashboard)
========================= */

function listLancamentos(competencia) {
  const sh = getSheet_(SHEET_LANC);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[idx.competencia]) continue;
    const comp = String(row[idx.competencia]).trim();
    if (comp !== competencia) continue;

    out.push({
      id: String(row[idx.id] || ""),
      competencia: comp,
      data: toISODate_(row[idx.data]),
      licitacao: String(row[idx.licitacao] || ""),
      status: String(row[idx.status] || "em_andamento"),
      tipo: String(row[idx.tipo] || ""),
      categoria: String(row[idx.categoria] || ""),
      fornecedor: String(row[idx.fornecedor] || ""),
      descricao: String(row[idx.descricao] || ""),
      valor: toNumber_(row[idx.valor]),
      custo: toNumber_(row[idx.custo]),
      comprovante_url: String(row[idx.comprovante_url] || ""),
      origem: String(row[idx.origem] || ""),
      origem_id: String(row[idx.origem_id] || ""),
      created_at: String(row[idx.created_at] || ""),
      updated_at: String(row[idx.updated_at] || "")
    });
  }

  return out.sort((a, b) => (a.data < b.data ? 1 : -1));
}


function addLancamento(r) {
  assertRow_(r);
  const sh = getSheet_(SHEET_LANC);
  ensureHeaders_(sh, HEADERS.lancamentos);

  const id = String(Date.now());
  const now = new Date().toISOString();

  sh.appendRow([
    id,
    String(r.competencia),
    String(r.data),
    String(r.licitacao),
    String(r.status || "em_andamento"),
    String(r.tipo),
    String(r.categoria),
    String(r.fornecedor || ""),
    String(r.descricao || ""),
    toNumber_(r.valor),
    toNumber_(r.custo),
    String(r.comprovante_url || ""),
    String(r.origem || "manual"),
    String(r.origem_id || ""),
    now,
    now
  ]);

  return { ...r, id, origem: r.origem || "manual", created_at: now, updated_at: now };
}


function updateLancamento(r) {
  if (!r || !r.id) throw new Error("row.id é obrigatório no update");
  assertRow_(r);

  const sh = getSheet_(SHEET_LANC);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) throw new Error("Nada para atualizar");

  const idx = indexMap_(data[0].map(String));
  const rowNumber = findRowById_(data, idx.id, r.id);
  const now = new Date().toISOString();

  sh.getRange(rowNumber, idx.competencia + 1).setValue(String(r.competencia));
  sh.getRange(rowNumber, idx.data + 1).setValue(String(r.data));
  sh.getRange(rowNumber, idx.licitacao + 1).setValue(String(r.licitacao));
  sh.getRange(rowNumber, idx.status + 1).setValue(String(r.status || "em_andamento"));
  sh.getRange(rowNumber, idx.tipo + 1).setValue(String(r.tipo));
  sh.getRange(rowNumber, idx.categoria + 1).setValue(String(r.categoria));
  sh.getRange(rowNumber, idx.fornecedor + 1).setValue(String(r.fornecedor || ""));
  sh.getRange(rowNumber, idx.descricao + 1).setValue(String(r.descricao || ""));
  sh.getRange(rowNumber, idx.valor + 1).setValue(toNumber_(r.valor));
  if (idx.custo !== undefined) sh.getRange(rowNumber, idx.custo + 1).setValue(toNumber_(r.custo));
  sh.getRange(rowNumber, idx.comprovante_url + 1).setValue(String(r.comprovante_url || ""));
  sh.getRange(rowNumber, idx.updated_at + 1).setValue(now);

  return { ...r, updated_at: now };
}


function deleteLancamento(id) {
  if (!id) throw new Error("id é obrigatório");
  deleteRowById_(getSheet_(SHEET_LANC), id);
}


function closeMonth(competencia) {
  const lanc = listLancamentos(competencia);
  let receitas = 0;
  let despesas = 0;

  for (const r of lanc) {
    if (r.tipo === "receita") receitas += toNumber_(r.valor);
    else if (r.tipo === "despesa") despesas += toNumber_(r.valor);
  }

  const saldo = receitas - despesas;
  const sh = getSheet_(SHEET_FECH);
  ensureHeaders_(sh, HEADERS.fechamentos);

  removeRowsByValue_(sh, "competencia", competencia);

  const now = new Date().toISOString();
  sh.appendRow([competencia, receitas, despesas, saldo, now]);

  return { competencia, total_receitas: receitas, total_despesas: despesas, saldo, fechado_em: now };
}


/* =========================
   Licitações e registros
========================= */

function listLicitacoesComTotais_(includeInativas) {
  const list = includeInativas ? listAllLicitacoesMeta_() : listLicitacoesMeta_();
  return list.map((lic) => ({
    ...lic,
    ...totaisRegistros_(lic.id, lic.tipo)
  }));
}


function getRegistros_(licitacaoId) {
  const meta = getLicitacaoMeta_(licitacaoId) || getLicitacaoMetaAny_(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const sheetName = REG_SHEET_BY_TIPO[meta.tipo];
  if (!sheetName) {
    return { licitacao: meta, items: [], totais: { receitas: 0, despesas: 0, lucro: 0 } };
  }

  const sh = getSheet_(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) {
    return { licitacao: meta, items: [], totais: { receitas: 0, despesas: 0, lucro: 0 } };
  }

  const headers = data[0].map(String);
  const idx = indexMap_(headers);
  const items = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.licitacao_id] || "").trim() !== licitacaoId) continue;
    if (String(row[idx.status] || "ativo").toLowerCase() === "inativo") continue;
    items.push(rowToObject_(headers, row));
  }

  return { licitacao: meta, items, totais: totaisRegistros_(licitacaoId, meta.tipo) };
}


function saveRegistros_(licitacaoId, items) {
  const meta = getLicitacaoMeta_(licitacaoId) || getLicitacaoMetaAny_(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const sheetName = REG_SHEET_BY_TIPO[meta.tipo];
  if (!sheetName) throw new Error("Tipo sem aba de registros: " + meta.tipo);

  const headerKey = HEADERS_BY_SHEET[sheetName];
  const headers = HEADERS[headerKey];
  const sh = getSheet_(sheetName);
  ensureHeaders_(sh, headers);

  const data = sh.getDataRange().getValues();
  if (data.length >= 2) {
    const idx = indexMap_(data[0].map(String));
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][idx.licitacao_id] || "").trim() === licitacaoId) {
        sh.deleteRow(i + 1);
      }
    }
  }

  const saved = [];
  for (const item of items) {
    const rowObj = { ...item, licitacao_id: licitacaoId, status: item.status || "ativo" };
    if (rowObj.pago !== undefined) rowObj.pago = normalizePago_(rowObj.pago);
    if (!rowObj.id) rowObj.id = String(Date.now()) + Math.floor(Math.random() * 1000);
    sh.appendRow(headers.map((h) => rowObj[h] ?? ""));
    saved.push(rowObj);
  }

  return { licitacao_id: licitacaoId, count: saved.length, items: saved };
}


function syncAllLancamentos_() {
  const sh = getSheet_(SHEET_LANC);
  ensureHeaders_(sh, HEADERS.lancamentos);
  clearNonManualLancamentos_(sh);

  let created = 0;
  created += appendLancamentosFromRegistros_(sh);
  created += appendLancamentosFromOrdens_(sh);

  return { synced: created };
}


function syncLancamentosFromRegistros_() {
  return syncAllLancamentos_();
}


function syncLancamentosFromOrdens_() {
  return appendLancamentosFromOrdens_(getSheet_(SHEET_LANC));
}


function clearNonManualLancamentos_(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;

  const idx = indexMap_(data[0].map(String));
  for (let i = data.length - 1; i >= 1; i--) {
    const origem = String(data[i][idx.origem] || "");
    if (origem && origem !== "manual") sh.deleteRow(i + 1);
  }
}


function appendLancamentosFromRegistros_(sh) {
  let created = 0;
  const now = new Date().toISOString();

  for (const lic of listAllLicitacoesMeta_()) {
    const sheetName = REG_SHEET_BY_TIPO[lic.tipo];
    if (!sheetName) continue;

    const regData = getSheet_(sheetName).getDataRange().getValues();
    if (regData.length < 2) continue;

    const headers = regData[0].map(String);
    const idx = indexMap_(headers);

    for (let i = 1; i < regData.length; i++) {
      const row = regData[i];
      if (String(row[idx.licitacao_id] || "").trim() !== lic.id) continue;
      if (String(row[idx.status] || "ativo").toLowerCase() === "inativo") continue;

      for (const lanc of buildLancamentosFromRegistro_(lic, headers, row)) {
        appendLancamentoRow_(sh, lanc, now);
        created++;
      }
    }
  }

  return created;
}


function appendLancamentosFromOrdens_(sh) {
  let created = 0;
  const now = new Date().toISOString();
  const ordemData = getSheet_(SHEET_ORDENS).getDataRange().getValues();
  if (ordemData.length < 2) return 0;

  const headers = ordemData[0].map(String);
  const idx = indexMap_(headers);

  for (let i = 1; i < ordemData.length; i++) {
    const row = ordemData[i];
    if (String(row[idx.faturado_em] || "").trim() === "") continue;
    if (String(row[idx.status_os] || "ativo").toLowerCase() === "inativo") continue;

    const obj = rowToObject_(headers, row);
    for (const lanc of buildLancamentosFromOrdem_(obj)) {
      appendLancamentoRow_(sh, lanc, now);
      created++;
    }
  }

  return created;
}


function appendLancamentoRow_(sh, lanc, now) {
  sh.appendRow([
    lanc.id,
    lanc.competencia,
    lanc.data,
    lanc.licitacao,
    lanc.status,
    lanc.tipo,
    lanc.categoria,
    lanc.fornecedor,
    lanc.descricao,
    lanc.valor,
    lanc.custo || 0,
    lanc.comprovante_url,
    lanc.origem,
    lanc.origem_id,
    now,
    now
  ]);
}


function buildLancamentosFromRegistro_(lic, headers, row) {
  const obj = rowToObject_(headers, row);
  const origem = REG_SHEET_BY_TIPO[lic.tipo];
  const origemId = String(obj.id || "");

  if (lic.tipo === "passagens") {
    const data = toISODate_(obj.data_ida || obj.data_solicitacao);
    const desc = [obj.de, obj.para, obj.colaborador].filter(Boolean).join(" → ");
    return lancPair_(lic.nome, origem, origemId, data, "passagens", desc, obj.valor, obj.custo);
  }

  if (lic.tipo === "hospedagem") {
    const data = toISODate_(obj.check_in || obj.dt_solicitacao);
    const desc = "Hospedagem | " + String(obj.colaborador || "");
    const custo = obj.custo_tt || obj.custo_hospedagem || obj.custo_refeicao;
    return lancPair_(lic.nome, origem, origemId, data, "hospedagem", desc, obj.vlr_total, custo);
  }

  if (lic.tipo === "veiculo") {
    const data = toISODate_(obj.data || obj.data_solicitacao);
    const desc = [obj.saida, obj.colaborador].filter(Boolean).join(" | ");
    return lancPair_(lic.nome, origem, origemId, data, "veiculo", desc, obj.valor, obj.custo);
  }

  return [];
}


function buildLancamentosFromOrdem_(ordem) {
  const data = toISODate_(ordem.data);
  const comp = String(ordem.competencia || "").trim() || competenciaFromDate_(data);
  if (!comp) return [];

  const categoria = String(ordem.tarifa_codigo || "ordem");
  const descricao = String(ordem.descricao || ordem.tarifa_nome || "Ordem de serviço");
  const fornecedor = String(ordem.fornecedor || "");

  const base = {
    licitacao: String(ordem.licitacao_nome || ""),
    status: "em_andamento",
    fornecedor,
    comprovante_url: String(ordem.comprovante_url || ""),
    origem: SHEET_ORDENS,
    origem_id: String(ordem.id || "")
  };

  const out = [];
  const v = toNumber_(ordem.valor);
  const c = toNumber_(ordem.custo);

  if (v) {
    out.push({
      id: "lc-" + Date.now() + Math.floor(Math.random() * 10000),
      competencia: comp,
      data,
      tipo: "receita",
      categoria,
      descricao,
      valor: v,
      custo: c,
      ...base
    });
  }

  if (c) {
    out.push({
      id: "lc-" + Date.now() + Math.floor(Math.random() * 10000),
      competencia: comp,
      data,
      tipo: "despesa",
      categoria,
      descricao: "Custo: " + descricao,
      valor: c,
      custo: c,
      ...base
    });
  }

  return out;
}


function lancPair_(licitacaoNome, origem, origemId, data, categoria, descricao, valor, custo) {
  const comp = competenciaFromDate_(data);
  if (!comp) return [];

  const base = {
    licitacao: licitacaoNome,
    status: "em_andamento",
    categoria,
    fornecedor: "",
    comprovante_url: "",
    origem,
    origem_id: origemId
  };

  const out = [];
  const v = toNumber_(valor);
  const c = toNumber_(custo);

  if (v) {
    out.push({
      id: "lc-" + Date.now() + Math.floor(Math.random() * 10000),
      competencia: comp,
      data,
      tipo: "receita",
      descricao,
      valor: v,
      custo: c,
      ...base
    });
  }

  if (c) {
    out.push({
      id: "lc-" + Date.now() + Math.floor(Math.random() * 10000),
      competencia: comp,
      data,
      tipo: "despesa",
      descricao: "Custo: " + descricao,
      valor: c,
      custo: c,
      ...base
    });
  }

  return out;
}


function totaisRegistros_(licitacaoId, tipo) {
  const sheetName = REG_SHEET_BY_TIPO[tipo];
  if (!sheetName) return { receitas: 0, despesas: 0, lucro: 0 };

  const data = getSheet_(sheetName).getDataRange().getValues();
  if (data.length < 2) return { receitas: 0, despesas: 0, lucro: 0 };

  const idx = indexMap_(data[0].map(String));
  let receitas = 0;
  let despesas = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.licitacao_id] || "").trim() !== licitacaoId) continue;
    if (String(row[idx.status] || "ativo").toLowerCase() === "inativo") continue;

    if (tipo === "passagens" || tipo === "veiculo") {
      receitas += toNumber_(row[idx.valor]);
      despesas += toNumber_(row[idx.custo]);
    } else if (tipo === "hospedagem") {
      receitas += toNumber_(row[idx.vlr_total]);
      const custo = row[idx.custo_tt] || row[idx.custo_hospedagem] || row[idx.custo_refeicao] || 0;
      despesas += toNumber_(custo);
    }
  }

  return { receitas, despesas, lucro: receitas - despesas };
}


function listPassageiros_(q) {
  const sh = getSheet_(SHEET_PASS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.status] || "ativo").toLowerCase() !== "ativo") continue;

    const item = {
      id: String(row[idx.id] || ""),
      nome: String(row[idx.nome] || "").trim(),
      data_nasc: toISODate_(row[idx.data_nasc]),
      cpf: String(row[idx.cpf] || "").trim()
    };

    if (!item.nome) continue;
    const hay = [item.nome, item.cpf].join(" ").toLowerCase();
    if (q && !hay.includes(q)) continue;
    out.push(item);
  }

  return out.slice(0, q ? 50 : 100);
}


/* =========================
   Ordens de serviço
========================= */

function listOrdens_(competencia, licitacaoId) {
  const sh = getSheet_(SHEET_ORDENS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (competencia && String(row[idx.competencia] || "").trim() !== competencia) continue;
    if (licitacaoId && String(row[idx.licitacao_id] || "").trim() !== licitacaoId) continue;
    if (String(row[idx.status_os] || "ativo").toLowerCase() === "inativo") continue;

    out.push(ordemFromRow_(idx, row));
  }

  return out.sort((a, b) => (a.data < b.data ? 1 : -1));
}


function ordemFromRow_(idx, row) {
  return {
    id: String(row[idx.id] || ""),
    competencia: String(row[idx.competencia] || ""),
    data: toISODate_(row[idx.data]),
    licitacao_id: String(row[idx.licitacao_id] || ""),
    licitacao_nome: String(row[idx.licitacao_nome] || ""),
    tarifa_codigo: String(row[idx.tarifa_codigo] || ""),
    tarifa_nome: String(row[idx.tarifa_nome] || ""),
    fornecedor: String(row[idx.fornecedor] || ""),
    descricao: String(row[idx.descricao] || ""),
    valor: toNumber_(row[idx.valor]),
    custo: toNumber_(row[idx.custo]),
    lucro: toNumber_(row[idx.lucro]),
    status_os: String(row[idx.status_os] || ""),
    pago: normalizePago_(row[idx.pago]),
    comprovante_url: String(row[idx.comprovante_url] || ""),
    faturado_em: String(row[idx.faturado_em] || ""),
    created_at: String(row[idx.created_at] || ""),
    updated_at: String(row[idx.updated_at] || "")
  };
}


function saveOrdem_(data) {
  const sh = getSheet_(SHEET_ORDENS);
  ensureHeaders_(sh, HEADERS.ordens);

  const now = new Date().toISOString();
  const ordem = { ...data };

  ordem.valor = toNumber_(ordem.valor);
  ordem.custo = toNumber_(ordem.custo);
  ordem.lucro = ordem.valor - ordem.custo;
  ordem.pago = normalizePago_(ordem.pago);
  ordem.data = toISODate_(ordem.data);
  ordem.competencia = String(ordem.competencia || "").trim() || competenciaFromDate_(ordem.data);

  const sheetData = sh.getDataRange().getValues();
  const existingId = String(ordem.id || "").trim();

  if (existingId && sheetData.length >= 2) {
    const idx = indexMap_(sheetData[0].map(String));
    try {
      const rowNumber = findRowById_(sheetData, idx.id, existingId);
      ordem.updated_at = now;
      ordem.created_at = String(sheetData[rowNumber - 1][idx.created_at] || now);
      HEADERS.ordens.forEach((h, col) => {
        if (h === "created_at") return;
        sh.getRange(rowNumber, col + 1).setValue(ordem[h] ?? "");
      });
      syncAllLancamentos_();
      return ordemFromRow_(idx, HEADERS.ordens.map((h) => ordem[h] ?? ""));
    } catch (e) { /* cria novo se id não encontrado */ }
  }

  ordem.id = existingId || String(Date.now()) + Math.floor(Math.random() * 1000);
  ordem.created_at = now;
  ordem.updated_at = now;
  ordem.status_os = String(ordem.status_os || "pendente");
  sh.appendRow(HEADERS.ordens.map((h) => ordem[h] ?? ""));

  syncAllLancamentos_();
  return ordem;
}


function deleteOrdem_(id) {
  if (!id) throw new Error("id é obrigatório");
  deleteRowById_(getSheet_(SHEET_ORDENS), id);
}


function getFaturaElegiveis_(competencia, licitacaoId) {
  return listOrdens_(competencia, licitacaoId).filter((o) => {
    if (String(o.faturado_em || "").trim()) return false;
    const st = String(o.status_os || "").toLowerCase();
    if (st === "inativo" || st === "cancelada") return false;
    return true;
  });
}


function faturaPreview_(ids) {
  const idSet = {};
  ids.forEach((id) => { idSet[String(id)] = true; });

  const all = listOrdens_("", "");
  const selected = all.filter((o) => idSet[o.id]);

  let totalValor = 0;
  let totalCusto = 0;
  let totalLucro = 0;

  for (const o of selected) {
    totalValor += o.valor;
    totalCusto += o.custo;
    totalLucro += o.lucro;
  }

  return {
    ordens: selected,
    count: selected.length,
    total_valor: totalValor,
    total_custo: totalCusto,
    total_lucro: totalLucro
  };
}


function faturarOrdens_(ids) {
  const sh = getSheet_(SHEET_ORDENS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { count: 0, ordens: [] };

  const idx = indexMap_(data[0].map(String));
  const now = new Date().toISOString();
  const idSet = {};
  ids.forEach((id) => { idSet[String(id)] = true; });
  const faturadas = [];

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idx.id] || "");
    if (!idSet[rowId]) continue;

    const rowNumber = i + 1;
    sh.getRange(rowNumber, idx.faturado_em + 1).setValue(now);
    sh.getRange(rowNumber, idx.status_os + 1).setValue("faturada");
    sh.getRange(rowNumber, idx.updated_at + 1).setValue(now);

    const updated = data[i].slice();
    updated[idx.faturado_em] = now;
    updated[idx.status_os] = "faturada";
    updated[idx.updated_at] = now;
    faturadas.push(ordemFromRow_(idx, updated));
  }

  syncAllLancamentos_();
  return { count: faturadas.length, ordens: faturadas, faturado_em: now };
}


/* =========================
   Tarifas
========================= */

function listTarifas_(licitacaoId) {
  const sh = getSheet_(SHEET_TARIFAS);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.licitacao_id] || "").trim() !== licitacaoId) continue;
    if (String(row[idx.status] || "ativo").toLowerCase() === "inativo") continue;

    out.push({
      id: String(row[idx.id] || ""),
      licitacao_id: String(row[idx.licitacao_id] || ""),
      codigo: String(row[idx.codigo] || ""),
      nome: String(row[idx.nome] || ""),
      valor: toNumber_(row[idx.valor]),
      custo: toNumber_(row[idx.custo]),
      editavel: String(row[idx.editavel] || "sim"),
      status: String(row[idx.status] || "ativo")
    });
  }

  return out;
}


function saveTarifa_(data) {
  const sh = getSheet_(SHEET_TARIFAS);
  ensureHeaders_(sh, HEADERS.tarifas);

  const tarifa = {
    id: String(data.id || "").trim(),
    licitacao_id: String(data.licitacao_id || "").trim(),
    codigo: String(data.codigo || "").trim(),
    nome: String(data.nome || "").trim(),
    valor: toNumber_(data.valor),
    custo: toNumber_(data.custo),
    editavel: String(data.editavel || "sim"),
    status: String(data.status || "ativo")
  };

  if (!tarifa.licitacao_id) throw new Error("licitacao_id é obrigatório");
  if (!tarifa.nome) throw new Error("nome é obrigatório");

  const sheetData = sh.getDataRange().getValues();
  if (tarifa.id && sheetData.length >= 2) {
    const idx = indexMap_(sheetData[0].map(String));
    try {
      const rowNumber = findRowById_(sheetData, idx.id, tarifa.id);
      HEADERS.tarifas.forEach((h, col) => {
        sh.getRange(rowNumber, col + 1).setValue(tarifa[h] ?? "");
      });
      return tarifa;
    } catch (e) { /* cria novo */ }
  }

  if (!tarifa.id) tarifa.id = String(Date.now()) + Math.floor(Math.random() * 1000);
  if (!tarifa.codigo) tarifa.codigo = tarifa.id;
  sh.appendRow(HEADERS.tarifas.map((h) => tarifa[h] ?? ""));
  return tarifa;
}


/* =========================
   Registros — pago / delete
========================= */

function updateRegistroPago_(licitacaoId, id, pago) {
  const meta = getLicitacaoMetaAny_(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const sheetName = REG_SHEET_BY_TIPO[meta.tipo];
  if (!sheetName) throw new Error("Tipo sem aba de registros: " + meta.tipo);

  const sh = getSheet_(sheetName);
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(String);
  const idx = indexMap_(headers);
  const rowNumber = findRowById_(data, idx.id, id);

  if (String(data[rowNumber - 1][idx.licitacao_id] || "").trim() !== licitacaoId) {
    throw new Error("Registro não pertence à licitação");
  }

  sh.getRange(rowNumber, idx.pago + 1).setValue(normalizePago_(pago));
  const updated = sh.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return rowToObject_(headers, updated);
}


function deleteRegistro_(licitacaoId, id) {
  const meta = getLicitacaoMetaAny_(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const sheetName = REG_SHEET_BY_TIPO[meta.tipo];
  if (!sheetName) throw new Error("Tipo sem aba de registros: " + meta.tipo);

  const sh = getSheet_(sheetName);
  const data = sh.getDataRange().getValues();
  const idx = indexMap_(data[0].map(String));
  const rowNumber = findRowById_(data, idx.id, id);

  if (String(data[rowNumber - 1][idx.licitacao_id] || "").trim() !== licitacaoId) {
    throw new Error("Registro não pertence à licitação");
  }

  sh.getRange(rowNumber, idx.status + 1).setValue("inativo");
}


/* =========================
   Catálogo
========================= */

function listCatalog_(sheetName) {
  const sh = getSheet_(sheetName);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idx.status] || "ativo").toLowerCase() !== "ativo") continue;
    out.push({
      id: String(row[idx.id] || ""),
      nome: String(row[idx.nome] || "").trim()
    });
  }

  return out.filter((x) => x.nome);
}


function listLicitacoesMeta_() {
  return listAllLicitacoesMeta_().filter(
    (x) => String(x.status || "ativo").toLowerCase() === "ativo"
  );
}


function listAllLicitacoesMeta_() {
  const sh = getSheet_(SHEET_LIC);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const idx = indexMap_(data[0].map(String));
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    out.push({
      id: String(row[idx.id] || "").trim(),
      nome: String(row[idx.nome] || "").trim(),
      tipo: String(row[idx.tipo] || "").trim(),
      status: String(row[idx.status] || "ativo").trim()
    });
  }

  return out.filter((x) => x.id && x.nome);
}


function getLicitacaoMeta_(id) {
  return listLicitacoesMeta_().find((x) => x.id === id) || null;
}


function getLicitacaoMetaAny_(id) {
  return listAllLicitacoesMeta_().find((x) => x.id === id) || null;
}


function saveLicitacao_(data) {
  const sh = getSheet_(SHEET_LIC);
  ensureHeaders_(sh, HEADERS.catalogo);

  const lic = {
    id: String(data.id || "").trim(),
    nome: String(data.nome || "").trim(),
    tipo: String(data.tipo || "").trim(),
    status: String(data.status || "ativo").trim()
  };

  if (!lic.nome) throw new Error("nome é obrigatório");
  if (!lic.tipo) throw new Error("tipo é obrigatório");

  const sheetData = sh.getDataRange().getValues();
  if (lic.id && sheetData.length >= 2) {
    const idx = indexMap_(sheetData[0].map(String));
    try {
      const rowNumber = findRowById_(sheetData, idx.id, lic.id);
      sh.getRange(rowNumber, idx.nome + 1).setValue(lic.nome);
      sh.getRange(rowNumber, idx.tipo + 1).setValue(lic.tipo);
      sh.getRange(rowNumber, idx.status + 1).setValue(lic.status);
      return lic;
    } catch (e) { /* cria novo */ }
  }

  if (!lic.id) {
    lic.id = lic.nome.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || String(Date.now());
  }

  sh.appendRow([lic.id, lic.nome, lic.tipo, lic.status]);
  return lic;
}


function saveFornecedor_(data) {
  const sh = getSheet_(SHEET_FORN);
  ensureHeaders_(sh, HEADERS.fornecedores);

  const forn = {
    id: String(data.id || "").trim(),
    nome: String(data.nome || "").trim(),
    status: String(data.status || "ativo").trim()
  };

  if (!forn.nome) throw new Error("nome é obrigatório");

  const sheetData = sh.getDataRange().getValues();
  if (forn.id && sheetData.length >= 2) {
    const idx = indexMap_(sheetData[0].map(String));
    try {
      const rowNumber = findRowById_(sheetData, idx.id, forn.id);
      sh.getRange(rowNumber, idx.nome + 1).setValue(forn.nome);
      sh.getRange(rowNumber, idx.status + 1).setValue(forn.status);
      return forn;
    } catch (e) { /* cria novo */ }
  }

  if (!forn.id) {
    forn.id = forn.nome.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || String(Date.now());
  }

  sh.appendRow([forn.id, forn.nome, forn.status]);
  return forn;
}


/* =========================
   Setup (rodar 1x no editor)
========================= */

function setupPlanilha() {
  ensureHeaders_(getSheet_(SHEET_LANC), HEADERS.lancamentos);
  ensureHeaders_(getSheet_(SHEET_FECH), HEADERS.fechamentos);
  ensureHeaders_(getSheet_(SHEET_LIC), HEADERS.catalogo);
  ensureHeaders_(getSheet_(SHEET_FORN), HEADERS.fornecedores);
  ensureHeaders_(getSheet_(SHEET_ORDENS), HEADERS.ordens);
  ensureHeaders_(getSheet_(SHEET_TARIFAS), HEADERS.tarifas);
  ensureHeaders_(getSheet_(SHEET_PASS), HEADERS.passageiros);
  ensureHeaders_(getSheet_(SHEET_REG_PASS), HEADERS.reg_passagens);
  ensureHeaders_(getSheet_(SHEET_REG_HOSP), HEADERS.reg_hospedagem);
  ensureHeaders_(getSheet_(SHEET_REG_VEIC), HEADERS.reg_veiculo);
  Logger.log("Abas e cabeçalhos verificados.");
}


/* =========================
   Helpers
========================= */

function getSheet_(name) {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}


function ensureHeaders_(sh, headers) {
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.appendRow(headers);
    return;
  }

  const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  if (current.join("|") !== headers.join("|")) {
    throw new Error(
      'Cabeçalho da aba "' + sh.getName() + '" diferente do esperado. Esperado: ' + headers.join(" | ")
    );
  }
}


function indexMap_(headers) {
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return map;
}


function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}


function findRowById_(data, idIndex, id) {
  const sid = String(id);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === sid) return i + 1;
  }
  throw new Error("ID não encontrado: " + id);
}


function deleteRowById_(sh, id) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;

  const idx = indexMap_(data[0].map(String));
  const sid = String(id);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.id]) === sid) {
      sh.deleteRow(i + 1);
      return;
    }
  }
}


function removeRowsByValue_(sh, columnName, value) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;

  const idx = indexMap_(data[0].map(String));
  const col = idx[columnName];

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]).trim() === String(value).trim()) {
      sh.deleteRow(i + 1);
    }
  }
}


function assertRow_(r) {
  if (!r) throw new Error("row é obrigatória");
  const required = ["competencia", "data", "licitacao", "tipo", "categoria", "valor"];
  for (const k of required) {
    if (r[k] === undefined || r[k] === null || String(r[k]).trim() === "") {
      throw new Error("Campo obrigatório: " + k);
    }
  }
}


function toNumber_(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (v instanceof Date) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 20000 && n < 60000 && Math.floor(n) === n) return 0;
  return n;
}


function normalizePago_(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "sim" || s === "s" || s === "1" || s === "true" || s === "yes") return "sim";
  return "nao";
}


function isPagoSim_(v) {
  return normalizePago_(v) === "sim";
}


function competenciaFromDate_(dateStr) {
  const s = toISODate_(dateStr);
  return s && s.length >= 7 ? s.slice(0, 7) : "";
}


function toISODate_(v) {
  if (v instanceof Date) {
    const yyyy = v.getFullYear();
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }
  return String(v || "").trim();
}


function parseBody(e) {
  if (!e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}


function authOrThrow(e, body) {
  const token =
    (e && e.parameter && e.parameter.token) ||
    (body && body.token) ||
    "";

  if (String(token) !== String(API_TOKEN)) {
    throw new Error("Não autorizado (token inválido)");
  }
}


function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/** Rode no editor Apps Script para validar planilha + dados. */
function testApi() {
  setupPlanilha();
  const opts = listCatalog_(SHEET_LIC);
  const jul = listLancamentos("2025-07");
  const lic = listLicitacoesComTotais_();
  const licAll = listLicitacoesComTotais_(true);
  const tar = listTarifas_("6-rcc-rs");
  const ord = listOrdens_("2025-07", "");
  Logger.log("Licitações catálogo: " + opts.length);
  Logger.log("Lancamentos 2025-07: " + jul.length);
  Logger.log("Licitações com totais: " + lic.length);
  Logger.log("Licitações (incl. inativas): " + licAll.length);
  Logger.log("Tarifas 6-rcc-rs: " + tar.length);
  Logger.log("Ordens 2025-07: " + ord.length);
  if (!jul.length) {
    Logger.log("AVISO: importe appScript/csv/Lancamentos.csv na aba Lancamentos");
  }
}
