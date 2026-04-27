# Inventário Inicial

Data: 2026-04-26
Modo: somente leitura para código-fonte
Escopo: descoberta inicial por amostragem inteligente

## Arquivos de Runtime
- `index.html`: estrutura da aplicação, controles, tabela, modais e carregamento de CSS/JS.
- `styles.css`: estilos, layout responsivo, tema visual e componentes.
- `app.js`: configuração, estado, renderização, filtros, cálculos, integração externa, exportação CSV e eventos.
- `logo.png`: ativo visual da marca.
- `CNAME`: domínio customizado `ponto.fisamtour.com`.

## Linguagens e Tecnologias
- HTML5.
- CSS3.
- JavaScript client-side.
- Google Apps Script como API externa.
- Google Sheets como persistência provável.
- Google Fonts.
- Hospedagem estática provável.

## Frameworks
Nenhum framework de frontend, backend, build ou teste foi detectado.

## Scripts
Não há `package.json`, scripts de build, scripts de teste ou scripts de execução do runtime.

Scripts auxiliares de governança detectados:
- `.codex-agent/scripts/start-discovery.sh`
- `.codex-agent/scripts/new-change.sh`

## Banco de Dados
Nenhum banco de dados local ou migrations detectados. A persistência real parece estar fora do repositório, provavelmente em Google Sheets por meio do Apps Script.

## Configurações
- `CONFIG` em `app.js`: URLs externas, endpoint Apps Script, token e modo mock.
- `CNAME`: domínio customizado.
- `.codex-agent/*`: governança técnica.

## Classificação de Diretórios
- Alta relevância: raiz do projeto, `.codex-agent`.
- Média relevância: `.codex-agent/prompts`, `.codex-agent/contracts`, `.codex-agent/policies`.
- Baixa relevância inicial: `.codex-agent/logs`, `.codex-agent/reports`, `.codex-agent/skills` enquanto vazios.
