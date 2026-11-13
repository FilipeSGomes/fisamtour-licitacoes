const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ADMIN_URL = process.env.TEST_ADMIN_URL || "postgres://fisam:fisam_dev@127.0.0.1:54329/fisam_ponto";
const TEST_URL = process.env.TEST_DATABASE_URL || "postgres://fisam:fisam_dev@127.0.0.1:54329/fisam_ponto_test";
process.env.DATABASE_URL = TEST_URL;
process.env.ADMIN_EMAIL = "";
process.env.ADMIN_PASSWORD = "";
process.env.COOKIE_SECURE = "0";
process.env.DATABASE_SSL = "";

const { migrate } = require("../scripts/migrate");
const { hashPassword } = require("../src/password");
const { lucroCents, toCents } = require("../src/money");
const app = require("../src/app");

let server;
let base;
let pool;

async function ensureTestDatabase() {
  const admin = new Pool({ connectionString: ADMIN_URL, ssl: false });
  const exists = await admin.query("select 1 from pg_database where datname = 'fisam_ponto_test'");
  if (!exists.rowCount) await admin.query("create database fisam_ponto_test");
  await admin.end();
}

async function truncate() {
  await pool.query(`
    truncate table
      audit_logs, sessions, lancamentos, fechamentos, ordens_servico,
      reg_passagens, reg_hospedagem, reg_veiculo, tarifas, passageiros,
      fornecedores, licitacoes, user_roles, users
    restart identity cascade
  `);
}

async function api(method, pathname, { cookie, body } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return { status: res.status, json, setCookie, text };
}

function cookieFrom(res) {
  const raw = res.setCookie.find((item) => item.startsWith("sid="));
  assert.ok(raw, "cookie de sessão ausente");
  assert.match(raw, /HttpOnly/i);
  return raw.split(";")[0];
}

async function createUser(email, password, roleCodigo) {
  const hash = await hashPassword(password);
  const user = await pool.query(
    "insert into users (nome, email, password_hash) values ($1,$2,$3) returning id",
    [email, email, hash]
  );
  await pool.query(
    "insert into user_roles (user_id, role_id) select $1, id from roles where codigo = $2",
    [user.rows[0].id, roleCodigo]
  );
  return user.rows[0].id;
}

before(async () => {
  await ensureTestDatabase();
  await migrate(TEST_URL);
  pool = new Pool({ connectionString: TEST_URL, ssl: false });
  await truncate();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
});

test("usuário autorizado autentica e sem permissão recebe 403", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-abcd`;
  await createUser("admin@teste.local", password, "admin");
  await pool.query(
    "insert into roles (codigo, nome) values ('leitura', 'Somente leitura') on conflict (codigo) do nothing"
  );
  await pool.query(
    `insert into role_permissions (role_id, permission_id)
     select r.id, p.id from roles r, permissions p
     where r.codigo = 'leitura' and p.codigo = 'catalogo.read'
     on conflict do nothing`
  );
  await createUser("leitura@teste.local", password, "leitura");

  const anon = await api("GET", "/api/licitacoes");
  assert.equal(anon.status, 401);

  const bad = await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password: "errada-demais" } });
  assert.equal(bad.status, 401);

  const ok = await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } });
  assert.equal(ok.status, 200);
  const cookie = cookieFrom(ok);
  assert.equal(ok.json.user.email, "admin@teste.local");
  assert.equal(ok.json.user.password_hash, undefined);

  const me = await api("GET", "/api/auth/me", { cookie });
  assert.equal(me.status, 200);
  assert.ok(me.json.user.permissions.includes("financeiro.fechar"));

  const limitedLogin = await api("POST", "/api/auth/login", { body: { email: "leitura@teste.local", password } });
  const limited = cookieFrom(limitedLogin);
  const denied = await api("POST", "/api/licitacoes", {
    cookie: limited,
    body: { nome: "Não pode", tipo: "passagens" },
  });
  assert.equal(denied.status, 403);

  const health = await api("GET", "/api/health");
  assert.equal(health.status, 200);
});

test("cadastro persiste, relacionamento é consistente e o dado sobrevive a uma conexão nova", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-efgh`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));

  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Licitação teste", tipo: "passagens" } });
  assert.equal(lic.status, 201);
  const licitacaoId = lic.json.licitacao.id;

  const pessoa = await api("POST", "/api/passageiros", {
    cookie,
    body: { nome: "Pessoa teste", data_nasc: "1990-01-02", cpf: "52998224725" },
  });
  assert.equal(pessoa.status, 201);

  const forn = await api("POST", "/api/fornecedores", { cookie, body: { nome: "Fornecedor teste" } });
  const tarifa = await api("POST", "/api/tarifas", {
    cookie,
    body: { licitacao_id: licitacaoId, codigo: "trecho", nome: "Trecho", valor: "150.00", custo: "40.00", editavel: "nao" },
  });
  assert.equal(tarifa.status, 201);

  const os = await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-04",
      data: "2026-04-10",
      licitacao_id: licitacaoId,
      tarifa_id: tarifa.json.tarifa.id,
      fornecedor_id: forn.json.fornecedor.id,
      descricao: "Ida",
      valor: "1.00",
      custo: "1.00",
      status_os: "aberta",
    },
  });
  assert.equal(os.status, 201);
  assert.equal(os.json.ordem.valor, 150);
  assert.equal(os.json.ordem.custo, 40);
  assert.equal(os.json.ordem.fornecedor, "Fornecedor teste");

  const reg = await api("POST", `/api/licitacoes/${licitacaoId}/registros`, {
    cookie,
    body: {
      passageiro_id: pessoa.json.passageiro.id,
      data_ida: "2026-04-11",
      de: "GRU",
      para: "SSA",
      valor: "80.00",
      custo: "30.00",
    },
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.registro.colaborador, "Pessoa teste");
  assert.equal(reg.json.registro.cpf, undefined);

  const other = new Pool({ connectionString: TEST_URL, ssl: false });
  const persisted = await other.query("select nome from passageiros where id = $1", [pessoa.json.passageiro.id]);
  assert.equal(persisted.rows[0].nome, "Pessoa teste");
  await other.end();

  const joined = await pool.query(
    `select p.nome from reg_passagens r join passageiros p on p.id = r.passageiro_id where r.id = $1`,
    [reg.json.registro.id]
  );
  assert.equal(joined.rows[0].nome, "Pessoa teste");
});

