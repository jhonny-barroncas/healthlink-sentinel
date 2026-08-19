import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/HealthLink-Sentinel-Apresentacao-Corporativa-final-v3.pptx';
const W=1280,H=720;
const C={bg:'#07131f',surface:'#102334',surface2:'#153149',ink:'#f4f8fb',muted:'#a8bac7',cyan:'#39c6d8',green:'#59d49a',amber:'#f6b95b',red:'#f06d78',line:'#28485d'};
const p=Presentation.create({slideSize:{width:W,height:H}});
const imgCentro=await fs.readFile('C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/real-centro-wide.png');
const imgAlertas=await fs.readFile('C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/real-alertas-wide.png');
const imgUnidades=await fs.readFile('C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/real-unidades-wide.png');
function shape(s,geometry,pos,fill='none',line='none',radius='rounded-xl'){const o={geometry,position:pos,fill,line:line==='none'?{style:'solid',fill:'none',width:0}:{style:'solid',fill:line,width:1}};if(['rect','textbox','roundRect'].includes(geometry))o.borderRadius=radius;return s.shapes.add(o);}
function txt(s,text,x,y,w,h,size=20,color=C.ink,bold=false){const t=shape(s,'textbox',{left:x,top:y,width:w,height:h});t.text=text;t.text.style={fontSize:size,color,bold,fontFace:'Aptos',breakLine:false};return t;}
function line(s,x1,y1,x2,y2,color=C.line,width=2){return s.shapes.add({geometry:'line',position:{left:x1,top:y1,width:x2-x1,height:y2-y1},line:{style:'solid',fill:color,width}});}
function footer(s,n){txt(s,'HEALTHLINK SENTINEL  /  VISÃO CORPORATIVA',72,678,500,20,12,C.muted,true);txt(s,String(n).padStart(2,'0'),1160,678,48,20,12,C.muted,true);}
function title(s,kicker,headline,sub=''){txt(s,kicker.toUpperCase(),72,48,700,22,13,C.cyan,true);txt(s,headline,72,88,1120,72,35,C.ink,true);if(sub)txt(s,sub,72,166,1060,36,18,C.muted);}
function dot(s,x,y,color){shape(s,'ellipse',{left:x,top:y,width:14,height:14},color,'none','rounded-full');}
function card(s,x,y,w,h,head,body,color=C.cyan){shape(s,'roundRect',{left:x,top:y,width:w,height:h},C.surface,C.line);dot(s,x+24,y+26,color);txt(s,head,x+50,y+20,w-70,30,22,C.ink,true);txt(s,body,x+24,y+66,w-48,h-82,16,C.muted);}
function image(s,bytes,x,y,w,h,alt){s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt,fit:'cover',position:{left:x,top:y,width:w,height:h},geometry:'roundRect',borderRadius:'rounded-xl'});}
function addNotes(s,source){try{if(s.notes){s.notes.text='[Sources]\n'+source;}}catch(e){}}

