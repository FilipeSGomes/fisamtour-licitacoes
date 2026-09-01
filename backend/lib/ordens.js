const { query, withTransaction, withLock } = require("./db");
const { toNumber, normalizePago, competenciaFromDate, newId } = require("./helpers");
const { syncAllLancamentos } = require("./sync");

async function listOrdens(competencia, licitacaoId) {
  const conditions = ["lower(status_os) <> 'inativo'"];
  const params = [];
  if (competencia) { params.push(competencia); conditions.push(`competencia = $${params.length}`); }
  if (licitacaoId) { params.push(licitacaoId); conditions.push(`licitacao_id = $${params.length}`); }

  const res = await query(
    `select * from ordens_servico where ${conditions.join(" and ")} order by data desc`,
    params
  );
  return res.rows;
}

// Cria ou atualiza uma OS e regenera os lançamentos derivados, tudo numa
// transação — evita que o dashboard fique com dados parciais se algo falhar no meio.
async function saveOrdem(data) {
  return withTransaction(async (client) => {
    const ordem = { ...data };
    ordem.valor = toNumber(ordem.valor);
    ordem.custo = toNumber(ordem.custo);
    ordem.lucro = ordem.valor - ordem.custo;
    ordem.pago = normalizePago(ordem.pago);
    ordem.data = String(ordem.data || "");
    ordem.competencia = String(ordem.competencia || "").trim() || competenciaFromDate(ordem.data);
    ordem.status_os = String(ordem.status_os || "pendente");

    const existingId = String(ordem.id || "").trim();
    let saved;

    if (existingId) {
      const res = await client.query(
        `update ordens_servico set
           competencia=$1, data=$2, licitacao_id=$3, licitacao_nome=$4, tarifa_codigo=$5, tarifa_nome=$6,
           fornecedor=$7, descricao=$8, valor=$9, custo=$10, lucro=$11, status_os=$12, pago=$13,
           comprovante_url=$14, updated_at=now()
         where id = $15 returning *`,
        [ordem.competencia, ordem.data, ordem.licitacao_id, ordem.licitacao_nome || "", ordem.tarifa_codigo || "",
         ordem.tarifa_nome || "", ordem.fornecedor || "", ordem.descricao || "", ordem.valor, ordem.custo,
         ordem.lucro, ordem.status_os, ordem.pago, ordem.comprovante_url || "", existingId]
      );
      saved = res.rows[0];
    }

    if (!saved) {
      const id = existingId || newId("os-");
      const res = await client.query(
        `insert into ordens_servico
         (id, competencia, data, licitacao_id, licitacao_nome, tarifa_codigo, tarifa_nome, fornecedor,
          descricao, valor, custo, lucro, status_os, pago, comprovante_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
        [id, ordem.competencia, ordem.data, ordem.licitacao_id, ordem.licitacao_nome || "", ordem.tarifa_codigo || "",
         ordem.tarifa_nome || "", ordem.fornecedor || "", ordem.descricao || "", ordem.valor, ordem.custo,
         ordem.lucro, ordem.status_os, ordem.pago, ordem.comprovante_url || ""]
      );
      saved = res.rows[0];
    }

    await syncAllLancamentos(client);
    return saved;
  });
}

async function deleteOrdem(id) {
  if (!id) throw new Error("id é obrigatório");
  return withTransaction(async (client) => {
    await client.query("delete from ordens_servico where id = $1", [id]);
    await syncAllLancamentos(client);
  });
}

async function getFaturaElegiveis(competencia, licitacaoId) {
  const ordens = await listOrdens(competencia, licitacaoId);
  return ordens.filter((o) => {
    if (o.faturado_em) return false;
    const st = String(o.status_os || "").toLowerCase();
    return st !== "inativo" && st !== "cancelada";
  });
}

async function faturaPreview(ids) {
  const idSet = new Set(ids.map(String));
  const res = await query("select * from ordens_servico where id = any($1)", [ids.map(String)]);
  const selected = res.rows.filter((o) => idSet.has(String(o.id)));

  let totalValor = 0, totalCusto = 0, totalLucro = 0;
  for (const o of selected) {
    totalValor += Number(o.valor);
    totalCusto += Number(o.custo);
    totalLucro += Number(o.lucro);
  }

  return { ordens: selected, count: selected.length, total_valor: totalValor, total_custo: totalCusto, total_lucro: totalLucro };
}

// Marca as OS como faturadas e regenera os lançamentos, com lock para impedir que
// dois faturamentos simultâneos (ex: duas abas abertas) corrompam o resultado —
// esse era exatamente o cenário sem proteção no Apps Script original.
async function faturarOrdens(ids) {
  return withTransaction(async (client) => {
    await withLock(client, "faturarOrdens");

    const now = new Date().toISOString();
    const res = await client.query(
      `update ordens_servico set faturado_em = $1, status_os = 'faturada', updated_at = now()
       where id = any($2) returning *`,
      [now, ids.map(String)]
    );

    await syncAllLancamentos(client);
    return { count: res.rows.length, ordens: res.rows, faturado_em: now };
  });
}

module.exports = { listOrdens, saveOrdem, deleteOrdem, getFaturaElegiveis, faturaPreview, faturarOrdens };
