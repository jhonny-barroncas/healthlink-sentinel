# Arquitetura do Sistema

Arquitetura:

Frontend ↓ API HealthLink ↓ Serviços Backend ↓ Banco de Dados ↓ Fila de
Processamento ↓ Integração Zabbix

O frontend nunca acessa diretamente o Zabbix.

O sistema deve ser preparado para multi-tenant e alta escala.
