# Changelog do Agente

## 2026-04-26 — Prompt 02 e memória de dados

- Ajustado `.codex-agent/prompts/02-mapear-dados-regras.md` para esclarecer que "somente leitura" protege runtime/código-fonte, mas não bloqueia atualização da memória `.codex-agent/`.
- Tornada obrigatória a atualização de `MAPA-MENTAL.md`, `DECISOES.md`, `GAPS.md`, `CHANGELOG-AGENTE.md` e inventário de dados durante execuções do Prompt 02.
- Criado `.codex-agent/index/INVENTARIO-DADOS.md` com campos, formatos, validações, regras observadas, hipóteses, dúvidas e bloqueios da entidade `lançamento`.
- Atualizados `MAPA-MENTAL.md`, `DECISOES.md` e `GAPS.md` com reflexões sobre competência, status, tipo, valor, comprovante, fechamento mensal e lacunas de regra de negócio.

## 2026-04-26 07:42:23

Framework implantado no projeto.

- Cliente/Projeto: R5
- Risco: audit
- Modo: audit

## 2026-04-26 — Descoberta inicial

- Lidos arquivos de governança, entrypoints estáticos e configurações de domínio.
- Detectado site estático HTML/CSS/JavaScript sem build e sem testes.
- Detectada integração direta com Google Apps Script e persistência provável em Google Sheets.
- Criado inventário inicial em `.codex-agent/index/`.
- Atualizados documentos vivos de arquitetura, riscos, gaps, padrões e scorecard.
- Criados prompts incrementais 01 a 05.

## 2026-04-26 — Prompt 01 API Apps Script

- Mapeado contrato inferido da API Apps Script a partir de `app.js`.
- Registradas decisões humanas sobre token, fechamento de competência, exclusão em mês fechado e valor zero.
- Executado teste real autorizado contra Apps Script usando competência sintética `2099-01`.
- Confirmado envelope de retorno HTTP 200 com JSON `{ ok, error }` para erros lógicos.
- Detectado bloqueio em `add` por divergência de cabeçalho na aba `Lancamentos`.
- Detectado que `options` retorna `op inválida` no backend atual.
