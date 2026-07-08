const { pool } = require("./db");
const { toNumber, competenciaFromDate, newId } = require("./helpers");

const REG_TABLE_BY_TIPO = { passagens: "reg_passagens", hospedagem: "reg_hospedagem", veiculo: "reg_veiculo" };

function lancPair(licitacaoNome, origem, origemId, data, categoria, descricao, valor, custo) {
  const comp = competenciaFromDate(data);
  if (!comp) return [];

  const base = {
    licitacao: licitacaoNome, status: "em_andamento", categoria,
    fornecedor: "", comprovante_url: "", origem, origem_id: origemId,
  };

  const out = [];
  const v = toNumber(valor);
  const c = toNumber(custo);

  if (v) out.push({ id: newId("lc-"), competencia: comp, data, tipo: "receita", descricao, valor: v, custo: c, ...base });
  if (c) out.push({ id: newId("lc-"), competencia: comp, data, tipo: "despesa", descricao: "Custo: " + descricao, valor: c, custo: c, ...base });
  return out;
}

function buildFromRegistro(lic, row) {
  const origem = REG_TABLE_BY_TIPO[lic.tipo];
  const origemId = String(row.id || "");

  if (lic.tipo === "passagens") {
    const data = row.data_ida || row.data_solicitacao || "";
    const desc = [row.de, row.para, row.colaborador].filter(Boolean).join(" → ");
    return lancPair(lic.nome, origem, origemId, data, "passagens", desc, row.valor, row.custo);
  }
  if (lic.tipo === "hospedagem") {
    const data = row.check_in || row.dt_solicitacao || "";
    const desc = "Hospedagem | " + String(row.colaborador || "");
    const custo = row.custo_tt || row.custo_hospedagem || row.custo_refeicao;
    return lancPair(lic.nome, origem, origemId, data, "hospedagem", desc, row.vlr_total, custo);
  }
  if (lic.tipo === "veiculo") {
    const data = row.data || row.data_solicitacao || "";
    const desc = [row.saida, row.colaborador].filter(Boolean).join(" | ");
    return lancPair(lic.nome, origem, origemId, data, "veiculo", desc, row.valor, row.custo);
  }
  return [];
}

// origem = "ordem_servico": o Apps Script gravava "Ordens_Servico" aqui, mas o
// frontend (app.js, ao editar um lançamento) compara com "ordem_servico" — os dois
// nunca batiam, então o dashboard nunca reconhecia lançamentos vindos de uma OS como
// editáveis/vinculados. Corrigido na migração.
function buildFromOrdem(ordem) {
  const data = String(ordem.data || "");
  const comp = String(ordem.competencia || "").trim() || competenciaFromDate(data);
  if (!comp) return [];

  const categoria = String(ordem.tarifa_codigo || "ordem");
  const descricao = String(ordem.descricao || ordem.tarifa_nome || "Ordem de serviço");
  const base = {
    licitacao: String(ordem.licitacao_nome || ""),
    status: "em_andamento",
    fornecedor: String(ordem.fornecedor || ""),
    comprovante_url: String(ordem.comprovante_url || ""),
    origem: "ordem_servico",
    origem_id: String(ordem.id || ""),
  };

  const out = [];
  const v = toNumber(ordem.valor);
  const c = toNumber(ordem.custo);
  if (v) out.push({ id: newId("lc-"), competencia: comp, data, tipo: "receita", categoria, descricao, valor: v, custo: c, ...base });
  if (c) out.push({ id: newId("lc-"), competencia: comp, data, tipo: "despesa", categoria, descricao: "Custo: " + descricao, valor: c, custo: c, ...base });
  return out;
}

async function insertLancamento(db, lanc) {
  await db.query(
    `insert into lancamentos
     (id, competencia, data, licitacao, status, tipo, categoria, fornecedor, descricao, valor, custo, comprovante_url, origem, origem_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [lanc.id, lanc.competencia, lanc.data, lanc.licitacao, lanc.status, lanc.tipo, lanc.categoria || "",
     lanc.fornecedor || "", lanc.descricao, lanc.valor, lanc.custo || 0, lanc.comprovante_url || "",
     lanc.origem, lanc.origem_id || ""]
  );
}

// Regenera todos os lançamentos não-manuais (origem != 'manual') a partir de
// reg_passagens/reg_hospedagem/reg_veiculo e ordens_servico faturadas.
// `db` pode ser o pool ou um client dentro de uma transação — mesma interface `.query()`.
async function syncAllLancamentos(db = pool) {
  await db.query("delete from lancamentos where origem <> 'manual'");

  const licitacoes = (await db.query("select id, nome, tipo, status from licitacoes")).rows;
  let created = 0;

  for (const lic of licitacoes) {
    const table = REG_TABLE_BY_TIPO[lic.tipo];
    if (!table) continue;

    const rows = (await db.query(
      `select * from ${table} where licitacao_id = $1 and lower(status) <> 'inativo'`,
      [lic.id]
    )).rows;

    for (const row of rows) {
      for (const lanc of buildFromRegistro(lic, row)) {
        await insertLancamento(db, lanc);
        created++;
      }
    }
  }

  const ordens = (await db.query(
    `select * from ordens_servico where faturado_em is not null and lower(status_os) <> 'inativo'`
  )).rows;

  for (const ordem of ordens) {
    for (const lanc of buildFromOrdem(ordem)) {
      await insertLancamento(db, lanc);
      created++;
    }
  }

  return { synced: created };
}

module.exports = { syncAllLancamentos };
