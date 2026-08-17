---
type: architecture
status: accepted
---

# Arquitetura de Referência

```text
Frontend corporativo → API HealthLink → módulos de domínio
                                         ↓
                                  PostgreSQL / Redis / jobs
                                         ↓
                                 Adaptador Zabbix → API Zabbix
```

## Decisões estruturais

- Monólito modular como núcleo inicial, com API e workers separáveis no deploy.
- O estado atual de unidade/equipamento é uma projeção mantida pelo HealthLink; dashboard e mapa não consultam o Zabbix.
- Integrações são adaptadores. O primeiro é Zabbix; canais de comunicação e IA serão extensões.
- Credenciais de integração são criptografadas em repouso.
- Auditoria é append-only.

Veja também: [[Modelo de Dados]] e [[../04-Decisoes/ADR-001 Multi-tenancy desde o MVP]].
