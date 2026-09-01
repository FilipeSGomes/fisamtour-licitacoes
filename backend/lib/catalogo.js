const { query } = require("./db");
const { newId } = require("./helpers");

async function listCatalogoOptions() {
  const [licRes, fornRes] = await Promise.all([
    query("select id, nome from licitacoes where status = 'ativo' order by nome"),
    query("select id, nome from fornecedores where status = 'ativo' order by nome"),
  ]);
  return { licitacoes: licRes.rows, fornecedores: fornRes.rows };
}

async function listLicitacoesMeta(includeInativas) {
  const sql = includeInativas
    ? "select id, nome, tipo, status from licitacoes order by nome"
    : "select id, nome, tipo, status from licitacoes where status = 'ativo' order by nome";
  return (await query(sql)).rows;
}

async function getLicitacaoMeta(id) {
  const res = await query("select id, nome, tipo, status from licitacoes where id = $1", [id]);
  return res.rows[0] || null;
}

const REG_TABLE_BY_TIPO = {
  passagens: "reg_passagens",
  hospedagem: "reg_hospedagem",
  veiculo: "reg_veiculo",
};

async function totaisRegistros(licitacaoId, tipo) {
  const table = REG_TABLE_BY_TIPO[tipo];
  if (!table) return { receitas: 0, despesas: 0, lucro: 0 };

  let sql;
  if (tipo === "hospedagem") {
    sql = `select
      coalesce(sum(vlr_total), 0) as receitas,
      coalesce(sum(coalesce(nullif(custo_tt, 0), nullif(custo_hospedagem, 0), custo_refeicao, 0)), 0) as despesas
      from reg_hospedagem where licitacao_id = $1 and lower(status) <> 'inativo'`;
  } else {
    sql = `select coalesce(sum(valor), 0) as receitas, coalesce(sum(custo), 0) as despesas
      from ${table} where licitacao_id = $1 and lower(status) <> 'inativo'`;
  }

  const res = await query(sql, [licitacaoId]);
  const receitas = Number(res.rows[0].receitas);
  const despesas = Number(res.rows[0].despesas);
  return { receitas, despesas, lucro: receitas - despesas };
}

async function listLicitacoesComTotais(includeInativas) {
  const list = await listLicitacoesMeta(includeInativas);
  const out = [];
  for (const lic of list) {
    out.push({ ...lic, ...(await totaisRegistros(lic.id, lic.tipo)) });
  }
  return out;
}

async function saveLicitacao(data) {
  const lic = {
    id: String(data.id || "").trim(),
    nome: String(data.nome || "").trim(),
    tipo: String(data.tipo || "").trim(),
    status: String(data.status || "ativo").trim(),
  };
  if (!lic.nome) throw new Error("nome é obrigatório");
  if (!lic.tipo) throw new Error("tipo é obrigatório");

  if (!lic.id) {
    lic.id = lic.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId("lic-");
  }

  await query(
    `insert into licitacoes (id, nome, tipo, status) values ($1,$2,$3,$4)
     on conflict (id) do update set nome=$2, tipo=$3, status=$4`,
    [lic.id, lic.nome, lic.tipo, lic.status]
  );
  return lic;
}

async function saveFornecedor(data) {
  const forn = {
    id: String(data.id || "").trim(),
    nome: String(data.nome || "").trim(),
    status: String(data.status || "ativo").trim(),
  };
  if (!forn.nome) throw new Error("nome é obrigatório");
  if (!forn.id) {
    forn.id = forn.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId("forn-");
  }
  await query(
    `insert into fornecedores (id, nome, status) values ($1,$2,$3)
     on conflict (id) do update set nome=$2, status=$3`,
    [forn.id, forn.nome, forn.status]
  );
  return forn;
}

async function listTarifas(licitacaoId) {
  const res = await query(
    "select * from tarifas where licitacao_id = $1 and lower(status) <> 'inativo' order by nome",
    [licitacaoId]
  );
  return res.rows;
}

async function saveTarifa(data) {
  const { toNumber } = require("./helpers");
  const tarifa = {
    id: String(data.id || "").trim(),
    licitacao_id: String(data.licitacao_id || "").trim(),
    codigo: String(data.codigo || "").trim(),
    nome: String(data.nome || "").trim(),
    valor: toNumber(data.valor),
    custo: toNumber(data.custo),
    editavel: (() => {
      const s = String(data.editavel ?? "").trim().toLowerCase();
      return (s === "nao" || s === "não" || s === "n" || s === "0" || s === "false" || s === "no") ? "nao" : "sim";
    })(),
    status: String(data.status || "ativo"),
  };
  if (!tarifa.licitacao_id) throw new Error("licitacao_id é obrigatório");
  if (!tarifa.nome) throw new Error("nome é obrigatório");
  if (!tarifa.id) tarifa.id = newId("t-");
  if (!tarifa.codigo) tarifa.codigo = tarifa.id;

  await query(
    `insert into tarifas (id, licitacao_id, codigo, nome, valor, custo, editavel, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set licitacao_id=$2, codigo=$3, nome=$4, valor=$5, custo=$6, editavel=$7, status=$8`,
    [tarifa.id, tarifa.licitacao_id, tarifa.codigo, tarifa.nome, tarifa.valor, tarifa.custo, tarifa.editavel, tarifa.status]
  );
  return tarifa;
}

async function listPassageiros(q) {
  const needle = (q || "").trim().toLowerCase();
  const params = needle ? [`%${needle}%`] : [];
  const where = needle ? "and (lower(nome) like $1 or lower(cpf) like $1)" : "";
  const limit = needle ? 50 : 100;
  const res = await query(
    `select id, nome, data_nasc, cpf from passageiros
     where status = 'ativo' ${where} order by nome limit ${limit}`,
    params
  );
  return res.rows;
}

module.exports = {
  REG_TABLE_BY_TIPO,
  listCatalogoOptions,
  listLicitacoesMeta,
  getLicitacaoMeta,
  totaisRegistros,
  listLicitacoesComTotais,
  saveLicitacao,
  saveFornecedor,
  listTarifas,
  saveTarifa,
  listPassageiros,
};
