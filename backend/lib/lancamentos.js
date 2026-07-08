const { query, withTransaction, withLock } = require("./db");
const { toNumber, newId } = require("./helpers");

function assertRow(r) {
  if (!r) throw new Error("row é obrigatória");
  const required = ["competencia", "data", "licitacao", "tipo", "categoria", "valor"];
  for (const k of required) {
    if (r[k] === undefined || r[k] === null || String(r[k]).trim() === "") {
      throw new Error("Campo obrigatório: " + k);
    }
  }
}

async function listLancamentos(competencia) {
  const res = await query(
    "select * from lancamentos where competencia = $1 order by data desc",
    [competencia]
  );
  return res.rows;
}

async function addLancamento(r) {
  assertRow(r);
  const id = newId("man-");
  await query(
    `insert into lancamentos
     (id, competencia, data, licitacao, status, tipo, categoria, fornecedor, descricao, valor, custo, comprovante_url, origem, origem_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'manual','')`,
    [id, String(r.competencia), String(r.data), String(r.licitacao), String(r.status || "em_andamento"),
     String(r.tipo), String(r.categoria), String(r.fornecedor || ""), String(r.descricao || ""),
     toNumber(r.valor), toNumber(r.custo), String(r.comprovante_url || "")]
  );
  return { ...r, id, origem: "manual" };
}

async function updateLancamento(r) {
  if (!r || !r.id) throw new Error("row.id é obrigatório no update");
  assertRow(r);
  const res = await query(
    `update lancamentos set competencia=$1, data=$2, licitacao=$3, status=$4, tipo=$5, categoria=$6,
     fornecedor=$7, descricao=$8, valor=$9, custo=$10, comprovante_url=$11, updated_at=now()
     where id = $12 returning *`,
    [String(r.competencia), String(r.data), String(r.licitacao), String(r.status || "em_andamento"),
     String(r.tipo), String(r.categoria), String(r.fornecedor || ""), String(r.descricao || ""),
     toNumber(r.valor), toNumber(r.custo), String(r.comprovante_url || ""), r.id]
  );
  if (!res.rows[0]) throw new Error("Lançamento não encontrado: " + r.id);
  return res.rows[0];
}

async function deleteLancamento(id) {
  if (!id) throw new Error("id é obrigatório");
  await query("delete from lancamentos where id = $1", [id]);
}

// Fecha o mês inteiro numa única transação com lock por competência: soma
// receitas/despesas e regrava o snapshot em `fechamentos` de forma atômica.
// Antes (Apps Script) eram 3 chamadas soltas à planilha sem lock — se dois
// fechamentos da mesma competência rodassem ao mesmo tempo, o resultado final
// dependia de qual terminasse por último, podendo perder dados.
async function closeMonth(competencia) {
  return withTransaction(async (client) => {
    await withLock(client, `closeMonth:${competencia}`);

    const res = await client.query(
      `select
         coalesce(sum(valor) filter (where tipo = 'receita'), 0) as receitas,
         coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as despesas
       from lancamentos where competencia = $1`,
      [competencia]
    );
    const receitas = Number(res.rows[0].receitas);
    const despesas = Number(res.rows[0].despesas);
    const saldo = receitas - despesas;
    const now = new Date().toISOString();

    await client.query(
      `insert into fechamentos (competencia, total_receitas, total_despesas, saldo, fechado_em)
       values ($1,$2,$3,$4,$5)
       on conflict (competencia) do update set total_receitas=$2, total_despesas=$3, saldo=$4, fechado_em=$5`,
      [competencia, receitas, despesas, saldo, now]
    );

    return { competencia, total_receitas: receitas, total_despesas: despesas, saldo, fechado_em: now };
  });
}

module.exports = { listLancamentos, addLancamento, updateLancamento, deleteLancamento, closeMonth };
