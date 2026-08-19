import { collectStarlink, type TelemetryBatch } from './collector.js';
import { loadConfig } from './config.js';
import { loadQueue, saveQueue } from './queue.js';
import { HealthLinkAuth } from './healthlink-auth.js';
import { checkForAgentUpdate } from './agent-updater.js';

async function sendBatch(batch: TelemetryBatch, config: ReturnType<typeof loadConfig>, auth: HealthLinkAuth): Promise<void> {
  const response = await auth.fetch(`${config.apiUrl}/v1/integrations/starlink/telemetry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`API HealthLink respondeu HTTP ${response.status}.`);
}

async function cycle(config: ReturnType<typeof loadConfig>, auth: HealthLinkAuth): Promise<void> {
  const queue = await loadQueue(config.queuePath);
  try {
    const batch = await collectStarlink(config);
    queue.push(batch);
    console.log(`[starlink-agent] coleta concluída: ${Object.keys(batch.payload).length} métricas em ${batch.observedAt}`);
  } catch (error) {
    console.error(`[starlink-agent] Starlink indisponível: ${(error as Error).message}`);
  }
  while (queue.length) {
    try {
      await sendBatch(queue[0], config, auth);
      queue.shift();
      console.log(`[starlink-agent] lote enviado; pendentes=${queue.length}`);
    } catch (error) {
      console.error(`[starlink-agent] envio pendente mantido em fila: ${(error as Error).message}`);
      break;
    }
  }
  await saveQueue(config.queuePath, queue);
}

const config = loadConfig();
const auth = new HealthLinkAuth(config);
const once = process.argv.includes('--once');
console.log(`[starlink-agent] iniciado; dish=${config.starlinkHost}:${config.starlinkPort}; intervalo=${config.pollIntervalMs}ms`);
try { await checkForAgentUpdate(config, auth); } catch (error) { console.warn(`[starlink-agent] atualização automática indisponível: ${(error as Error).message}`); }
await cycle(config, auth);
if (!once) {
  setInterval(() => void cycle(config, auth), config.pollIntervalMs);
  setInterval(() => void checkForAgentUpdate(config, auth).catch((error) => console.warn(`[starlink-agent] atualização automática indisponível: ${(error as Error).message}`)), 10 * 60_000);
}
