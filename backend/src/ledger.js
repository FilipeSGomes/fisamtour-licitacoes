const { toCents, centsToSql, competenciaValida } = require("./money");
const { httpError } = require("./errors");

async function assertMesAberto(client, competencia) {
  if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
  const res = await client.query("select status from fechamentos where competencia = $1", [competencia]);
  if (res.rows[0]?.status === "fechada") {
    throw httpError(409, "Competência fechada. Reabra o mês para alterar o razão.");
  }
}

function dataDaLinha(origem, row) {
  if (origem === "reg_passagens") return row.data_ida || row.data_solicitacao || null;
  if (origem === "reg_hospedagem") return row.check_in || row.dt_solicitacao || null;
  if (origem === "reg_veiculo") return row.data || row.data_solicitacao || null;
  return row.data || null;
}

function receitaDoDocumento(origem, row) {
  if (origem === "reg_hospedagem") return toCents(row.vlr_total);
  return toCents(row.valor);
}

// O custo efetivo sai do lucro gerado no banco: custo = receita − lucro.
function custoDoDocumento(origem, row) {
  const receita = receitaDoDocumento(origem, row);
  return receita - toCents(row.lucro);
}

async function substituirRazao(client, spec) {
  const {
    origem, origemId, competencia, data, licitacaoId, fornecedorId,
    categoria, descricao, valorCents, custoCents, comprovanteUrl, userId,
  } = spec;
  await assertMesAberto(client, competencia);
  if (!data) {
    await client.query("delete from lancamentos where origem = $1 and origem_id = $2", [origem, origemId]);
    return;
  }

  const desejados = [];
  if (valorCents !== 0) {
    desejados.push({ tipo: "receita", valor: valorCents, descricao });
  }
  if (custoCents !== 0) {
    desejados.push({ tipo: "despesa", valor: custoCents, descricao: `Custo: ${descricao}` });
  }

  for (const tipo of ["receita", "despesa"]) {
    const linha = desejados.find((item) => item.tipo === tipo);
    if (!linha) {
      await client.query(
        "delete from lancamentos where origem = $1 and origem_id = $2 and tipo = $3",
        [origem, origemId, tipo]
      );
      continue;
    }
    await client.query(
      `insert into lancamentos
        (competencia, data, licitacao_id, tipo, categoria, fornecedor_id, descricao, valor,
         comprovante_url, origem, origem_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (origem, origem_id, tipo) where origem <> 'manual' and origem_id is not null
       do update set
         competencia = excluded.competencia,
         data = excluded.data,
         licitacao_id = excluded.licitacao_id,
         categoria = excluded.categoria,
         fornecedor_id = excluded.fornecedor_id,
         descricao = excluded.descricao,
         valor = excluded.valor,
         comprovante_url = excluded.comprovante_url,
         updated_at = now()`,
      [
        competencia, data, licitacaoId, linha.tipo, categoria || "", fornecedorId || null,
        linha.descricao, centsToSql(linha.valor), comprovanteUrl || "", origem, origemId, userId || null,
      ]
    );
  }
}

async function removerRazao(client, origem, origemId, competencia) {
  if (competencia) await assertMesAberto(client, competencia);
  await client.query("delete from lancamentos where origem = $1 and origem_id = $2", [origem, origemId]);
}

async function postarDocumento(client, origem, row, extra) {
  const data = dataDaLinha(origem, row);
  const competencia = extra.competencia || (data ? String(data).slice(0, 7) : "");
  if (!competenciaValida(competencia)) {
    await client.query("delete from lancamentos where origem = $1 and origem_id = $2", [origem, row.id]);
    return;
  }
  await substituirRazao(client, {
    origem,
    origemId: row.id,
    competencia,
    data,
    licitacaoId: row.licitacao_id,
    fornecedorId: extra.fornecedorId || null,
    categoria: extra.categoria || origem.replace("reg_", ""),
    descricao: extra.descricao || "",
    valorCents: receitaDoDocumento(origem, row),
    custoCents: custoDoDocumento(origem, row),
    comprovanteUrl: extra.comprovanteUrl || "",
    userId: extra.userId,
  });
}

module.exports = {
  assertMesAberto,
  substituirRazao,
  removerRazao,
  postarDocumento,
  receitaDoDocumento,
  custoDoDocumento,
};
