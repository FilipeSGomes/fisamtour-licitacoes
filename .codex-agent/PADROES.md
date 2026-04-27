# Padrões Detectados

## Código
- JavaScript procedural em arquivo único.
- Seleção de DOM por IDs centralizada em objeto `els`.
- Estado global simples em `state`.
- Funções separadas por responsabilidade: formatação, modal, filtro, resumo, renderização, data layer e wiring.
- Renderização da tabela por template string com `innerHTML`.
- Escape manual para parte dos campos textuais.

## Arquitetura
- Site estático sem build.
- Integração direta browser -> Apps Script.
- Fallback mock em memória controlado por `CONFIG.USE_MOCK`.
- API com operações nomeadas por campo `op`.

## Banco de Dados
- Nenhum banco local detectado.
- Persistência provável em Google Sheets, mediada por Apps Script.

## Testes
- Nenhum padrão de teste automatizado detectado.

## Deploy
- Publicação estática inferida.
- `CNAME` aponta para domínio customizado `ponto.fisamtour.com`.

## Nomenclatura
- IDs de formulário prefixados com `f_`.
- Classes CSS em estilo BEM aproximado: `bloco__elemento` e `bloco--modificador`.
- Status em snake_case.
- Campos de dados em português, exceto `id`.
