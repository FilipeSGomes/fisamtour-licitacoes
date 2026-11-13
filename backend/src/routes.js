const { query, withTransaction, withLock } = require("./db");
const { httpError } = require("./errors");
const { audit } = require("./audit");
const { toCents, centsToSql, centsToNumber, competenciaValida, pagoIn } = require("./money");
const { hashPassword } = require("./password");
const { assertMesAberto, postarDocumento, removerRazao } = require("./ledger");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(value, label) {
  const s = String(value || "").trim();
  if (!UUID_RE.test(s)) throw httpError(400, `${label} inválido`);
  return s;
}

function uuidOrNull(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return uuid(value, label);
}

function text(value, max = 500) {
  const s = String(value ?? "").trim();
  if (s.length > max) throw httpError(400, "Texto longo demais");
  return s;
}

function requiredText(value, label, max = 500) {
  const s = text(value, max);
  if (!s) throw httpError(400, `${label} é obrigatório`);
  return s;
}

function dateOrNull(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw httpError(400, "Data inválida");
  return s;
}

function urlOrEmpty(value) {
  const s = text(value, 2000);
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) throw httpError(400, "Comprovante precisa ser uma URL http(s)");
  return s;
}

function cpfOrEmpty(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (!/^\d{11}$/.test(digits)) throw httpError(400, "CPF deve ter 11 dígitos");
  return digits;
}

function num(value) {
  return centsToNumber(toCents(value));
}

function pagoOut(value) {
  return value === true ? "sim" : "nao";
}

function editavelOut(value) {
  return value === false ? "nao" : "sim";
}

function editavelIn(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (value === false || ["nao", "não", "n", "0", "false", "no"].includes(s)) return false;
  return true;
}

function mapTotais(row) {
  const receitas = toCents(row?.receitas);
  const despesas = toCents(row?.despesas);
  return {
    receitas: centsToNumber(receitas),
    despesas: centsToNumber(despesas),
    lucro: centsToNumber(receitas - despesas),
  };
}

async function totaisLicitacao(client, licitacaoId) {
  const db = client || { query };
  const res = await db.query(
    `select
       coalesce(sum(valor) filter (where tipo = 'receita'), 0) as receitas,
       coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as despesas
     from lancamentos where licitacao_id = $1`,
    [licitacaoId]
  );
  return mapTotais(res.rows[0]);
}

async function auditar(client, user, entity, entityId, action, changes) {
  await audit(client, { userId: user.id, entity, entityId, action, changes });
}

