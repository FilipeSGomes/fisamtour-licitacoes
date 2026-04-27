# README Técnico Vivo do Projeto

## Visão Geral
Projeto estático para controle interno de licitações e fechamento mensal da FISAM Tour. A interface permite listar, filtrar, incluir, editar, excluir e exportar lançamentos, além de acionar fechamento de competência.

Classificação operacional atual: R5/audit pela governança do projeto. Qualquer alteração em código-fonte exige contrato de mudança, plano de teste, rollback e aprovação humana.

## Stack Detectada
- HTML5 em `index.html`.
- CSS3 puro em `styles.css`.
- JavaScript puro no navegador em `app.js`.
- API externa via `fetch` para Google Apps Script.
- Hospedagem estática provável por domínio customizado em `CNAME`.

## Como Rodar
Não há script de execução detectado. Por ser site estático, pode ser aberto diretamente pelo `index.html` ou servido por qualquer servidor HTTP estático.

## Como Testar
Não há testes automatizados detectados. Validação atual precisa ser manual no navegador, cobrindo carregamento inicial, filtros, CRUD, exportação CSV e fechamento de mês.

## Como Fazer Build
Não há etapa de build detectada. Os arquivos publicados parecem ser diretamente `index.html`, `styles.css`, `app.js`, `logo.png` e `CNAME`.

## Como Fazer Deploy
Deploy não documentado no projeto. A presença de `CNAME` com `ponto.fisamtour.com` sugere hospedagem estática com domínio customizado, possivelmente GitHub Pages, mas isso ainda precisa ser confirmado.

## Estrutura de Pastas
- Raiz: arquivos do site estático.
- `.codex-agent/`: governança, documentação viva, contratos, prompts, scripts auxiliares e inventários.
- `.git/`: controle de versão.

## Arquitetura Real
Arquitetura client-side simples:

1. `index.html` define a estrutura da tela, modais, tabela e formulário.
2. `styles.css` aplica layout, responsividade e identidade visual.
3. `app.js` concentra configuração, estado em memória, renderização, filtros, parsing monetário, chamadas à API, exportação CSV e wiring de eventos.
4. Google Apps Script expõe operações `list`, `options`, `add`, `update`, `delete` e `closeMonth`; a persistência provável é Google Sheets.

## Módulos Críticos
- Configuração da API e token em `app.js`.
- Camada de dados: `fetchRows`, `saveRow`, `deleteRow`, `closeMonth`, `fetchOptions`.
- Cálculos de resumo financeiro: `computeSummary`.
- Formulário de lançamento e parsing de valores: `parseMoney` e handler de submit.
- Exportação CSV: `exportCSV`.
- Renderização da tabela: `renderTable`.

## Banco de Dados
Nenhum banco local detectado. Persistência provável via Google Sheets por trás do Google Apps Script configurado em `CONFIG.API_URL`.

## Integrações
- Google Apps Script: endpoint público configurado em `app.js`.
- Google Fonts: `Playfair Display` e `Inter`.
- Instagram e WhatsApp por links externos.
- Domínio customizado `ponto.fisamtour.com` em `CNAME`.

## Autenticação e Autorização
Não há autenticação de usuário no frontend. Existe um `API_TOKEN` hardcoded no JavaScript, visível para qualquer usuário que carregue o site. Autorização real, se existir, depende do Apps Script externo e não está versionada neste repositório.

## Observabilidade
Não há logs estruturados, monitoramento, telemetria, rastreamento de erros ou health check detectados.

## Riscos
- Token de API exposto no frontend.
- Operações financeiras e de fechamento mensal sem trilha de auditoria visível no repositório.
- Backend/API não versionado junto ao frontend.
- Ausência de testes automatizados.
- Ausência de documentação de deploy e rollback.
- Manipulação de comprovante por URL sem validação explícita no frontend.

## Gaps
- Contrato da API e schema de dados não documentados.
- Regras de negócio de licitações, receitas, despesas e fechamento mensal não formalizadas.
- Sem testes automatizados.
- Sem política documentada de segurança, permissões ou rotação de token.
- Sem observabilidade.
- Sem documentação operacional de deploy.

## Próximos Passos
1. Mapear contrato real da API Apps Script e schema da planilha.
2. Classificar dados sensíveis e requisitos de acesso.
3. Criar plano de testes manuais e automatizados mínimos.
4. Documentar fluxo de deploy e rollback.
5. Abrir contrato de mudança antes de qualquer alteração no código-fonte.
