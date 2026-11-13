-- Identidade. Não existia no sistema antigo (token compartilhado).

create table users (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  password_hash text not null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_lower_uidx on users (lower(email));

create table roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null
);

create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_id uuid not null references permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null references users (id) on delete cascade,
  role_id uuid not null references roles (id) on delete restrict,
  primary key (user_id, role_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_idx on sessions (user_id);
