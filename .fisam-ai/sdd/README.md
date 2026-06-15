# FISAM SDD

SDD aqui significa Specification Driven Development: antes de alterar código, o framework registra contexto, requisito, decisão, contrato de mudança e validação.

## Fluxo
1. Ler PROJECT-CONTEXT.md e BRIEFING.md.
2. Rodar scan-project.sh e build-rag.sh.
3. Preencher 00-project-brief e 01-context-map com evidências do RAG.
4. Registrar requisitos em 02-requirements.
5. Registrar decisões em 03-architecture e sdd/adr.
6. Criar contrato em 05-change-contracts antes de executar mudança relevante.
7. Validar em 06-validation-plan e registrar resultado.
8. Criar ou atualizar backlog em 07-backlog antes de sincronizar GitHub Projects.

## Regra central
Nenhum agente deve tratar busca textual como RAG completo. O RAG do FISAM é o pipeline de evidência: lexical + semântico + contexto + rastreabilidade.
