-- Pessoas e documentos operacionais.
-- Passageiro é a pessoa. A linha operacional aponta para ela (FK), sem copiar CPF.

create table passageiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nasc date,
  cpf text not null default '',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passageiros_cpf_formato check (cpf = '' or cpf ~ '^[0-9]{11}$')
);

create unique index passageiros_cpf_uidx on passageiros (cpf) where cpf <> '';

create table ordens_servico (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data date not null,
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  tarifa_id uuid references tarifas (id) on delete restrict,
  fornecedor_id uuid references fornecedores (id) on delete restrict,
  descricao text not null default '',
  valor numeric(14, 2) not null default 0,
  custo numeric(14, 2) not null default 0,
  lucro numeric(14, 2) generated always as (valor - custo) stored,
  status_os text not null default 'aberta' check (status_os in ('aberta', 'concluida', 'faturada')),
  pago boolean not null default false,
  comprovante_url text not null default '',
  faturado_em timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id)
);

create index ordens_competencia_idx on ordens_servico (competencia);
create index ordens_licitacao_idx on ordens_servico (licitacao_id);

create table reg_passagens (
  id uuid primary key default gen_random_uuid(),
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  passageiro_id uuid references passageiros (id) on delete restrict,
  data_solicitacao date,
  data_ida date,
  data_chegada date,
  de text not null default '',
  para text not null default '',
  horario_saida text not null default '',
  horario_chegada text not null default '',
  assento text not null default '',
  bilhete text not null default '',
  classe text not null default '',
  valor numeric(14, 2) not null default 0,
  custo numeric(14, 2) not null default 0,
  lucro numeric(14, 2) generated always as (valor - custo) stored,
  pago boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reg_passagens_licitacao_idx on reg_passagens (licitacao_id);

create function custo_efetivo_hosp(tt numeric, hosp numeric, ref numeric)
returns numeric
language sql
immutable
as $$
  select case
    when tt <> 0 then tt
    when hosp <> 0 then hosp
    else ref
  end
$$;

create table reg_hospedagem (
  id uuid primary key default gen_random_uuid(),
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  passageiro_id uuid references passageiros (id) on delete restrict,
  dt_solicitacao date,
  check_in date,
  check_out date,
  diarias numeric(14, 2) not null default 0,
  refeicoes numeric(14, 2) not null default 0,
  vlr_diaria numeric(14, 2) not null default 0,
  prev_vlr_refeicao numeric(14, 2) not null default 0,
  vlr_total numeric(14, 2) not null default 0,
  custo_hospedagem numeric(14, 2) not null default 0,
  custo_refeicao numeric(14, 2) not null default 0,
  custo_tt numeric(14, 2) not null default 0,
  lucro numeric(14, 2) generated always as (
    vlr_total - custo_efetivo_hosp(custo_tt, custo_hospedagem, custo_refeicao)
  ) stored,
  prev_pgto text not null default '',
  enviado_faturamento text not null default '',
  pago boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reg_hospedagem_licitacao_idx on reg_hospedagem (licitacao_id);

create table reg_veiculo (
  id uuid primary key default gen_random_uuid(),
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  passageiro_id uuid references passageiros (id) on delete restrict,
  data_solicitacao date,
  modelo_veiculo text not null default '',
  placa text not null default '',
  saida text not null default '',
  data date,
  valor numeric(14, 2) not null default 0,
  custo numeric(14, 2) not null default 0,
  lucro numeric(14, 2) generated always as (valor - custo) stored,
  prev_pgto text not null default '',
  enviado_faturamento text not null default '',
  pago boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reg_veiculo_licitacao_idx on reg_veiculo (licitacao_id);

create function exigir_tipo_licitacao(licitacao uuid, tipo_esperado text)
returns void
language plpgsql
as $$
declare
  tipo_real text;
begin
  select tipo into tipo_real from licitacoes where id = licitacao;
  if tipo_real is null then
    raise exception 'licitacao_inexistente' using errcode = 'P0001';
  end if;
  if tipo_real is distinct from tipo_esperado then
    raise exception 'tipo_licitacao_incompativel' using errcode = 'P0001';
  end if;
end
$$;

create function trg_reg_passagens_tipo()
returns trigger
language plpgsql
as $$
begin
  perform exigir_tipo_licitacao(new.licitacao_id, 'passagens');
  return new;
end
$$;

create trigger reg_passagens_tipo
before insert or update on reg_passagens
for each row execute function trg_reg_passagens_tipo();

create function trg_reg_hospedagem_tipo()
returns trigger
language plpgsql
as $$
begin
  perform exigir_tipo_licitacao(new.licitacao_id, 'hospedagem');
  return new;
end
$$;

create trigger reg_hospedagem_tipo
before insert or update on reg_hospedagem
for each row execute function trg_reg_hospedagem_tipo();

create function trg_reg_veiculo_tipo()
returns trigger
language plpgsql
as $$
begin
  perform exigir_tipo_licitacao(new.licitacao_id, 'veiculo');
  return new;
end
$$;

create trigger reg_veiculo_tipo
before insert or update on reg_veiculo
for each row execute function trg_reg_veiculo_tipo();
