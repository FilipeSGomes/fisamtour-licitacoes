# Mapa Mental Técnico

## Domínios
- Licitações.
- Lançamentos financeiros.
- Competência mensal.
- Receitas, despesas e saldo.
- Fornecedores.
- Comprovantes.
- Fechamento mensal.

## Fluxos Críticos
- Carregar lançamentos da competência selecionada.
- Filtrar lançamentos por texto e status.
- Criar ou editar lançamento.
- Excluir lançamento.
- Calcular totais de receitas, despesas e saldo.
- Exportar CSV da visão filtrada.
- Fechar mês via API externa.

## Dependências
- Navegador moderno com suporte a `fetch`, `Intl.NumberFormat`, `Blob`, `URL.createObjectURL` e `replaceAll`.
- Google Apps Script externo.
- Google Fonts.
- Ativo local `logo.png`.

## Pontos de Acoplamento
- IDs de elementos HTML usados diretamente por `app.js`.
- Campos esperados no payload da API: `id`, `competencia`, `data`, `licitacao`, `status`, `tipo`, `categoria`, `fornecedor`, `descricao`, `valor`, `comprovante_url`.
- Operações esperadas da API: `list`, `options`, `add`, `update`, `delete`, `closeMonth`.
- Valores fixos de status: `em_andamento`, `ganho`, `perdido`.
- Valores fixos de tipo: `receita`, `despesa`.

## Mapa de Pastas
- `/`: runtime estático do sistema.
- `/.codex-agent`: governança técnica e documentação viva.
- `/.codex-agent/index`: inventário técnico inicial.
- `/.codex-agent/prompts`: prompts incrementais para próximas análises.
- `/.codex-agent/contracts`: contratos futuros de mudança.

## Mapa de Dados
Entidade principal inferida: lançamento.

Campos inferidos: competência, data, tipo, licitação, status, categoria, fornecedor, descrição, valor e URL de comprovante.

Fonte de verdade: não está no repositório. Provável Google Sheets acessado pelo Apps Script.

Inventário detalhado: `.codex-agent/index/INVENTARIO-DADOS.md`.

### Regras e Validações Observadas
- `competencia` usa formato `YYYY-MM` e controla listagem, criação e fechamento mensal.
- `data` usa formato `YYYY-MM-DD`; o frontend não valida se a data pertence à competência selecionada.
- `tipo` observado: `receita` ou `despesa`.
- `status` observado: `em_andamento`, `ganho` ou `perdido`.
- `valor` é normalizado por `parseMoney`, aceitando vírgula ou ponto; valor `0` passa pela validação atual.
- Resumo financeiro: receitas somam linhas com `tipo === "receita"`; demais linhas entram como despesas no cálculo atual.
- Saldo exibido: receitas menos despesas.
- `fornecedor`, `descricao` e `comprovante_url` são opcionais no frontend.
- `comprovante_url` é renderizado como link sem validação de domínio/protocolo no frontend.

### Reflexões Registradas
- O mapeamento confirma campos já listados nos pontos de acoplamento.
- O campo `competencia` parece independente de `data`; isso precisa virar pergunta, não regra assumida.
- A regra de fechamento mensal está parcialmente decidida (`closeMonth` deve travar competência), mas falta contrato operacional.
- A regra de status é apenas enumeração técnica; significado de negócio ainda não está formalizado.

## Mapa de Integrações
- Frontend -> Apps Script por GET para `list` e `options`.
- Frontend -> Apps Script por POST para `add`, `update`, `delete` e `closeMonth`.
- Frontend -> Google Fonts no carregamento da página.
- Frontend -> Instagram/WhatsApp por links externos.
