-- FISAMTOUR Licitações — schema Postgres (Supabase)
-- Substitui a planilha Google Sheets usada pelo appScript/codigo.gs.
-- Rodar uma vez no SQL editor do Supabase (ou via `psql "$DATABASE_URL" -f migrations/schema.sql`).

create table if not exists licitacoes (
  id text primary key,
  nome text not null,
  tipo text not null,
  status text not null default 'ativo'
);

create table if not exists fornecedores (
  id text primary key,
  nome text not null,
  status text not null default 'ativo'
);

create table if not exists tarifas (
  id text primary key,
  licitacao_id text not null references licitacoes(id),
  codigo text not null,
  nome text not null,
  valor numeric not null default 0,
  custo numeric not null default 0,
  editavel text not null default 'sim',
  status text not null default 'ativo'
);
create index if not exists idx_tarifas_licitacao on tarifas(licitacao_id);

create table if not exists ordens_servico (
  id text primary key,
  competencia text not null,
  data text not null,
  licitacao_id text not null references licitacoes(id),
  licitacao_nome text not null default '',
  tarifa_codigo text not null default '',
  tarifa_nome text not null default '',
  fornecedor text not null default '',
  descricao text not null default '',
  valor numeric not null default 0,
  custo numeric not null default 0,
  lucro numeric not null default 0,
  status_os text not null default 'pendente',
  pago text not null default 'nao',
  comprovante_url text not null default '',
  faturado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ordens_competencia on ordens_servico(competencia);
create index if not exists idx_ordens_licitacao on ordens_servico(licitacao_id);

create table if not exists lancamentos (
  id text primary key,
  competencia text not null,
  data text not null,
  licitacao text not null default '',
  status text not null default 'em_andamento',
  tipo text not null,
  categoria text not null default '',
  fornecedor text not null default '',
  descricao text not null default '',
  valor numeric not null default 0,
  custo numeric not null default 0,
  comprovante_url text not null default '',
  origem text not null default 'manual',
  origem_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lancamentos_competencia on lancamentos(competencia);
create index if not exists idx_lancamentos_origem on lancamentos(origem);

create table if not exists fechamentos (
  competencia text primary key,
  total_receitas numeric not null default 0,
  total_despesas numeric not null default 0,
  saldo numeric not null default 0,
  fechado_em timestamptz not null default now()
);

create table if not exists passageiros (
  id text primary key,
  nome text not null,
  data_nasc text not null default '',
  cpf text not null default '',
  status text not null default 'ativo'
);

create table if not exists reg_passagens (
  id text primary key,
  licitacao_id text not null references licitacoes(id),
  data_solicitacao text default '',
  data_ida text default '',
  data_chegada text default '',
  de text default '',
  para text default '',
  horario_saida text default '',
  horario_chegada text default '',
  assento text default '',
  bilhete text default '',
  classe text default '',
  colaborador text default '',
  cpf text default '',
  dt_nasc text default '',
  valor numeric not null default 0,
  custo numeric not null default 0,
  lucro numeric not null default 0,
  percentil numeric not null default 0,
  pago text not null default 'nao',
  status text not null default 'ativo'
);
create index if not exists idx_reg_passagens_licitacao on reg_passagens(licitacao_id);

create table if not exists reg_hospedagem (
  id text primary key,
  licitacao_id text not null references licitacoes(id),
  dt_solicitacao text default '',
  check_in text default '',
  check_out text default '',
  diarias numeric not null default 0,
  colaborador text default '',
  refeicoes numeric not null default 0,
  vlr_diaria numeric not null default 0,
  prev_vlr_refeicao numeric not null default 0,
  vlr_total numeric not null default 0,
  custo_hospedagem numeric not null default 0,
  custo_refeicao numeric not null default 0,
  custo_tt numeric not null default 0,
  lucro numeric not null default 0,
  prev_pgto text default '',
  enviado_faturamento text default '',
  pago text not null default 'nao',
  status text not null default 'ativo'
);
create index if not exists idx_reg_hospedagem_licitacao on reg_hospedagem(licitacao_id);

create table if not exists reg_veiculo (
  id text primary key,
  licitacao_id text not null references licitacoes(id),
  data_solicitacao text default '',
  modelo_veiculo text default '',
  placa text default '',
  saida text default '',
  data text default '',
  colaborador text default '',
  cpf text default '',
  dt_nascimento text default '',
  valor numeric not null default 0,
  custo numeric not null default 0,
  lucro numeric not null default 0,
  prev_pgto text default '',
  enviado_faturamento text default '',
  pago text not null default 'nao',
  status text not null default 'ativo'
);
create index if not exists idx_reg_veiculo_licitacao on reg_veiculo(licitacao_id);