// 1
{const s=p.slides.add();s.background.fill=C.bg;shape(s,'rect',{left:0,top:0,width:W,height:H},C.bg);shape(s,'rect',{left:0,top:0,width:18,height:H},C.cyan);txt(s,'HEALTHLINK',72,82,620,72,54,C.ink,true);txt(s,'SENTINEL',72,148,620,72,54,C.cyan,true);txt(s,'Uma camada operacional para transformar telemetria em decisão.',76,250,760,42,24,C.muted);shape(s,'roundRect',{left:800,top:90,width:360,height:420},C.surface,C.line);txt(s,'DOIS MÓDULOS',836,130,250,26,15,C.cyan,true);txt(s,'01',836,190,80,50,34,C.green,true);txt(s,'Monitoramento\nde infraestrutura',836,242,260,70,23,C.ink,true);line(s,836,334,1110,334,C.line,2);txt(s,'02',836,365,80,50,34,C.amber,true);txt(s,'Links de unidades\nmóveis + suporte',836,417,260,70,23,C.ink,true);txt(s,'Apresentação executiva  |  2026',76,612,400,25,15,C.muted);addNotes(s,'Fonte: PRD oficial HealthLink Sentinel; contexto e estado atual do projeto.');}
// 2
{const s=p.slides.add();s.background.fill=C.bg;title(s,'A oportunidade','O Zabbix coleta muito. A operação precisa entender rápido.','O HealthLink Sentinel organiza o dado técnico no contexto da unidade, do link e da missão.');
card(s,72,260,330,210,'O que existe','Métricas, hosts, itens, triggers e eventos distribuídos em uma camada técnica.',C.muted);
card(s,475,260,330,210,'O que falta','Contexto operacional: qual unidade está comprometida, por quê e qual ação vem agora.',C.amber);
card(s,878,260,330,210,'O que muda','Uma visão executiva e operacional, com estado consolidado, mapa, alerta e histórico.',C.cyan);
txt(s,'Zabbix permanece como motor de coleta. A inteligência operacional pertence ao HealthLink.',72,210,1100,30,18,C.ink,true);image(s,imgCentro,72,495,540,150,'Centro Operacional real');image(s,imgAlertas,668,495,540,150,'Central de Alertas real');footer(s,2);addNotes(s,'Fonte: PRD 01-VISAO-PRODUTO e ZABBIX-API. Capturas reais do sistema em 18/08/2026.');}
// 3
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Posicionamento','HealthLink Sentinel é a camada de operação acima do Zabbix.','Preserva o investimento existente e acrescenta contexto, governança e fluidez para quem decide.');
// connectors first
line(s,300,350,510,350,C.cyan,4);line(s,770,350,980,350,C.green,4);
shape(s,'roundRect',{left:72,top:270,width:228,height:160},C.surface,C.line);txt(s,'FONTES',102,302,150,25,15,C.muted,true);txt(s,'Zabbix\nStarlink\nMikroTik',102,340,180,90,24,C.ink,true);
shape(s,'roundRect',{left:510,top:245,width:260,height:210},C.cyan,'none');txt(s,'HEALTHLINK\nSENTINEL',548,298,190,70,27,C.bg,true);txt(s,'normaliza • correlaciona\nprojeta • audita',548,385,190,48,16,C.bg,true);
shape(s,'roundRect',{left:980,top:270,width:228,height:160},C.surface,C.line);txt(s,'RESULTADO',1010,302,160,25,15,C.muted,true);txt(s,'NOC\nGestão\nSuporte',1010,340,180,90,24,C.ink,true);
txt(s,'A integração é evolutiva: o motor existente continua; a experiência e a governança avançam.',72,550,1120,40,23,C.ink,true);footer(s,3);addNotes(s,'Fonte: PRD oficial, ADR-001 e notas de execução de integração Zabbix/Starlink.');}
// 4
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Módulo 01','Monitoramento de infraestrutura com contexto operacional.','Uma visão consolidada para servidores, rede, VPN, equipamentos e disponibilidade das unidades.');
card(s,72,250,350,220,'Mapa operacional','Brasil por estado, unidades e pior estado herdado entre equipamentos ativos.',C.cyan);
card(s,465,250,350,220,'Central de alertas','Incidentes ativos, reconhecimento, severidade, histórico e ciclo de vida.',C.red);
card(s,858,250,350,220,'Integração governada','Hosts autorizados, sugestões de vínculo, sincronização, saúde e auditoria.',C.green);
txt(s,'O operador deixa de procurar “qual host falhou?” e passa a responder “qual unidade está em risco?”.',72,210,1120,30,18,C.ink,true);image(s,imgCentro,72,495,540,150,'Mapa operacional real');image(s,imgAlertas,668,495,540,150,'Alertas reais');footer(s,4);addNotes(s,'Fonte: PRD MODULOS, MAPA-INTERATIVO, ZABBIX-API e Operação de Monitoramento - Fase 3. Capturas reais do sistema em 18/08/2026.');}
// 5
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Módulo 01','Diferenciais sobre o Zabbix para a operação.','O valor está na tradução do evento técnico para uma decisão rastreável.');
const rows=[['Contexto','Host / trigger','Unidade / equipamento / impacto'],['Visão','Telas técnicas','Mapa + estado consolidado + detalhe'],['Ação','Reconhecer problema','Diagnosticar, registrar e acompanhar'],['Governança','Configuração distribuída','RBAC, multi-tenant, auditoria e histórico'],['Confiabilidade','Último valor disponível','Telemetria stale vira unknown; histórico preservado']];
txt(s,'ZABBIX',250,232,220,24,15,C.muted,true);txt(s,'HEALTHLINK SENTINEL',720,232,300,24,15,C.cyan,true);line(s,72,270,1208,270,C.line,2);
rows.forEach((r,i)=>{const y=290+i*65;txt(s,r[0],72,y,150,28,19,C.ink,true);txt(s,r[1],250,y,370,28,18,C.muted);txt(s,r[2],720,y,460,28,18,C.ink,true);line(s,72,y+42,1208,y+42,C.line,1);});
footer(s,5);addNotes(s,'Fonte: PRD ZABBIX-API; Operação de Monitoramento - Fase 3; Estado Atual.');}
// 6
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Módulo 02','Gestão de links das unidades móveis + suporte.','Uma visão específica para conectividade em campo: link, antena, caminho, agente e atendimento.');
card(s,72,245,270,235,'Link','Plano contratado x tráfego atual; latência, perda e disponibilidade.',C.amber);
card(s,373,245,270,235,'Unidade móvel','Starlink como fonte primária; MikroTik como caminho e interfaces.',C.cyan);
card(s,674,245,270,235,'Suporte','Diagnóstico de ping/tracert, origem da métrica e evidência para o chamado.',C.green);
card(s,975,245,233,235,'Continuidade','Fila local, retry, envio idempotente e telemetria stale explícita.',C.red);
txt(s,'A conectividade deixa de ser apenas “online/offline” e passa a ser gerenciável.',72,210,1100,30,18,C.ink,true);image(s,imgUnidades,72,495,1136,150,'Estado das unidades móveis real');footer(s,6);addNotes(s,'Fonte: Plano de Coleta Starlink e Unidade Movel; Módulo Starlink - Estratégia Híbrida; Estado Atual. Captura real do sistema em 18/08/2026.');}
// 7
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Módulo 02','Arquitetura híbrida para operar onde o servidor central não alcança.','O servidor local da unidade coleta, normaliza e entrega telemetria com segurança.');
// connectors first
line(s,260,360,430,360,C.cyan,3);line(s,650,360,820,360,C.green,3);line(s,1040,360,1170,360,C.amber,3);
const nodes=[['HEALTHLINK\nAPI + jobs',72,C.surface,C.cyan],['SERVIDOR LOCAL\nagente + fila',430,C.surface,C.green],['STARLINK\ngRPC local',820,C.surface,C.amber],['MIKROTIK\nSNMP/API',1040,C.surface,C.cyan]];
nodes.forEach(([t,x,fill,col])=>{shape(s,'roundRect',{left:x,top:290,width:190,height:140},fill,col);txt(s,t,x+24,326,145,60,20,C.ink,true);});
txt(s,'HTTPS/VPN autenticada',272,410,180,22,14,C.muted);txt(s,'LAN da unidade',670,410,130,22,14,C.muted);txt(s,'opcional',1080,410,100,22,14,C.muted);
txt(s,'O frontend consulta apenas projeções da API — nunca acessa diretamente a rede da unidade.',72,550,1120,42,23,C.ink,true);footer(s,7);addNotes(s,'Fonte: Plano de Coleta Starlink e Unidade Movel; ADR-001 Multi-tenancy desde o MVP.');}
// 8
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Confiabilidade e segurança','O sistema evita decisões baseadas em telemetria velha ou contexto incompleto.','As regras de confiança são parte do produto, não apenas da infraestrutura.');
card(s,72,250,350,220,'Telemetria stale','Após 30s sem amostra: estado unknown, indicadores atuais zerados e histórico preservado.',C.red);
card(s,465,250,350,220,'Fonte explícita','Cada métrica preserva origem, timestamp e qualidade; campo ausente aparece como N/D.',C.cyan);
card(s,858,250,350,220,'Acesso controlado','Multi-tenant desde o MVP, RLS, RBAC, agente com identidade própria e auditoria.',C.green);
txt(s,'Resultado: menos “verde falso”, menos ambiguidade e mais confiança na ação.',72,550,1100,42,23,C.ink,true);footer(s,8);addNotes(s,'Fonte: ADR-001; Módulo Starlink - Estratégia Híbrida; Operação de Monitoramento - Fase 3.');}
// 9
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Valor para a equipe de desenvolvimento','Uma plataforma que organiza evolução, integração e operação em torno do domínio.','A arquitetura permite ampliar fontes e módulos sem reescrever a experiência operacional.');
const vals=[['Reuso','Zabbix continua sendo aproveitado como coletor e fonte de problemas.'],['Evolução','Starlink, MikroTik e novos adaptadores entram por contratos normalizados.'],['Operabilidade','Diagnóstico, saúde do agente, fila e sincronização são visíveis.'],['Produto','O dado técnico ganha unidade, impacto, histórico e responsabilidade.']];
vals.forEach((v,i)=>{const x=72+(i%2)*570,y=245+Math.floor(i/2)*150;dot(s,x,y+7,[C.cyan,C.green,C.amber,C.red][i]);txt(s,v[0],x+28,y,200,30,22,C.ink,true);txt(s,v[1],x+28,y+40,480,54,17,C.muted);});
txt(s,'É uma camada de produto: menor dependência de leitura manual e maior capacidade de escalar a operação.',72,570,1100,42,23,C.ink,true);footer(s,9);addNotes(s,'Fonte: PRD oficial; arquitetura e estado atual do projeto.');}
// 10
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Proposta de encaminhamento','Validar o HealthLink Sentinel como plataforma operacional em dois módulos.','A decisão recomendada é evoluir sobre o Zabbix, com foco em contexto, links móveis e suporte.');
card(s,72,245,330,210,'1. Demonstrar','Fluxo completo: mapa → alerta → unidade → diagnóstico → histórico.',C.cyan);
card(s,475,245,330,210,'2. Priorizar','Fechar Fase 4 do centro operacional e consolidar gestão de usuários, auditoria e relatórios.',C.green);
card(s,878,245,330,210,'3. Pilotar','Selecionar unidades móveis e medir tempo de descoberta, diagnóstico e resolução.',C.amber);
txt(s,'Mensagem final',72,530,260,28,17,C.cyan,true);txt(s,'Zabbix coleta.\nHealthLink Sentinel orienta a operação.',72,565,800,68,30,C.ink,true);footer(s,10);addNotes(s,'Fonte: PRD oficial; Estado Atual; pendências prioritárias do projeto.');}
// 11
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Agente local','O agente é a ponte segura entre a unidade móvel e o centro de comando.','Ele coleta dentro da rede local, normaliza os dados e mantém a operação resiliente mesmo com oscilações de conectividade.');
line(s,270,360,470,360,C.cyan,4);line(s,760,360,950,360,C.green,4);
shape(s,'roundRect',{left:72,top:280,width:198,height:150},C.surface,C.line);txt(s,'REDE LOCAL',104,312,140,24,15,C.muted,true);txt(s,'Starlink\nMikroTik\nServidor',104,348,140,72,22,C.ink,true);
shape(s,'roundRect',{left:470,top:255,width:290,height:200},C.cyan,'none');txt(s,'AGENTE HEALTHLINK',508,295,220,26,18,C.bg,true);txt(s,'consulta • valida\nnormaliza • enfileira\nenvia • confirma',508,340,220,85,23,C.bg,true);
shape(s,'roundRect',{left:950,top:280,width:258,height:150},C.surface,C.line);txt(s,'CENTRO DE COMANDO',980,312,200,24,15,C.muted,true);txt(s,'telemetria\nestado • alerta\ndiagnóstico',980,348,190,72,22,C.ink,true);
card(s,72,500,350,135,'Resiliência','Fila local e retry para não perder amostras quando a conexão oscila.',C.green);card(s,465,500,350,135,'Segurança','Identidade própria do agente, HTTPS/VPN e permissão mínima.',C.cyan);card(s,858,500,350,135,'Operação','Saúde do coletor, última coleta e erro visíveis para o suporte.',C.amber);footer(s,11);addNotes(s,'Fonte: apps/agent/README.md; Plano de Coleta Starlink e Unidade Movel; ADR-001.');}
// 12
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Integração Starlink','A unidade passa a ter visibilidade de conectividade, localização e condição da antena.','A integração usa o agente local e a API gRPC da Starlink para trazer dados específicos que o monitoramento tradicional não explica sozinho.');
card(s,72,255,350,235,'Já validado','Latência, perda, tráfego, uptime, estado da antena, localização, cobertura/serviço e obstrução quando expostos pelo equipamento.',C.green);
card(s,465,255,350,235,'No suporte','Ver origem e idade da amostra, identificar agente sem comunicação, diferenciar antena, rota, MikroTik e Zabbix.',C.cyan);
card(s,858,255,350,235,'Próxima evolução','Ações remotas com autorização e auditoria: reiniciar equipamento, ajustar Wi‑Fi e aplicar configurações operacionais.',C.amber);
txt(s,'Comandos remotos devem ser habilitados por escopo, confirmação e trilha de auditoria; a disponibilidade depende dos métodos expostos pelo firmware.',72,535,1120,50,19,C.muted,true);footer(s,12);addNotes(s,'Fonte: Módulo Starlink - Estratégia Híbrida; Plano de Coleta Starlink e Unidade Movel; apps/agent/src/starlink-client.ts. Telemetria validada em 17/08/2026; comandos remotos apresentados como evolução planejada.');}
// 13
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Benefícios para a operação','O ganho não é apenas enxergar o link: é reduzir o tempo entre o sintoma e a ação.','A plataforma conecta monitoramento, diagnóstico e suporte em um fluxo único.');
const steps=[['01','Detectar','Queda, degradação, obstrução ou ausência de telemetria.'],['02','Localizar','Unidade, antena, rota e equipamento afetado no mapa.'],['03','Diagnosticar','Ping, tracert, origem da métrica e histórico do link.'],['04','Agir','Orientar o suporte e, na evolução remota, executar comandos autorizados.']];
steps.forEach((v,i)=>{const x=72+i*285;dot(s,x,292,[C.cyan,C.green,C.amber,C.red][i]);txt(s,v[0],x+28,280,60,30,18,[C.cyan,C.green,C.amber,C.red][i],true);txt(s,v[1],x,340,220,30,22,C.ink,true);txt(s,v[2],x,382,220,80,17,C.muted);if(i<3)line(s,x+230,300,x+270,300,C.line,2);});
txt(s,'Benefícios esperados',72,520,260,28,18,C.cyan,true);txt(s,'• Menos deslocamentos e tentativas manuais\n• Diagnóstico mais rápido e baseado em evidência\n• Histórico completo para suporte e gestão\n• Escala para múltiplas unidades móveis',72,560,720,100,20,C.ink,true);footer(s,13);addNotes(s,'Fonte: PRD oficial; Plano de Coleta Starlink e Unidade Movel; Operação de Monitoramento - Fase 3. Benefícios são implicações operacionais esperadas, não métricas já medidas.');}
// 14
{const s=p.slides.add();s.background.fill=C.bg;title(s,'Roadmap','A evolução natural é transformar monitoramento em operação cada vez mais autônoma.','O roadmap organiza a expansão por valor operacional, segurança e capacidade de escala.');
const phases=[['AGORA','Consolidar o centro operacional','Mapa e indicadores conectados aos estados reais; alertas, auditoria e relatórios.',C.cyan],['PRÓXIMA FASE','Comandos remotos seguros','Reinício, gestão de Wi‑Fi e configurações Starlink com autorização, confirmação e trilha.',C.amber],['ESCALA','Operação multiunidade','Provisionamento remoto do agente, atualização de versão, políticas por grupo e saúde da frota.',C.green],['VISÃO FUTURA','Inteligência operacional','Correlação de incidentes, previsão de degradação, recomendações de ação e indicadores executivos.',C.red]];
phases.forEach((v,i)=>{const x=72+i*285;dot(s,x,300,v[3]);txt(s,v[0],x+28,288,200,22,13,v[3],true);txt(s,v[1],x,345,230,55,21,C.ink,true);txt(s,v[2],x,420,230,100,16,C.muted);if(i<3)line(s,x+235,306,x+272,306,C.line,2);});
txt(s,'Critério de evolução',72,570,220,26,17,C.cyan,true);txt(s,'Cada nova capacidade deve reduzir tempo de diagnóstico, preservar segurança e deixar evidência auditável.',310,570,850,32,20,C.ink,true);footer(s,14);addNotes(s,'Fonte: PRD ROADMAP; Plano de Coleta Starlink e Unidade Movel; ADR-001. Roadmap apresentado como proposta de evolução do produto.');}

await fs.mkdir('C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/rendered',{recursive:true});
for (const [i,s] of p.slides.items.entries()) { const b=await p.export({slide:s,format:'png',scale:1}); await fs.writeFile(`C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/rendered/slide-${i+1}.png`,new Uint8Array(await b.arrayBuffer())); }
const montage=await p.export({format:'webp',montage:true,scale:1});await fs.writeFile('C:/Users/ADMIN/Documents/Codex/healthlink-sentinel/.tmp/deck-healthlink/montage.webp',new Uint8Array(await montage.arrayBuffer()));
const pptx=await PresentationFile.exportPptx(p);await pptx.save(OUT);
console.log(OUT);

