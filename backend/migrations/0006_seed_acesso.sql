-- Papéis e permissões. Nenhum passageiro, licitação, OS ou valor.

insert into roles (codigo, nome) values ('admin', 'Administrador')
on conflict (codigo) do nothing;

insert into permissions (codigo, descricao) values
  ('catalogo.read', 'Ler licitações, tarifas e fornecedores'),
  ('catalogo.write', 'Gravar licitações, tarifas e fornecedores'),
  ('passageiros.read', 'Ler passageiros'),
  ('passageiros.write', 'Gravar passageiros'),
  ('operacao.read', 'Ler ordens de serviço e registros'),
  ('operacao.write', 'Gravar ordens de serviço, registros e faturamento'),
  ('financeiro.read', 'Ler o razão, o dashboard e fechamentos'),
  ('financeiro.write', 'Lançar no razão'),
  ('financeiro.fechar', 'Fechar competência'),
  ('financeiro.reabrir', 'Reabrir competência'),
  ('usuarios.read', 'Ler usuários'),
  ('usuarios.write', 'Gravar usuários')
on conflict (codigo) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.codigo = 'admin'
on conflict do nothing;