function register(app, { requireAuth, requirePerm }) {
  const auth = [requireAuth];

  app.get("/api/opcoes", ...auth, requirePerm("catalogo.read"), wrap(async (req, res) => {
    const [lic, forn] = await Promise.all([
      query("select id, nome from licitacoes where status = 'ativo' order by nome"),
      query("select id, nome from fornecedores where status = 'ativo' order by nome"),
    ]);
    res.json({ ok: true, licitacoes: lic.rows, fornecedores: forn.rows });
  }));

  app.get("/api/painel", ...auth, wrap(async (req, res) => {
    const competencia = String(req.query.competencia || "").trim();
    const perms = new Set(req.user.permissions || []);
    const out = {
      ok: true,
      competencia: competenciaValida(competencia) ? competencia : null,
      licitacoes_ativas: null,
      os_abertas: null,
      servicos_executados: null,
      razao: null,
      atividade: [],
    };
    if (perms.has("catalogo.read")) {
      const lic = await query("select count(*)::int as n from licitacoes where status = 'ativo'");
      out.licitacoes_ativas = lic.rows[0].n;
    }
    if (perms.has("operacao.read")) {
      const os = await query(
        `select
           count(*) filter (where status_os = 'aberta')::int as abertas,
           count(*) filter (where status_os in ('concluida', 'faturada'))::int as executados
         from ordens_servico
         where ativo`
      );
      out.os_abertas = os.rows[0].abertas;
      out.servicos_executados = os.rows[0].executados;
    }
    if (perms.has("financeiro.read") && out.competencia) {
      const sums = await query(
        `select
           coalesce(sum(valor) filter (where tipo = 'receita'), 0) as receitas,
           coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as despesas
         from lancamentos where competencia = $1`,
        [out.competencia]
      );
      const fech = await query("select * from fechamentos where competencia = $1", [out.competencia]);
      out.razao = {
        ...mapTotais(sums.rows[0]),
        fechamento: fech.rows[0] ? mapFechamento(fech.rows[0]) : null,
      };
    }
    if (perms.has("catalogo.read") || perms.has("operacao.read") || perms.has("financeiro.read")) {
      const logs = await query(
        `select a.entity, a.action, a.created_at, u.nome as usuario
         from audit_logs a
         left join users u on u.id = a.user_id
         order by a.created_at desc
         limit 8`
      );
      out.atividade = logs.rows.map((row) => ({
        entity: row.entity,
        action: row.action,
        created_at: row.created_at,
        usuario: row.usuario || "Sistema",
      }));
    }
    res.json(out);
  }));

  app.get("/api/licitacoes", ...auth, requirePerm("catalogo.read"), wrap(async (req, res) => {
    const include = String(req.query.include_inativas || "") === "1";
    const resRows = await query(
      `select l.id, l.nome, l.tipo, l.status,
         coalesce(sum(lc.valor) filter (where lc.tipo = 'receita'), 0) as receitas,
         coalesce(sum(lc.valor) filter (where lc.tipo = 'despesa'), 0) as despesas
       from licitacoes l
       left join lancamentos lc on lc.licitacao_id = l.id
       where ($1::boolean or l.status = 'ativo')
       group by l.id
       order by l.nome`,
      [include]
    );
    res.json({
      ok: true,
      licitacoes: resRows.rows.map((row) => ({
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        status: row.status,
        ...mapTotais(row),
      })),
    });
  }));

  app.post("/api/licitacoes", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const nome = requiredText(req.body?.nome, "Nome");
    const tipo = requiredText(req.body?.tipo, "Tipo", 40);
    if (!["passagens", "hospedagem", "veiculo", "calculadora"].includes(tipo)) {
      throw httpError(400, "Tipo de licitação inválido");
    }
    const status = req.body?.status === "inativo" ? "inativo" : "ativo";
    const saved = await withTransaction(async (client) => {
      const inserted = await client.query(
        "insert into licitacoes (nome, tipo, status) values ($1,$2,$3) returning *",
        [nome, tipo, status]
      );
      await auditar(client, req.user, "licitacoes", inserted.rows[0].id, "criar", { nome, tipo, status });
      return inserted.rows[0];
    });
    res.status(201).json({ ok: true, licitacao: saved });
  }));

  app.put("/api/licitacoes/:id", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const nome = requiredText(req.body?.nome, "Nome");
    const tipo = requiredText(req.body?.tipo, "Tipo", 40);
    if (!["passagens", "hospedagem", "veiculo", "calculadora"].includes(tipo)) {
      throw httpError(400, "Tipo de licitação inválido");
    }
    const status = req.body?.status === "inativo" ? "inativo" : "ativo";
    const saved = await withTransaction(async (client) => {
      const current = await client.query("select tipo from licitacoes where id = $1", [id]);
      if (!current.rows[0]) throw httpError(404, "Licitação não encontrada");
      if (current.rows[0].tipo !== tipo) {
        const used = await client.query(
          `select
             (select count(*) from reg_passagens where licitacao_id = $1) +
             (select count(*) from reg_hospedagem where licitacao_id = $1) +
             (select count(*) from reg_veiculo where licitacao_id = $1) as n`,
          [id]
        );
        if (Number(used.rows[0].n) > 0) throw httpError(409, "Não é possível trocar o tipo com registros existentes");
      }
      const updated = await client.query(
        "update licitacoes set nome=$2, tipo=$3, status=$4, updated_at=now() where id=$1 returning *",
        [id, nome, tipo, status]
      );
      await auditar(client, req.user, "licitacoes", id, "atualizar", { nome, tipo, status });
      return updated.rows[0];
    });
    res.json({ ok: true, licitacao: saved });
  }));

  app.post("/api/fornecedores", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const nome = requiredText(req.body?.nome, "Nome");
    const saved = await withTransaction(async (client) => {
      const inserted = await client.query(
        "insert into fornecedores (nome) values ($1) returning id, nome, status",
        [nome]
      );
      await auditar(client, req.user, "fornecedores", inserted.rows[0].id, "criar", { nome });
      return inserted.rows[0];
    });
    res.status(201).json({ ok: true, fornecedor: saved });
  }));

  app.put("/api/fornecedores/:id", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Fornecedor");
    const nome = requiredText(req.body?.nome, "Nome");
    const status = req.body?.status === "inativo" ? "inativo" : "ativo";
    const saved = await withTransaction(async (client) => {
      const updated = await client.query(
        "update fornecedores set nome=$2, status=$3, updated_at=now() where id=$1 returning id, nome, status",
        [id, nome, status]
      );
      if (!updated.rows[0]) throw httpError(404, "Fornecedor não encontrado");
      await auditar(client, req.user, "fornecedores", id, "atualizar", { nome, status });
      return updated.rows[0];
    });
    res.json({ ok: true, fornecedor: saved });
  }));

  app.get("/api/licitacoes/:id/tarifas", ...auth, requirePerm("catalogo.read"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const rows = await query(
      `select id, licitacao_id, codigo, nome, valor, custo, editavel, status
       from tarifas where licitacao_id = $1 and status = 'ativo' order by nome`,
      [id]
    );
    res.json({
      ok: true,
      tarifas: rows.rows.map((row) => ({
        ...row,
        valor: num(row.valor),
        custo: num(row.custo),
        editavel: editavelOut(row.editavel),
      })),
    });
  }));

  app.post("/api/tarifas", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const saved = await withTransaction(async (client) => salvarTarifa(client, req.user, req.body, null));
    res.status(201).json({ ok: true, tarifa: saved });
  }));

  app.put("/api/tarifas/:id", ...auth, requirePerm("catalogo.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Tarifa");
    const saved = await withTransaction(async (client) => salvarTarifa(client, req.user, req.body, id));
    res.json({ ok: true, tarifa: saved });
  }));

  app.get("/api/passageiros/opcoes", ...auth, requirePerm("passageiros.read"), wrap(async (req, res) => {
    const rows = await query(
      "select id, nome from passageiros where status = 'ativo' order by nome limit 100"
    );
    res.json({ ok: true, passageiros: rows.rows });
  }));

  app.get("/api/passageiros", ...auth, requirePerm("passageiros.read"), wrap(async (req, res) => {
    const rows = await query(
      "select id, nome, data_nasc, cpf, status from passageiros where status = 'ativo' order by nome limit 100"
    );
    res.json({ ok: true, passageiros: rows.rows });
  }));

  app.post("/api/passageiros/busca", ...auth, requirePerm("passageiros.read"), wrap(async (req, res) => {
    const q = text(req.body?.q, 120);
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 11) throw httpError(400, "A busca não aceita CPF");
    const params = [];
    let where = "status = 'ativo'";
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where += ` and lower(nome) like $${params.length}`;
    }
    const rows = await query(
      `select id, nome, data_nasc, cpf, status from passageiros where ${where} order by nome limit 50`,
      params
    );
    res.json({ ok: true, passageiros: rows.rows });
  }));

  app.post("/api/passageiros", ...auth, requirePerm("passageiros.write"), wrap(async (req, res) => {
    const nome = requiredText(req.body?.nome, "Nome");
    const dataNasc = dateOrNull(req.body?.data_nasc);
    const cpf = cpfOrEmpty(req.body?.cpf);
    const saved = await withTransaction(async (client) => {
      const inserted = await client.query(
        "insert into passageiros (nome, data_nasc, cpf) values ($1,$2,$3) returning id, nome, data_nasc, cpf, status",
        [nome, dataNasc, cpf]
      );
      await auditar(client, req.user, "passageiros", inserted.rows[0].id, "criar", { nome, status: "ativo" });
      return inserted.rows[0];
    });
    res.status(201).json({ ok: true, passageiro: saved });
  }));

  app.put("/api/passageiros/:id", ...auth, requirePerm("passageiros.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Passageiro");
    const nome = requiredText(req.body?.nome, "Nome");
    const dataNasc = dateOrNull(req.body?.data_nasc);
    const cpf = cpfOrEmpty(req.body?.cpf);
    const status = req.body?.status === "inativo" ? "inativo" : "ativo";
    const saved = await withTransaction(async (client) => {
      const updated = await client.query(
        `update passageiros set nome=$2, data_nasc=$3, cpf=$4, status=$5, updated_at=now()
         where id=$1 returning id, nome, data_nasc, cpf, status`,
        [id, nome, dataNasc, cpf, status]
      );
      if (!updated.rows[0]) throw httpError(404, "Passageiro não encontrado");
      await auditar(client, req.user, "passageiros", id, "atualizar", { nome, status });
      return updated.rows[0];
    });
    res.json({ ok: true, passageiro: saved });
  }));

  app.get("/api/ordens", ...auth, requirePerm("operacao.read"), wrap(async (req, res) => {
    const competencia = String(req.query.competencia || "").trim();
    const licitacaoId = String(req.query.licitacao_id || "").trim();
    const params = [];
    const where = ["o.ativo = true"];
    if (competencia) {
      if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
      params.push(competencia);
      where.push(`o.competencia = $${params.length}`);
    }
    if (licitacaoId) {
      params.push(uuid(licitacaoId, "Licitação"));
      where.push(`o.licitacao_id = $${params.length}`);
    }
    const rows = await query(ordemSelect(`where ${where.join(" and ")} order by o.data desc`), params);
    res.json({ ok: true, ordens: rows.rows.map(mapOrdem) });
  }));

  app.post("/api/ordens", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const saved = await withTransaction(async (client) => salvarOrdem(client, req.user, req.body, null));
    res.status(201).json({ ok: true, ordem: saved });
  }));

  app.put("/api/ordens/:id", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Ordem de serviço");
    const saved = await withTransaction(async (client) => salvarOrdem(client, req.user, req.body, id));
    res.json({ ok: true, ordem: saved });
  }));

  app.delete("/api/ordens/:id", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Ordem de serviço");
    await withTransaction(async (client) => {
      const current = await client.query("select id, competencia, ativo from ordens_servico where id = $1", [id]);
      if (!current.rows[0]) throw httpError(404, "Ordem de serviço não encontrada");
      await assertCompetenciasDaOrigem(client, "ordem_servico", id);
      await assertMesAberto(client, current.rows[0].competencia);
      await removerRazao(client, "ordem_servico", id, null);
      await client.query("update ordens_servico set ativo = false, updated_at = now() where id = $1", [id]);
      await auditar(client, req.user, "ordens_servico", id, "inativar", { ativo: false });
    });
    res.json({ ok: true });
  }));

  app.get("/api/fatura", ...auth, requirePerm("operacao.read"), wrap(async (req, res) => {
    const competencia = String(req.query.competencia || "").trim();
    const licitacaoId = uuid(req.query.licitacao_id, "Licitação");
    if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
    const rows = await query(
      ordemSelect(`where o.ativo = true and o.competencia = $1 and o.licitacao_id = $2
        and o.faturado_em is null and o.status_os <> 'faturada'
        order by o.data desc`),
      [competencia, licitacaoId]
    );
    res.json({ ok: true, ordens: rows.rows.map(mapOrdem) });
  }));

  app.post("/api/ordens/faturar", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => uuid(id, "Ordem de serviço")) : [];
    if (!ids.length) throw httpError(400, "ids é obrigatório");
    const saved = await withTransaction(async (client) => {
      await withLock(client, "faturarOrdens");
      const updated = await client.query(
        `update ordens_servico
         set status_os = 'faturada', faturado_em = now(), updated_at = now()
         where id = any($1::uuid[]) and ativo = true and faturado_em is null
         returning id`,
        [ids]
      );
      for (const row of updated.rows) {
        await auditar(client, req.user, "ordens_servico", row.id, "faturar", { status_os: "faturada" });
      }
      return updated.rows;
    });
    res.json({ ok: true, count: saved.length });
  }));

  app.get("/api/licitacoes/:id/registros", ...auth, requirePerm("operacao.read"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const lic = await query("select id, nome, tipo, status from licitacoes where id = $1", [id]);
    if (!lic.rows[0]) throw httpError(404, "Licitação não encontrada");
    const items = await listarRegistros(lic.rows[0]);
    const totais = await totaisLicitacao(null, id);
    res.json({ ok: true, licitacao: lic.rows[0], items, totais });
  }));

  app.post("/api/licitacoes/:id/registros", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const saved = await withTransaction(async (client) => gravarRegistro(client, req.user, id, req.body, null));
    res.status(201).json({ ok: true, registro: saved });
  }));

  app.put("/api/licitacoes/:id/registros/:regId", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const regId = uuid(req.params.regId, "Registro");
    const saved = await withTransaction(async (client) => gravarRegistro(client, req.user, id, req.body, regId));
    res.json({ ok: true, registro: saved });
  }));

  app.patch("/api/licitacoes/:id/registros/:regId/pago", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const regId = uuid(req.params.regId, "Registro");
    const pago = pagoIn(req.body?.pago);
    const saved = await withTransaction(async (client) => {
      const lic = await exigirLicitacao(client, id);
      const table = tabelaDoTipo(lic.tipo);
      const updated = await client.query(
        `update ${table} set pago = $3, updated_at = now() where id = $1 and licitacao_id = $2 and status = 'ativo' returning id, pago`,
        [regId, id, pago]
      );
      if (!updated.rows[0]) throw httpError(404, "Registro não encontrado");
      await auditar(client, req.user, table, regId, "pagar", { pago: pagoOut(updated.rows[0].pago) });
      return updated.rows[0];
    });
    res.json({ ok: true, registro: { id: saved.id, pago: pagoOut(saved.pago) } });
  }));

  app.delete("/api/licitacoes/:id/registros/:regId", ...auth, requirePerm("operacao.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Licitação");
    const regId = uuid(req.params.regId, "Registro");
    await withTransaction(async (client) => {
      const lic = await exigirLicitacao(client, id);
      const table = tabelaDoTipo(lic.tipo);
      const origem = table;
      await assertCompetenciasDaOrigem(client, origem, regId);
      await removerRazao(client, origem, regId, null);
      const updated = await client.query(
        `update ${table} set status = 'inativo', updated_at = now() where id = $1 and licitacao_id = $2 and status = 'ativo' returning id`,
        [regId, id]
      );
      if (!updated.rows[0]) throw httpError(404, "Registro não encontrado");
      await auditar(client, req.user, table, regId, "inativar", { status: "inativo" });
    });
    res.json({ ok: true });
  }));

  app.get("/api/lancamentos", ...auth, requirePerm("financeiro.read"), wrap(async (req, res) => {
    const competencia = String(req.query.competencia || "").trim();
    if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
    const rows = await query(
      `select lc.*, lic.nome as licitacao, f.nome as fornecedor
       from lancamentos lc
       join licitacoes lic on lic.id = lc.licitacao_id
       left join fornecedores f on f.id = lc.fornecedor_id
       where lc.competencia = $1
       order by lc.data desc, lc.tipo`,
      [competencia]
    );
    const sums = await query(
      `select
         coalesce(sum(valor) filter (where tipo = 'receita'), 0) as receitas,
         coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as despesas
       from lancamentos where competencia = $1`,
      [competencia]
    );
    const fech = await query("select * from fechamentos where competencia = $1", [competencia]);
    res.json({
      ok: true,
      rows: rows.rows.map(mapLancamento),
      totais: mapTotais(sums.rows[0]),
      fechamento: fech.rows[0] ? mapFechamento(fech.rows[0]) : null,
    });
  }));

  app.post("/api/lancamentos", ...auth, requirePerm("financeiro.write"), wrap(async (req, res) => {
    const saved = await withTransaction(async (client) => salvarLancamentoManual(client, req.user, req.body, null));
    res.status(201).json({ ok: true, row: saved });
  }));

  app.put("/api/lancamentos/:id", ...auth, requirePerm("financeiro.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Lançamento");
    const saved = await withTransaction(async (client) => salvarLancamentoManual(client, req.user, req.body, id));
    res.json({ ok: true, row: saved });
  }));

  app.delete("/api/lancamentos/:id", ...auth, requirePerm("financeiro.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Lançamento");
    await withTransaction(async (client) => {
      const current = await client.query("select id, origem, competencia from lancamentos where id = $1", [id]);
      if (!current.rows[0]) throw httpError(404, "Lançamento não encontrado");
      if (current.rows[0].origem !== "manual") {
        throw httpError(409, "Este lançamento vem de um documento. Altere a ordem de serviço ou o registro.");
      }
      await assertMesAberto(client, current.rows[0].competencia);
      await client.query("delete from lancamentos where id = $1", [id]);
      await auditar(client, req.user, "lancamentos", id, "excluir", { origem: "manual" });
    });
    res.json({ ok: true });
  }));

  app.post("/api/competencias/:competencia/fechar", ...auth, requirePerm("financeiro.fechar"), wrap(async (req, res) => {
    const competencia = req.params.competencia;
    if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
    const saved = await withTransaction(async (client) => {
      await withLock(client, `close:${competencia}`);
      const existing = await client.query("select * from fechamentos where competencia = $1", [competencia]);
      if (existing.rows[0]?.status === "fechada") return existing.rows[0];
      const sums = await client.query(
        `select
           coalesce(sum(valor) filter (where tipo = 'receita'), 0) as receitas,
           coalesce(sum(valor) filter (where tipo = 'despesa'), 0) as despesas
         from lancamentos where competencia = $1`,
        [competencia]
      );
      const receitas = toCents(sums.rows[0].receitas);
      const despesas = toCents(sums.rows[0].despesas);
      const saldo = receitas - despesas;
      const upserted = await client.query(
        `insert into fechamentos
          (competencia, total_receitas, total_despesas, saldo, status, fechado_em, fechado_por)
         values ($1,$2,$3,$4,'fechada', now(), $5)
         on conflict (competencia) do update set
           total_receitas = excluded.total_receitas,
           total_despesas = excluded.total_despesas,
           saldo = excluded.saldo,
           status = 'fechada',
           fechado_em = now(),
           fechado_por = excluded.fechado_por,
           reaberto_em = null,
           reaberto_por = null
         where fechamentos.status = 'aberta'
         returning *`,
        [competencia, centsToSql(receitas), centsToSql(despesas), centsToSql(saldo), req.user.id]
      );
      const row = upserted.rows[0] || (await client.query("select * from fechamentos where competencia = $1", [competencia])).rows[0];
      await auditar(client, req.user, "fechamentos", null, "fechar", {
        competencia,
        total_receitas: centsToNumber(receitas),
        total_despesas: centsToNumber(despesas),
        saldo: centsToNumber(saldo),
      });
      return row;
    });
    res.json({ ok: true, fechamento: mapFechamento(saved) });
  }));

  app.post("/api/competencias/:competencia/reabrir", ...auth, requirePerm("financeiro.reabrir"), wrap(async (req, res) => {
    const competencia = req.params.competencia;
    if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
    const saved = await withTransaction(async (client) => {
      await withLock(client, `close:${competencia}`);
      const updated = await client.query(
        `update fechamentos
         set status = 'aberta', reaberto_em = now(), reaberto_por = $2
         where competencia = $1 and status = 'fechada'
         returning *`,
        [competencia, req.user.id]
      );
      if (!updated.rows[0]) throw httpError(409, "Competência não está fechada");
      await auditar(client, req.user, "fechamentos", null, "reabrir", { competencia });
      return updated.rows[0];
    });
    res.json({ ok: true, fechamento: mapFechamento(saved) });
  }));

  app.get("/api/usuarios", ...auth, requirePerm("usuarios.read"), wrap(async (req, res) => {
    const rows = await query(
      `select u.id, u.nome, u.email, u.status, coalesce(array_agg(r.codigo) filter (where r.codigo is not null), '{}') as papeis
       from users u
       left join user_roles ur on ur.user_id = u.id
       left join roles r on r.id = ur.role_id
       group by u.id
       order by u.nome`
    );
    res.json({ ok: true, usuarios: rows.rows });
  }));

  app.post("/api/usuarios", ...auth, requirePerm("usuarios.write"), wrap(async (req, res) => {
    const nome = requiredText(req.body?.nome, "Nome");
    const email = requiredText(req.body?.email, "E-mail", 200).toLowerCase();
    const password = String(req.body?.password || "");
    if (password.length < 10) throw httpError(400, "Senha precisa de pelo menos 10 caracteres");
    const saved = await withTransaction(async (client) => {
      const passwordHash = await hashPassword(password);
      const inserted = await client.query(
        "insert into users (nome, email, password_hash) values ($1,$2,$3) returning id, nome, email, status",
        [nome, email, passwordHash]
      );
      await client.query(
        `insert into user_roles (user_id, role_id) select $1, id from roles where codigo = 'admin'`,
        [inserted.rows[0].id]
      );
      await auditar(client, req.user, "users", inserted.rows[0].id, "criar", { nome, email });
      return inserted.rows[0];
    });
    res.status(201).json({ ok: true, usuario: saved });
  }));

  app.put("/api/usuarios/:id", ...auth, requirePerm("usuarios.write"), wrap(async (req, res) => {
    const id = uuid(req.params.id, "Usuário");
    const nome = requiredText(req.body?.nome, "Nome");
    const status = req.body?.status === "inativo" ? "inativo" : "ativo";
    const password = req.body?.password ? String(req.body.password) : "";
    if (password && password.length < 10) throw httpError(400, "Senha precisa de pelo menos 10 caracteres");
    const saved = await withTransaction(async (client) => {
      if (status === "inativo") {
        const admins = await client.query(
          `select count(*)::int as n
           from users u
           join user_roles ur on ur.user_id = u.id
           join roles r on r.id = ur.role_id
           where r.codigo = 'admin' and u.status = 'ativo' and u.id <> $1`,
          [id]
        );
        if (admins.rows[0].n === 0) throw httpError(409, "Não é possível inativar o último administrador");
        await client.query("delete from sessions where user_id = $1", [id]);
      }
      const passwordHash = password ? await hashPassword(password) : null;
      const updated = await client.query(
        `update users set nome = $2, status = $3,
           password_hash = coalesce($4, password_hash), updated_at = now()
         where id = $1 returning id, nome, email, status`,
        [id, nome, status, passwordHash]
      );
      if (!updated.rows[0]) throw httpError(404, "Usuário não encontrado");
      await auditar(client, req.user, "users", id, "atualizar", { nome, status, senha_alterada: Boolean(password) });
      return updated.rows[0];
    });
    res.json({ ok: true, usuario: saved });
  }));
}

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
}

