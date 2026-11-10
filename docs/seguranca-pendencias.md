# Pendências de segurança

O repositório no GitHub é público. Esta fundação não reescreve o histórico e não faz force-push.

## Token da API antiga

O token compartilhado do Apps Script está commitado no histórico, em especial no cliente antigo, em `appScript/codigo.gs` e em `scripts/test_api.sh`. Quem clonar o repositório consegue o valor. O proprietário precisa revogar esse token e restringir a implantação do Apps Script. Trocar o texto no código novo não invalida a cópia que já está no git.

A fundação não usa mais esse token em tempo de execução. O acesso passou a ser sessão. O valor não é repetido aqui.

## CPF e outros dados pessoais no histórico

Há CPF, nome e data de nascimento em arquivos já versionados, entre eles os CSV em `appScript/csv/` e a planilha `LICITACÕES.xlsx`. Esses dados continuam no histórico do git até uma limpeza autorizada pelo proprietário. Esta etapa não apaga commits, não reescreve o passado e não copia esses arquivos para o Postgres.

Não commitar de novo CSV com CPF, a planilha com dados reais nem backup `pg_dump`.

## PDF não rastreado

`Ata+de+Ristro+de+Preco+8-2026.pdf` está fora do git. Não versionar sem revisão: pode ser documento de preço, não especificação do sistema.

## O que a fundação já faz

- senha com hash; cookie `HttpOnly`;
- CPF fora de log, URL, erro e auditoria;
- arquivos de planilha, `appScript/`, `backend/` e `docs/` não são servidos pelo processo web;
- `.env` está no `.gitignore`.
