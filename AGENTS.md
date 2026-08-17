# HealthLink Sentinel — instruções de continuidade

Antes de analisar, responder ou alterar este projeto, leia integralmente:

1. `obsidian/00-Handoff Novo Chat.md`
2. `obsidian/00-Contexto Atual.md`
3. `obsidian/00-Índice e Contexto Atual.md`
4. `obsidian/00-Mapa Mestre do Vault.md`
5. `obsidian/03-Execucao/Estado Atual.md`
6. `obsidian/01-Produto/Fonte PRD/README — Índice da fonte oficial.md`
7. A ADR aplicável em `obsidian/04-Decisoes`.
8. As notas específicas do módulo indicadas pelo Mapa Mestre.

O Mapa Mestre é a navegação obrigatória para recuperar contexto quando a tarefa envolver um módulo, integração ou decisão já documentada. Toda nova nota relevante deve ser ligada a ele, direta ou indiretamente. A nota `obsidian/00-Inbox/CREDENCIAL LOCAL — SYSADMIN.md` é conteúdo restrito: não deve ser aberta automaticamente, usada como contexto ou reproduzida.

O vault do Obsidian é a memória documental compartilhada do projeto. O código atual continua sendo a fonte de verdade para o comportamento implementado; em caso de conflito, o PRD e as ADRs prevalecem sobre notas de execução.

Após mudanças relevantes:

- atualizar o handoff e a nota específica do módulo;
- não registrar senhas, tokens ou segredos;
- executar `npm.cmd run typecheck` e `npm.cmd run build:web`;
- preservar o padrão visual dark, vidro fosco e missão crítica;
- usar `apply_patch` para editar arquivos.
