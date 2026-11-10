-- Razão (lancamentos) é a única fonte dos totais.
-- Identidade estável: origem + origem_id + tipo. Não há sync que apague e recrie.

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  data date not null,
  licitacao_id uuid not null references licitacoes (id) on delete restrict,
  status text not null default 'em_andamento' check (status in ('em_andamento')),
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria text not null default '',
  fornecedor_id uuid references fornecedores (id) on delete restrict,
  descricao text not null default '',
  valor numeric(14, 2) not null default 0,
  comprovante_url text not null default '',
  origem text not null check (origem in ('manual', 'ordem_servico', 'reg_passagens', 'reg_hospedagem', 'reg_veiculo')),
  origem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id),
  constraint lancamentos_origem_id_chk check (
    (origem = 'manual' and origem_id is null)
    or (origem <> 'manual' and origem_id is not null)
  )
);

create unique index lancamentos_gerado_uidx
  on lancamentos (origem, origem_id, tipo)
  where origem <> 'manual' and origem_id is not null;

create index lancamentos_competencia_idx on lancamentos (competencia);
create index lancamentos_licitacao_idx on lancamentos (licitacao_id);

create table fechamentos (
  competencia text primary key check (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total_receitas numeric(14, 2) not null,
  total_despesas numeric(14, 2) not null,
  saldo numeric(14, 2) not null,
  status text not null check (status in ('aberta', 'fechada')),
  fechado_em timestamptz,
  fechado_por uuid references users (id),
  reaberto_em timestamptz,
  reaberto_por uuid references users (id),
  constraint fechamentos_saldo_chk check (saldo = total_receitas - total_despesas)
);

create function bloquear_lancamento_competencia_fechada()
returns trigger
language plpgsql
as $$
declare
  comp text;
  st text;
begin
  if tg_op = 'DELETE' then
    comp := old.competencia;
  else
    comp := new.competencia;
  end if;

  select status into st from fechamentos where competencia = comp;
  if st = 'fechada' then
    raise exception 'competencia_fechada' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.competencia is distinct from old.competencia then
    select status into st from fechamentos where competencia = old.competencia;
    if st = 'fechada' then
      raise exception 'competencia_fechada' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger lancamentos_competencia_fechada
before insert or update or delete on lancamentos
for each row execute function bloquear_lancamento_competencia_fechada();