function ordemSelect(suffix) {
  return `select o.*, lic.nome as licitacao_nome, t.codigo as tarifa_codigo, t.nome as tarifa_nome, f.nome as fornecedor_nome
    from ordens_servico o
    join licitacoes lic on lic.id = o.licitacao_id
    left join tarifas t on t.id = o.tarifa_id
    left join fornecedores f on f.id = o.fornecedor_id
    ${suffix}`;
}

function mapOrdem(row) {
  return {
    id: row.id,
    competencia: row.competencia,
    data: row.data,
    licitacao_id: row.licitacao_id,
    licitacao_nome: row.licitacao_nome,
    tarifa_id: row.tarifa_id,
    tarifa_codigo: row.tarifa_codigo || "",
    tarifa_nome: row.tarifa_nome || "",
    fornecedor_id: row.fornecedor_id,
    fornecedor: row.fornecedor_nome || "",
    descricao: row.descricao,
    valor: num(row.valor),
    custo: num(row.custo),
    lucro: num(row.lucro),
    status_os: row.status_os,
    pago: pagoOut(row.pago),
    comprovante_url: row.comprovante_url,
    faturado_em: row.faturado_em,
  };
}

function mapLancamento(row) {
  return {
    id: row.id,
    competencia: row.competencia,
    data: row.data,
    licitacao_id: row.licitacao_id,
    licitacao: row.licitacao,
    status: row.status,
    tipo: row.tipo,
    categoria: row.categoria,
    fornecedor_id: row.fornecedor_id,
    fornecedor: row.fornecedor || "",
    descricao: row.descricao,
    valor: num(row.valor),
    comprovante_url: row.comprovante_url,
    origem: row.origem,
    origem_id: row.origem_id,
  };
}

