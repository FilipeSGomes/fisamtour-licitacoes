const { query, withTransaction } = require("./db");
const { getLicitacaoMeta, totaisRegistros, REG_TABLE_BY_TIPO } = require("./catalogo");
const { normalizePago, newId } = require("./helpers");
const { syncAllLancamentos } = require("./sync");

const COLUMNS_BY_TIPO = {
  passagens: [
    "id", "licitacao_id", "data_solicitacao", "data_ida", "data_chegada", "de", "para",
    "horario_saida", "horario_chegada", "assento", "bilhete", "classe", "colaborador", "cpf",
    "dt_nasc", "valor", "custo", "lucro", "percentil", "pago", "status",
  ],
  hospedagem: [
    "id", "licitacao_id", "dt_solicitacao", "check_in", "check_out", "diarias", "colaborador",
    "refeicoes", "vlr_diaria", "prev_vlr_refeicao", "vlr_total", "custo_hospedagem",
    "custo_refeicao", "custo_tt", "lucro", "prev_pgto", "enviado_faturamento", "pago", "status",
  ],
  veiculo: [
    "id", "licitacao_id", "data_solicitacao", "modelo_veiculo", "placa", "saida", "data",
    "colaborador", "cpf", "dt_nascimento", "valor", "custo", "lucro", "prev_pgto",
    "enviado_faturamento", "pago", "status",
  ],
};

async function getRegistros(licitacaoId) {
  const meta = await getLicitacaoMeta(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const table = REG_TABLE_BY_TIPO[meta.tipo];
  if (!table) return { licitacao: meta, items: [], totais: { receitas: 0, despesas: 0, lucro: 0 } };

  const res = await query(
    `select * from ${table} where licitacao_id = $1 and lower(status) <> 'inativo' order by id`,
    [licitacaoId]
  );
  return { licitacao: meta, items: res.rows, totais: await totaisRegistros(licitacaoId, meta.tipo) };
}

// Substitui por completo o conjunto de registros da licitação e já regenera os
// lançamentos derivados — tudo em uma única transação (o Apps Script fazia isso em
// 3 chamadas separadas à planilha, sem atomicidade).
async function saveRegistros(licitacaoId, items) {
  const meta = await getLicitacaoMeta(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);

  const table = REG_TABLE_BY_TIPO[meta.tipo];
  if (!table) throw new Error("Tipo sem tabela de registros: " + meta.tipo);
  const cols = COLUMNS_BY_TIPO[meta.tipo];

  return withTransaction(async (client) => {
    await client.query(`delete from ${table} where licitacao_id = $1`, [licitacaoId]);

    const saved = [];
    for (const item of items) {
      const rowObj = { ...item, licitacao_id: licitacaoId, status: item.status || "ativo" };
      if (rowObj.pago !== undefined) rowObj.pago = normalizePago(rowObj.pago);
      if (!rowObj.id) rowObj.id = newId("r-");

      const values = cols.map((c) => rowObj[c] ?? (typeof rowObj[c] === "number" ? 0 : ""));
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
      await client.query(`insert into ${table} (${cols.join(",")}) values (${placeholders})`, values);
      saved.push(rowObj);
    }

    await syncAllLancamentos(client);
    return { licitacao_id: licitacaoId, count: saved.length, items: saved };
  });
}

async function updateRegistroPago(licitacaoId, id, pago) {
  const meta = await getLicitacaoMeta(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);
  const table = REG_TABLE_BY_TIPO[meta.tipo];
  if (!table) throw new Error("Tipo sem tabela de registros: " + meta.tipo);

  const res = await query(
    `update ${table} set pago = $1 where id = $2 and licitacao_id = $3 returning *`,
    [normalizePago(pago), id, licitacaoId]
  );
  if (!res.rows[0]) throw new Error("Registro não encontrado ou não pertence à licitação");
  return res.rows[0];
}

async function deleteRegistro(licitacaoId, id) {
  const meta = await getLicitacaoMeta(licitacaoId);
  if (!meta) throw new Error("Licitação não encontrada: " + licitacaoId);
  const table = REG_TABLE_BY_TIPO[meta.tipo];
  if (!table) throw new Error("Tipo sem tabela de registros: " + meta.tipo);

  return withTransaction(async (client) => {
    const res = await client.query(
      `update ${table} set status = 'inativo' where id = $1 and licitacao_id = $2 returning id`,
      [id, licitacaoId]
    );
    if (!res.rows[0]) throw new Error("Registro não encontrado ou não pertence à licitação");
    await syncAllLancamentos(client);
  });
}

module.exports = { getRegistros, saveRegistros, updateRegistroPago, deleteRegistro, COLUMNS_BY_TIPO };
