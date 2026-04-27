# PROMPT 00 — Descoberta Inicial do Projeto

## Modo obrigatório

SOMENTE LEITURA.

Não altere código-fonte.
Não instale dependências.
Não rode comandos destrutivos.
Não formate arquivos.
Não refatore.
Não assuma regra de negócio.

## Contexto

Leia primeiro:

- .codex-agent/PROJECT-CONTEXT.md
- .codex-agent/AGENTS.md

## Objetivo

Criar a primeira camada de inteligência técnica do projeto.

## Tarefas

1. Detectar linguagens e tecnologias principais.
2. Detectar frameworks.
3. Detectar banco de dados.
4. Detectar scripts de build, teste e execução.
5. Detectar estrutura principal de pastas.
6. Detectar módulos críticos.
7. Detectar integrações externas.
8. Detectar arquivos de configuração.
9. Detectar possíveis riscos.
10. Detectar ausência de testes/documentação/observabilidade.
11. Criar inventário inicial em .codex-agent/index/.
12. Atualizar README-PROJETO.md.
13. Atualizar MAPA-MENTAL.md.
14. Atualizar RISCOS.md.
15. Atualizar GAPS.md.
16. Atualizar PADROES.md.
17. Atualizar SCORECARD.md.
18. Atualizar CHANGELOG-AGENTE.md.
19. Criar próximos prompts incrementais em .codex-agent/prompts/.

## Regras de eficiência

- Não tente ler o projeto inteiro se ele for grande.
- Trabalhe por amostragem inteligente.
- Priorize arquivos de configuração, manifests, rotas, entrypoints, migrations, scripts e documentação.
- Classifique diretórios por relevância.
- Se o projeto for muito grande, crie plano de indexação por partes.

## Saída obrigatória

Ao final, informe:

1. Arquivos lidos.
2. Arquivos criados/alterados dentro de .codex-agent.
3. Tecnologias detectadas.
4. Riscos principais.
5. Gaps principais.
6. Próximos 5 prompts recomendados.
7. Se o projeto pode ou não sair do modo somente leitura.