function mapFechamento(row) {
  return {
    competencia: row.competencia,
    total_receitas: num(row.total_receitas),
    total_despesas: num(row.total_despesas),
    saldo: num(row.saldo),
    status: row.status,
    fechado_em: row.fechado_em,
    reaberto_em: row.reaberto_em,
  };
}

function tabelaDoTipo(tipo) {
  const table = { passagens: "reg_passagens", hospedagem: "reg_hospedagem", veiculo: "reg_veiculo" }[tipo];
  if (!table) throw httpError(400, "Este tipo de licitação não tem registro operacional");
  return table;
}

async function exigirLicitacao(client, id) {
  const res = await client.query("select id, nome, tipo, status from licitacoes where id = $1", [id]);
  if (!res.rows[0]) throw httpError(404, "Licitação não encontrada");
  return res.rows[0];
}

async function assertCompetenciasDaOrigem(client, origem, origemId) {
  const comps = await client.query(
    "select distinct competencia from lancamentos where origem = $1 and origem_id = $2",
    [origem, origemId]
  );
  for (const row of comps.rows) await assertMesAberto(client, row.competencia);
}

async function salvarTarifa(client, user, body, id) {
  const licitacaoId = uuid(body?.licitacao_id, "Licitação");
  const lic = await client.query("select id from licitacoes where id = $1", [licitacaoId]);
  if (!lic.rows[0]) throw httpError(404, "Licitação não encontrada");
  const nome = requiredText(body?.nome, "Nome");
  const codigo = text(body?.codigo, 80) || nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tarifa";
  const valor = centsToSql(toCents(body?.valor));
  const custo = centsToSql(toCents(body?.custo));
  const editavel = editavelIn(body?.editavel);
  const status = body?.status === "inativo" ? "inativo" : "ativo";
  const params = [licitacaoId, codigo, nome, valor, custo, editavel, status];
  const saved = id
    ? await client.query(
      `update tarifas set licitacao_id=$2, codigo=$3, nome=$4, valor=$5, custo=$6, editavel=$7, status=$8, updated_at=now()
       where id=$1 returning *`,
      [id, ...params]
    )
    : await client.query(
      `insert into tarifas (licitacao_id, codigo, nome, valor, custo, editavel, status)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      params
    );
  if (!saved.rows[0]) throw httpError(404, "Tarifa não encontrada");
  await auditar(client, user, "tarifas", saved.rows[0].id, id ? "atualizar" : "criar", {
    nome, codigo, licitacao_id: licitacaoId, status,
  });
  const row = saved.rows[0];
  return { ...row, valor: num(row.valor), custo: num(row.custo), editavel: editavelOut(row.editavel) };
}

async function salvarOrdem(client, user, body, id) {
  const licitacaoId = uuid(body?.licitacao_id, "Licitação");
  const lic = await exigirLicitacao(client, licitacaoId);
  if (!id && lic.status !== "ativo") throw httpError(400, "Licitação inativa");
  const data = dateOrNull(body?.data);
  if (!data) throw httpError(400, "Data é obrigatória");
  const competencia = competenciaValida(body?.competencia) ? body.competencia : data.slice(0, 7);
  let status = text(body?.status_os, 40) || "aberta";
  if (!["aberta", "concluida", "faturada"].includes(status)) throw httpError(400, "Status de OS inválido");
  const existing = id
    ? (await client.query("select * from ordens_servico where id = $1 and ativo = true", [id])).rows[0]
    : null;
  if (id && !existing) throw httpError(404, "Ordem de serviço não encontrada");
  if (!existing && status === "faturada") throw httpError(400, "OS nova não nasce faturada");
  if (existing?.status_os === "faturada" && status !== "faturada") {
    throw httpError(409, "OS faturada permanece faturada");
  }
  if (existing?.status_os === "faturada") status = "faturada";

  const tarifaId = uuidOrNull(body?.tarifa_id, "Tarifa");
  let tarifa = null;
  if (tarifaId) {
    const found = await client.query("select * from tarifas where id = $1 and licitacao_id = $2", [tarifaId, licitacaoId]);
    if (!found.rows[0]) throw httpError(400, "Tarifa não pertence à licitação");
    tarifa = found.rows[0];
  }
  let valor = toCents(body?.valor);
  let custo = toCents(body?.custo);
  if (tarifa && tarifa.editavel === false) {
    valor = toCents(tarifa.valor);
    custo = toCents(tarifa.custo);
  }
  const fornecedorId = uuidOrNull(body?.fornecedor_id, "Fornecedor");
  if (fornecedorId) {
    const forn = await client.query("select id from fornecedores where id = $1", [fornecedorId]);
    if (!forn.rows[0]) throw httpError(400, "Fornecedor não encontrado");
  }
  const descricao = text(body?.descricao, 500);
  const comprovante = urlOrEmpty(body?.comprovante_url);
  const pago = body?.pago === undefined && existing ? existing.pago : pagoIn(body?.pago);

  if (existing) await assertCompetenciasDaOrigem(client, "ordem_servico", existing.id);
  await assertMesAberto(client, competencia);
  if (existing && existing.competencia !== competencia) await assertMesAberto(client, existing.competencia);

  const saved = existing
    ? await client.query(
      `update ordens_servico set competencia=$2, data=$3, licitacao_id=$4, tarifa_id=$5, fornecedor_id=$6,
         descricao=$7, valor=$8, custo=$9, status_os=$10, pago=$11, comprovante_url=$12, updated_at=now()
       where id=$1 returning *`,
      [existing.id, competencia, data, licitacaoId, tarifaId, fornecedorId, descricao, centsToSql(valor), centsToSql(custo), status, pago, comprovante]
    )
    : await client.query(
      `insert into ordens_servico
        (competencia, data, licitacao_id, tarifa_id, fornecedor_id, descricao, valor, custo, status_os, pago, comprovante_url, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [competencia, data, licitacaoId, tarifaId, fornecedorId, descricao, centsToSql(valor), centsToSql(custo), status, pago, comprovante, user.id]
    );
  const row = saved.rows[0];
  await postarDocumento(client, "ordem_servico", row, {
    competencia: row.competencia,
    fornecedorId: row.fornecedor_id,
    categoria: tarifa?.codigo || "ordem",
    descricao: row.descricao || tarifa?.nome || "Ordem de serviço",
    comprovanteUrl: row.comprovante_url,
    userId: user.id,
  });
  await auditar(client, user, "ordens_servico", row.id, existing ? "atualizar" : "criar", {
    competencia, status_os: status, licitacao_id: licitacaoId,
  });
  const full = await client.query(ordemSelect("where o.id = $1"), [row.id]);
  return mapOrdem(full.rows[0]);
}

async function listarRegistros(lic) {
  if (!["passagens", "hospedagem", "veiculo"].includes(lic.tipo)) return [];
  const table = tabelaDoTipo(lic.tipo);
  const rows = await query(
    `select r.*, p.nome as colaborador
     from ${table} r
     left join passageiros p on p.id = r.passageiro_id
     where r.licitacao_id = $1 and r.status = 'ativo'
     order by r.created_at`,
    [lic.id]
  );
  return rows.rows.map((row) => mapRegistro(lic.tipo, row));
}

function mapRegistro(tipo, row) {
  const base = {
    id: row.id,
    licitacao_id: row.licitacao_id,
    passageiro_id: row.passageiro_id,
    colaborador: row.colaborador || "",
    pago: pagoOut(row.pago),
    status: row.status,
    lucro: num(row.lucro),
  };
  if (tipo === "passagens") {
    return {
      ...base,
      data_solicitacao: row.data_solicitacao,
      data_ida: row.data_ida,
      data_chegada: row.data_chegada,
      de: row.de,
      para: row.para,
      horario_saida: row.horario_saida,
      horario_chegada: row.horario_chegada,
      assento: row.assento,
      bilhete: row.bilhete,
      classe: row.classe,
      valor: num(row.valor),
      custo: num(row.custo),
    };
  }
  if (tipo === "hospedagem") {
    return {
      ...base,
      dt_solicitacao: row.dt_solicitacao,
      check_in: row.check_in,
      check_out: row.check_out,
      diarias: num(row.diarias),
      refeicoes: num(row.refeicoes),
      vlr_diaria: num(row.vlr_diaria),
      prev_vlr_refeicao: num(row.prev_vlr_refeicao),
      vlr_total: num(row.vlr_total),
      custo_hospedagem: num(row.custo_hospedagem),
      custo_refeicao: num(row.custo_refeicao),
      custo_tt: num(row.custo_tt),
      prev_pgto: row.prev_pgto,
      enviado_faturamento: row.enviado_faturamento,
    };
  }
  return {
    ...base,
    data_solicitacao: row.data_solicitacao,
    modelo_veiculo: row.modelo_veiculo,
    placa: row.placa,
    saida: row.saida,
    data: row.data,
    valor: num(row.valor),
    custo: num(row.custo),
    prev_pgto: row.prev_pgto,
    enviado_faturamento: row.enviado_faturamento,
  };
}

async function gravarRegistro(client, user, licitacaoId, body, id) {
  const lic = await exigirLicitacao(client, licitacaoId);
  const table = tabelaDoTipo(lic.tipo);
  const passageiroId = uuidOrNull(body?.passageiro_id, "Passageiro");
  let passageiro = null;
  if (passageiroId) {
    const found = await client.query("select id, nome, status from passageiros where id = $1", [passageiroId]);
    if (!found.rows[0] || found.rows[0].status !== "ativo") throw httpError(400, "Passageiro inválido");
    passageiro = found.rows[0];
  }
  const pago = pagoIn(body?.pago);
  const existing = id
    ? (await client.query(`select * from ${table} where id = $1 and licitacao_id = $2 and status = 'ativo'`, [id, licitacaoId])).rows[0]
    : null;
  if (id && !existing) throw httpError(404, "Registro não encontrado");
  if (existing) await assertCompetenciasDaOrigem(client, table, existing.id);

  let saved;
  if (lic.tipo === "passagens") {
    const values = [
      licitacaoId, passageiroId,
      dateOrNull(body?.data_solicitacao), dateOrNull(body?.data_ida), dateOrNull(body?.data_chegada),
      text(body?.de, 120), text(body?.para, 120), text(body?.horario_saida, 20), text(body?.horario_chegada, 20),
      text(body?.assento, 20), text(body?.bilhete, 80), text(body?.classe, 40),
      centsToSql(toCents(body?.valor)), centsToSql(toCents(body?.custo)), pago,
    ];
    saved = existing
      ? await client.query(
        `update reg_passagens set passageiro_id=$2, data_solicitacao=$3, data_ida=$4, data_chegada=$5,
           de=$6, para=$7, horario_saida=$8, horario_chegada=$9, assento=$10, bilhete=$11, classe=$12,
           valor=$13, custo=$14, pago=$15, updated_at=now()
         where id=$1 returning *`,
        [existing.id, ...values.slice(1)]
      )
      : await client.query(
        `insert into reg_passagens
          (licitacao_id, passageiro_id, data_solicitacao, data_ida, data_chegada, de, para,
           horario_saida, horario_chegada, assento, bilhete, classe, valor, custo, pago)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
        values
      );
  } else if (lic.tipo === "hospedagem") {
    const values = [
      licitacaoId, passageiroId,
      dateOrNull(body?.dt_solicitacao), dateOrNull(body?.check_in), dateOrNull(body?.check_out),
      centsToSql(toCents(body?.diarias)), centsToSql(toCents(body?.refeicoes)),
      centsToSql(toCents(body?.vlr_diaria)), centsToSql(toCents(body?.prev_vlr_refeicao)),
      centsToSql(toCents(body?.vlr_total)), centsToSql(toCents(body?.custo_hospedagem)),
      centsToSql(toCents(body?.custo_refeicao)), centsToSql(toCents(body?.custo_tt)),
      text(body?.prev_pgto, 80), text(body?.enviado_faturamento, 80), pago,
    ];
    saved = existing
      ? await client.query(
        `update reg_hospedagem set passageiro_id=$2, dt_solicitacao=$3, check_in=$4, check_out=$5,
           diarias=$6, refeicoes=$7, vlr_diaria=$8, prev_vlr_refeicao=$9, vlr_total=$10,
           custo_hospedagem=$11, custo_refeicao=$12, custo_tt=$13, prev_pgto=$14, enviado_faturamento=$15,
           pago=$16, updated_at=now()
         where id=$1 returning *`,
        [existing.id, ...values.slice(1)]
      )
      : await client.query(
        `insert into reg_hospedagem
          (licitacao_id, passageiro_id, dt_solicitacao, check_in, check_out, diarias, refeicoes,
           vlr_diaria, prev_vlr_refeicao, vlr_total, custo_hospedagem, custo_refeicao, custo_tt,
           prev_pgto, enviado_faturamento, pago)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,
        values
      );
  } else {
    const values = [
      licitacaoId, passageiroId, dateOrNull(body?.data_solicitacao),
      text(body?.modelo_veiculo, 80), text(body?.placa, 20), text(body?.saida, 120),
      dateOrNull(body?.data), centsToSql(toCents(body?.valor)), centsToSql(toCents(body?.custo)),
      text(body?.prev_pgto, 80), text(body?.enviado_faturamento, 80), pago,
    ];
    saved = existing
      ? await client.query(
        `update reg_veiculo set passageiro_id=$2, data_solicitacao=$3, modelo_veiculo=$4, placa=$5,
           saida=$6, data=$7, valor=$8, custo=$9, prev_pgto=$10, enviado_faturamento=$11, pago=$12, updated_at=now()
         where id=$1 returning *`,
        [existing.id, ...values.slice(1)]
      )
      : await client.query(
        `insert into reg_veiculo
          (licitacao_id, passageiro_id, data_solicitacao, modelo_veiculo, placa, saida, data,
           valor, custo, prev_pgto, enviado_faturamento, pago)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        values
      );
  }
  const row = saved.rows[0];
  const descricao = descrever(lic.tipo, row, passageiro?.nome || "");
  await postarDocumento(client, table, row, {
    categoria: lic.tipo,
    descricao,
    userId: user.id,
  });
  await auditar(client, user, table, row.id, existing ? "atualizar" : "criar", { licitacao_id: licitacaoId });
  return mapRegistro(lic.tipo, { ...row, colaborador: passageiro?.nome || "" });
}

function descrever(tipo, row, nome) {
  if (tipo === "passagens") return [row.de, row.para, nome].filter(Boolean).join(" → ") || "Passagem";
  if (tipo === "hospedagem") return `Hospedagem | ${nome}`.trim();
  return [row.saida, nome].filter(Boolean).join(" | ") || "Veículo";
}

async function salvarLancamentoManual(client, user, body, id) {
  const competencia = String(body?.competencia || "").trim();
  if (!competenciaValida(competencia)) throw httpError(400, "Competência inválida");
  const data = dateOrNull(body?.data);
  if (!data) throw httpError(400, "Data é obrigatória");
  const licitacaoId = uuid(body?.licitacao_id, "Licitação");
  const lic = await exigirLicitacao(client, licitacaoId);
  if (!id && lic.status !== "ativo") throw httpError(400, "Licitação inativa");
  const tipo = body?.tipo === "despesa" ? "despesa" : body?.tipo === "receita" ? "receita" : "";
  if (!tipo) throw httpError(400, "Tipo é obrigatório");
  const categoria = requiredText(body?.categoria, "Categoria", 80);
  const fornecedorId = uuidOrNull(body?.fornecedor_id, "Fornecedor");
  const descricao = text(body?.descricao, 500);
  const valor = centsToSql(toCents(body?.valor));
  const comprovante = urlOrEmpty(body?.comprovante_url);
  await assertMesAberto(client, competencia);
  if (id) {
    const current = await client.query("select origem, competencia from lancamentos where id = $1", [id]);
    if (!current.rows[0]) throw httpError(404, "Lançamento não encontrado");
    if (current.rows[0].origem !== "manual") throw httpError(409, "Lançamento gerado não é editável por aqui");
    await assertMesAberto(client, current.rows[0].competencia);
    const updated = await client.query(
      `update lancamentos set competencia=$2, data=$3, licitacao_id=$4, tipo=$5, categoria=$6,
         fornecedor_id=$7, descricao=$8, valor=$9, comprovante_url=$10, updated_at=now()
       where id=$1 returning *`,
      [id, competencia, data, licitacaoId, tipo, categoria, fornecedorId, descricao, valor, comprovante]
    );
    await auditar(client, user, "lancamentos", id, "atualizar", { competencia, tipo });
    return carregarLancamento(client, updated.rows[0].id);
  }
  const inserted = await client.query(
    `insert into lancamentos
      (competencia, data, licitacao_id, tipo, categoria, fornecedor_id, descricao, valor, comprovante_url, origem, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual',$10) returning id`,
    [competencia, data, licitacaoId, tipo, categoria, fornecedorId, descricao, valor, comprovante, user.id]
  );
  await auditar(client, user, "lancamentos", inserted.rows[0].id, "criar", { competencia, tipo, origem: "manual" });
  return carregarLancamento(client, inserted.rows[0].id);
}

async function carregarLancamento(client, id) {
  const res = await client.query(
    `select lc.*, lic.nome as licitacao, f.nome as fornecedor
     from lancamentos lc
     join licitacoes lic on lic.id = lc.licitacao_id
     left join fornecedores f on f.id = lc.fornecedor_id
     where lc.id = $1`,
    [id]
  );
  return mapLancamento(res.rows[0]);
}

module.exports = { register };
