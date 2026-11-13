# Backend do Ponto FISAM Tour

API e páginas do monólito local. A operação está em [`docs/operacao.md`](../docs/operacao.md).

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

O primeiro administrador sai de `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`, que não entra no git. Testes: `npm test`.

`appScript/` permanece no repositório e não é caminho de execução. Não use `migrate:csv`, CSV ou XLSX para subir o banco. Não publique este processo no site de produção a partir daqui.
