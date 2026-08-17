# Geolocalização automática via Zabbix

## Regra de origem

O HealthLink consulta o inventário do host no Zabbix (`location_lat` e `location_lon`). Durante a sincronização, quando um host está vinculado a um equipamento e a unidade ainda não possui latitude/longitude, as coordenadas válidas são gravadas automaticamente na unidade.

## Proteção contra sobrescrita

Coordenadas já cadastradas manualmente nunca são substituídas pela sincronização. Isso preserva a decisão operacional do usuário.

## Fallback manual

Se o inventário do Zabbix não tiver coordenadas válidas — situação comum para IPs privados, como `10.x.x.x` — a unidade permanece como localização pendente. O usuário pode preencher latitude e longitude pelo cadastro/edição ou pelo botão `+` no mapa estadual.

## Observação

Geolocalizar um IP privado automaticamente por serviço público não é confiável e pode expor informação de infraestrutura. A fonte automática oficial é o inventário do Zabbix; geocodificação externa pode ser avaliada futuramente com aprovação de segurança.