test("constraint rejeita registro inválido e exclusão respeita integridade", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-ijkl`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Casa", tipo: "hospedagem" } });
  const licitacaoId = lic.json.licitacao.id;

  const pendente = await api("POST", "/api/ordens", {
    cookie,
    body: { competencia: "2026-05", data: "2026-05-01", licitacao_id: licitacaoId, valor: "10", custo: "0", status_os: "pendente" },
  });
  assert.equal(pendente.status, 400);

  const tipoErrado = await api("POST", `/api/licitacoes/${licitacaoId}/registros`, {
    cookie,
    body: { valor: "10", custo: "1", data_ida: "2026-05-02" },
  });
  assert.equal(tipoErrado.status, 201);
  const row = await pool.query("select 1 from reg_hospedagem where licitacao_id = $1", [licitacaoId]);
  assert.equal(row.rowCount, 1);
  await assert.rejects(
    pool.query("insert into reg_passagens (licitacao_id, valor, custo) values ($1, 1, 1)", [licitacaoId]),
    (err) => err.code === "P0001"
  );

  await assert.rejects(
    pool.query("delete from licitacoes where id = $1", [licitacaoId]),
    (err) => err.code === "23503"
  );

  const off = await api("PUT", `/api/licitacoes/${licitacaoId}`, {
    cookie,
    body: { nome: "Casa", tipo: "hospedagem", status: "inativo" },
  });
  assert.equal(off.status, 200);
  const options = await api("GET", "/api/opcoes", { cookie });
  assert.equal(options.json.licitacoes.find((item) => item.id === licitacaoId), undefined);
});

test("cálculo do razão não duplica documento e o dashboard reflete o banco", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-mnop`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Conta", tipo: "passagens" } });
  const licitacaoId = lic.json.licitacao.id;

  await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-06", data: "2026-06-02", licitacao_id: licitacaoId,
      descricao: "OS", valor: "100.00", custo: "40.00", status_os: "aberta",
    },
  });
  await api("POST", `/api/licitacoes/${licitacaoId}/registros`, {
    cookie,
    body: { data_ida: "2026-06-03", de: "A", para: "B", valor: "50.00", custo: "20.00" },
  });
  await api("POST", "/api/lancamentos", {
    cookie,
    body: {
      competencia: "2026-06", data: "2026-06-04", licitacao_id: licitacaoId,
      tipo: "receita", categoria: "ajuste", valor: "10.00", descricao: "Ajuste",
    },
  });

  const dash = await api("GET", "/api/lancamentos?competencia=2026-06", { cookie });
  assert.equal(dash.status, 200);
  assert.equal(dash.json.rows.length, 5);
  assert.equal(dash.json.totais.receitas, 160);
  assert.equal(dash.json.totais.despesas, 60);
  assert.equal(dash.json.totais.lucro, 100);
  assert.equal(lucroCents(toCents("160.00"), toCents("60.00")), toCents("100.00"));

  const linhas = await pool.query("select count(*)::int as n from lancamentos");
  assert.equal(linhas.rows[0].n, 5);

  const relatorio = await api("GET", "/api/licitacoes?include_inativas=1", { cookie });
  const item = relatorio.json.licitacoes.find((row) => row.id === licitacaoId);
  assert.equal(item.receitas, 160);
  assert.equal(item.despesas, 60);
  assert.equal(item.lucro, 100);

  const osValor = await pool.query("select coalesce(sum(valor),0) as v from ordens_servico");
  const regValor = await pool.query("select coalesce(sum(valor),0) as v from reg_passagens");
  const somaIngênua = toCents(osValor.rows[0].v) + toCents(regValor.rows[0].v) + toCents("160.00");
  assert.notEqual(somaIngênua, toCents("160.00"));
});

