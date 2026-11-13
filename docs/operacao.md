# Operação local

Postgres de desenvolvimento, migrações e o primeiro administrador. Não publica em produção e não aponta para o banco do site.

## Subir o Postgres

Na raiz do repositório:

```bash
docker compose up -d
```

O serviço escuta em `127.0.0.1:54329`. Usuário, senha e banco de desenvolvimento estão em `docker-compose.yml` (`fisam` / `fisam_dev` / `fisam_ponto`). Essa senha vale só para a máquina local.

## Aplicar migrações

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
```

`npm run migrate` aplica os arquivos `backend/migrations/0001` … `0006` em ordem e registra cada um em `schema_migrations`. Não usa CSV, XLSX nem `schema.sql`.

## Primeiro administrador

No `backend/.env`, fora do git:

```bash
ADMIN_EMAIL=seu-email
ADMIN_PASSWORD=uma-senha-com-pelo-menos-10-caracteres
ADMIN_NOME=Administrador
```

O servidor cria esse usuário somente quando `users` está vazia. A senha não vai para o repositório, para o log nem para a auditoria. Se as variáveis estiverem vazias, ninguém é criado e o login fica impossível até alguém defini-las e reiniciar com a tabela ainda vazia.

```bash
npm run dev
```

Abra `http://127.0.0.1:3001/login.html`.

## Testes

Os testes usam o banco `fisam_ponto_test` no mesmo Postgres, criam os próprios usuários e apagam as tabelas de negócio entre os casos. Não carregam o `.env`.

```bash
cd backend
npm test
```

## Backup e restauração

Com o container no ar, a partir da raiz:

```bash
docker compose exec -T postgres pg_dump -U fisam -d fisam_ponto -Fc > fisam_ponto.dump
docker compose exec -T postgres pg_restore -U fisam -d fisam_ponto --clean --if-exists < fisam_ponto.dump
```

O arquivo `.dump` está no `.gitignore`. Não versione backup: ele pode conter CPF.

## LGPD, no dia a dia

- CPF fica na coluna `passageiros.cpf`. Não coloque CPF em URL, mensagem de erro, log ou auditoria.
- A busca de passageiro é `POST /api/passageiros/busca`. Uma busca com 11 dígitos ou mais é recusada sem devolver o número.
- A tela autenticada de passageiros recebe o CPF no corpo da resposta para o operador editar o cadastro. Isso não autoriza gravar CPF em arquivo de log.
- Senha é hash scrypt. O cookie de sessão é `HttpOnly`. O valor do cookie não é armazenado; o banco guarda só o hash.
