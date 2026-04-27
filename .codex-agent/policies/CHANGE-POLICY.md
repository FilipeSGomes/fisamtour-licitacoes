# Política de Mudança

## Regra

Nenhuma alteração em código-fonte deve ser feita sem contrato de mudança.

## Mudanças de baixo risco

- Documentação
- Comentários não funcionais
- Scripts auxiliares fora do runtime

## Mudanças de alto risco

- Banco de dados
- Autenticação
- Autorização
- Segurança
- Fiscal
- Financeiro
- Integrações externas
- Batch/mainframe
- Performance crítica
- Código compartilhado

## Exigência para alto risco

- Contrato de mudança
- Plano de teste
- Plano de rollback
- Aprovação humana
- Diff mínimo
