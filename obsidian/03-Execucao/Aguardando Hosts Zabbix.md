# Aguardando hosts reais no Zabbix

O catálogo HealthLink possui 50 equipamentos fictícios (5 por unidade), porém a API do Zabbix retornou apenas hosts genéricos: servidor Zabbix e servidores DNS.

Não devemos associar esses hosts genéricos às unidades móveis. A infraestrutura precisa criar hosts de teste no grupo `HealthLink Sentinel`, por exemplo:

- `UMS-001-Mikrotik`
- `UMS-001-Starlink`
- `UMS-001-VPN`
- `UMS-001-Linux`
- `UMS-001-Internet`

Cada host deve receber tags `unit_code=UMS-001` e `equipment_type=<tipo>`. Depois, o HealthLink consultará novamente os hosts e salvará os mapeamentos usando os IDs reais retornados pelo Zabbix.
