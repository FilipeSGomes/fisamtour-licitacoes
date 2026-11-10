-- Quem alterou o quê. O aplicativo não grava senha, CPF nem token nesta tabela.

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  entity text not null,
  entity_id uuid,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity, entity_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);
