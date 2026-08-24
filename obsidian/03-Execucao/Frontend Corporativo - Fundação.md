# Frontend Corporativo - Fundação

Data: 2026-08-06

## Stack

- React
- TypeScript
- Vite
- Aplicação separada em `apps/web`

## Implementado

- Login conectado à API real (`POST /v1/auth/login`).
- Sessão armazenada apenas durante a sessão do navegador.
- Shell visual de centro de comando corporativo.
- Identificação do operador e tenant ativo.
- Estado geral da operação.
- Indicadores de unidades operacionais, em atenção e indisponíveis.
- Grade de unidades consumindo `GET /v1/monitoring/units`.
- Consulta de alertas consumindo `GET /v1/monitoring/alerts`.
- Estado visual específico para `online`, `degraded`, `offline` e `unknown`.
- Layout responsivo.
- CORS restrito aos endereços locais do frontend de desenvolvimento.

## Execução

Em um terminal, manter a API:

```powershell
npm.cmd run dev
```

Em outro terminal, iniciar o frontend:

```powershell
npm.cmd run dev:web
```

O frontend escuta em todas as interfaces. Abrir `http://localhost:5173` localmente ou `http://IP-DA-MAQUINA:5173` em outro dispositivo. Se a porta estiver ocupada, o Vite usará `5174`.

## Validação

- `npm.cmd run build:web` concluído com sucesso.
- Typecheck do frontend concluído com sucesso.
- Typecheck da API concluído com sucesso.

## Correção da barra lateral recolhível — 2026-08-24

- No modo compacto, rótulos e metadados ocultos deixam de participar do cálculo de largura, evitando que os ícones sejam empurrados ou cortados.
- No modo expandido por hover/foco, a barra lateral usa uma camada superior à topbar para que logo, navegação e rodapé não sejam recortados pelo conteúdo principal.
- A regressão é coberta por `apps/web/src/sidebar-collapse.test.ts`.

## Próximo passo

Validar o login no navegador e evoluir a navegação para detalhe de unidade e central de alertas.