test("fechar o mês bloqueia o razão, reabrir é auditado e faturar não duplica lançamento", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-qrst`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Mês", tipo: "veiculo" } });
  const os = await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-07", data: "2026-07-08", licitacao_id: lic.json.licitacao.id,
      descricao: "Carro", valor: "20.00", custo: "5.00", status_os: "concluida", pago: "nao",
    },
  });
  const antes = await pool.query("select count(*)::int as n from lancamentos");

  const fechado = await api("POST", "/api/competencias/2026-07/fechar", { cookie, body: {} });
  assert.equal(fechado.status, 200);
  assert.equal(fechado.json.fechamento.status, "fechada");
  assert.equal(fechado.json.fechamento.saldo, 15);

  const bloqueado = await api("POST", "/api/lancamentos", {
    cookie,
    body: {
      competencia: "2026-07", data: "2026-07-09", licitacao_id: lic.json.licitacao.id,
      tipo: "receita", categoria: "extra", valor: "1.00",
    },
  });
  assert.equal(bloqueado.status, 409);

  const pago = await api("PUT", `/api/ordens/${os.json.ordem.id}`, {
    cookie,
    body: {
      competencia: "2026-07", data: "2026-07-08", licitacao_id: lic.json.licitacao.id,
      descricao: "Carro", valor: "20.00", custo: "5.00", status_os: "concluida", pago: "sim",
    },
  });
  assert.equal(pago.status, 409);

  const fatura = await api("POST", "/api/ordens/faturar", { cookie, body: { ids: [os.json.ordem.id] } });
  assert.equal(fatura.status, 200);
  assert.equal(fatura.json.count, 1);
  const depois = await pool.query("select count(*)::int as n from lancamentos");
  assert.equal(depois.rows[0].n, antes.rows[0].n);

  const reaberto = await api("POST", "/api/competencias/2026-07/reabrir", { cookie, body: {} });
  assert.equal(reaberto.status, 200);
  const trilha = await pool.query("select action from audit_logs where action = 'reabrir'");
  assert.equal(trilha.rowCount, 1);
  const trilhaTexto = await pool.query("select changes::text as c from audit_logs");
  assert.equal(trilhaTexto.rows.some((row) => /password|cpf|token/i.test(row.c)), false);
});

test("concorrência não duplica fechamento nem lançamento gerado", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-uvwx`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Paralelo", tipo: "passagens" } });
  const os = await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-08", data: "2026-08-01", licitacao_id: lic.json.licitacao.id,
      descricao: "Duplo", valor: "10.00", custo: "2.00",
    },
  });
  const body = {
    competencia: "2026-08", data: "2026-08-01", licitacao_id: lic.json.licitacao.id,
    descricao: "Duplo", valor: "11.00", custo: "3.00", status_os: "aberta",
  };
  await Promise.all([
    api("PUT", `/api/ordens/${os.json.ordem.id}`, { cookie, body }),
    api("PUT", `/api/ordens/${os.json.ordem.id}`, { cookie, body }),
    api("POST", "/api/competencias/2026-08/fechar", { cookie, body: {} }),
    api("POST", "/api/competencias/2026-08/fechar", { cookie, body: {} }),
  ]);
  const fech = await pool.query("select count(*)::int as n from fechamentos where competencia = '2026-08'");
  assert.equal(fech.rows[0].n, 1);
  const linhas = await pool.query(
    "select count(*)::int as n from lancamentos where origem = 'ordem_servico' and origem_id = $1",
    [os.json.ordem.id]
  );
  assert.ok(linhas.rows[0].n <= 2);
});

