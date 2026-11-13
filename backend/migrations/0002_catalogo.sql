-- Catálogo operacional. PK uuid, valores em numeric, status ativo/inativo.

create table licitacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('passagens', 'hospedagem', 'veiculo', 'calculadora')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licitacoes_status_idx on licitacoes (status);

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tarifas (
  id uuid primary key default gen_random_uuid(),
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  codigo text not null,
  nome text not null,
  valor numeric(14, 2) not null default 0,
  custo numeric(14, 2) not null default 0,
  editavel boolean not null default true,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (licitacao_id, codigo)
);

create index tarifas_licitacao_idx on tarifas (licitacao_id);
