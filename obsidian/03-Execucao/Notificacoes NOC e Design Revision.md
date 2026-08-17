---
type: implementation
updated: 2026-08-10
module: frontend-alerts
---

# Notificações NOC e Revisão de Design

Data: 2026-08-10

## Implementado

### Sistema de toasts NOC (`ToastStack`)
- Componente `ToastStack` flutuante no canto superior direito.
- Tipos: `error` (vermelho, sticky), `warning` (âmbar), `success` (ciano), `info`.
- Auto-dismiss: 8s para erros, 5s para demais tipos.
- Animação de entrada `noc-toast-in` (slide + fade).
- Botão de fechar manual em cada toast.

### Notificações de ação em alertas
- `changeAlert` emite toast de sucesso ao reconhecer/resolver com detalhe legível.
- Erros de API em ações de alerta geram toast sticky (permanece até fechar manualmente).
- A área de erro global (`error-banner`) foi mantida para erros de carregamento.

### AlertsCenter refatorado
- Componente `AlertRow` extraído com estado local de loading por botão (`busy`).
- Feedback inline por alerta: borda e fundo mudam para verde (sucesso) ou vermelho com shake (erro).
- Mensagem de erro exibida diretamente dentro do card do alerta com falha.
- Botões "Reconhecer" e "Resolver" com spinner enquanto a ação está em andamento.
- Banner vermelho pulsante quando há incidentes críticos (S1/S2) ativos.
- Estado de loading: skeleton de 3 linhas enquanto carrega, indicador no heading.
- Botão "↺ Atualizar" no heading com estado disabled durante carregamento.

### Badge de severidade visual (`AlertSeverityBadge`)
- Substituiu o texto simples `S1/S2/S3` por badge estruturado.
- Níveis: CRÍTICO (S1), ALTO (S2) — vermelho pulsante; MÉDIO (S3) — âmbar; BAIXO/INFO — neutro.
- Animação `sev-critical-pulse` (ponto piscante) para S1/S2.

### Error banner aprimorado
- Layout flex com ícone `⚠`, texto e botão fechar `✕`.
- Glassmorphism com `backdrop-filter`.
- Botão fechar chama `setError('')`.

### Revisão do design system (styles.css)
- Botão `.primary` com gradiente ciano fosco (não mais sólido) + `backdrop-filter`.
- Botão `.secondary-button` com glass bordado minimalist.
- `border-radius: 10px` padronizado em todos os controles; chips/status em `999px`.
- Micro-animação `noc-shake` em card de alerta com erro.
- Skeleton de loading com animação `skeleton-shimmer`.

## Validação

- `npm.cmd run typecheck` — aprovado.
- `npm.cmd run build:web` — aprovado (71 módulos, 145KB CSS, 361KB JS gzip).

## Próximo passo

- Validar visualmente no navegador com alertas ativos e histórico.
- Considerar adicionar filtro por severidade na `AlertsCenter`.