test("banco vazio responde telas e API sem planilha", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-yzab`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const dash = await api("GET", "/api/lancamentos?competencia=2026-01", { cookie });
  assert.equal(dash.status, 200);
  assert.deepEqual(dash.json.rows, []);
  assert.equal(dash.json.totais.receitas, 0);
  assert.equal(dash.json.fechamento, null);

  for (const page of ["/index.html", "/login.html", "/licitacoes.html", "/licitacao.html", "/fatura.html", "/passageiros.html", "/tunas.html", "/usuarios.html"]) {
    const res = await api("GET", page);
    assert.equal(res.status, 200, page);
    assert.doesNotMatch(res.text, /script\.google\.com|docs\.google\.com\/spreadsheets/i);
  }
  const csv = await api("GET", "/appScript/csv/passageiros.csv");
  assert.equal(csv.status, 404);

  const root = path.resolve(__dirname, "..", "..");
  const files = [
    "js/api.js", "js/shell.js", "js/ui.js", "app.js", "js/licitacao.js", "js/licitacoes.js", "js/fatura.js", "js/passageiros.js", "js/tunas.js", "js/usuarios.js",
    "index.html", "login.html", "licitacoes.html", "licitacao.html", "fatura.html", "passageiros.html", "tunas.html",
  ];
  for (const rel of files) {
    const source = fs.readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(source, /script\.google\.com|369\.87|481\.76|174\.00/);
  }
  const backendSrc = fs.readdirSync(path.join(root, "backend", "src"));
  for (const name of backendSrc) {
    const source = fs.readFileSync(path.join(root, "backend", "src", name), "utf8");
    assert.doesNotMatch(source, /script\.google\.com|369\.87|481\.76/);
  }
});

test("painel vazio devolve zero e não inventa contrato", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-pain`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const anon = await api("GET", "/api/painel?competencia=2026-09");
  assert.equal(anon.status, 401);
  const vazio = await api("GET", "/api/painel?competencia=2026-09", { cookie });
  assert.equal(vazio.status, 200);
  assert.equal(vazio.json.licitacoes_ativas, 0);
  assert.equal(vazio.json.os_abertas, 0);
  assert.equal(vazio.json.servicos_executados, 0);
  assert.equal(vazio.json.razao.receitas, 0);
  assert.equal(vazio.json.razao.despesas, 0);
  assert.equal(vazio.json.razao.lucro, 0);
  assert.deepEqual(vazio.json.atividade, []);
  assert.equal(Object.hasOwn(vazio.json, "contratos"), false);

  const lic = await api("POST", "/api/licitacoes", { cookie, body: { nome: "Painel", tipo: "passagens" } });
  await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-09", data: "2026-09-02", licitacao_id: lic.json.licitacao.id,
      descricao: "Aberta", valor: "10.00", custo: "0", status_os: "aberta",
    },
  });
  await api("POST", "/api/ordens", {
    cookie,
    body: {
      competencia: "2026-09", data: "2026-09-03", licitacao_id: lic.json.licitacao.id,
      descricao: "Feita", valor: "8.00", custo: "1.00", status_os: "concluida",
    },
  });
  const cheio = await api("GET", "/api/painel?competencia=2026-09", { cookie });
  assert.equal(cheio.json.licitacoes_ativas, 1);
  assert.equal(cheio.json.os_abertas, 1);
  assert.equal(cheio.json.servicos_executados, 1);
  assert.equal(cheio.json.razao.receitas, 18);
  assert.equal(cheio.json.razao.despesas, 1);
  assert.ok(cheio.json.atividade.length >= 1);
  assert.equal(JSON.stringify(cheio.json.atividade).toLowerCase().includes("password"), false);
});

test("CPF não aparece em auditoria, erro ou log", async () => {
  await truncate();
  const password = `senha-teste-${Date.now()}-cdef`;
  await createUser("admin@teste.local", password, "admin");
  const cookie = cookieFrom(await api("POST", "/api/auth/login", { body: { email: "admin@teste.local", password } }));
  const cpf = "39053344705";
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args.map(String).join(" "));
  try {
    const created = await api("POST", "/api/passageiros", {
      cookie,
      body: { nome: "Sigiloso", cpf },
    });
    assert.equal(created.status, 201);
    const invalid = await api("POST", "/api/passageiros", { cookie, body: { nome: "Outro", cpf: "123" } });
    assert.equal(invalid.status, 400);
    assert.equal(String(invalid.json.error).includes("123"), false);
    assert.equal(String(invalid.json.error).includes(cpf), false);
  } finally {
    console.error = original;
  }
  const audit = await pool.query("select changes::text as c from audit_logs");
  const blob = audit.rows.map((row) => row.c).join("\n") + logs.join("\n");
  assert.equal(blob.includes(cpf), false);
  assert.equal(blob.toLowerCase().includes("password"), false);
});
