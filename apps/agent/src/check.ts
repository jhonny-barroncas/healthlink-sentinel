import 'dotenv/config';
import { EitolStarlinkClient } from './starlink-client.js';
import { detectStarlinkInterface, listLocalInterfaces } from './network.js';

const host = process.env.STARLINK_HOST?.trim() || '192.168.100.1';
const port = Number(process.env.STARLINK_PORT ?? 9200);
const timeoutMs = Number(process.env.STARLINK_TIMEOUT_MS ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('STARLINK_PORT inválido.');
if (!Number.isFinite(timeoutMs) || timeoutMs < 500) throw new Error('STARLINK_TIMEOUT_MS deve ser >= 500.');

const client = new EitolStarlinkClient({ starlinkHost: host, starlinkPort: port, timeoutMs });
try {
  const selectedInterface = await detectStarlinkInterface(host, port, timeoutMs);
  if (!selectedInterface) {
    console.error(`[starlink-check] nenhuma interface alcança ${host}:${port}`);
    console.error(`[starlink-check] interfaces locais: ${listLocalInterfaces().map((item) => `${item.name} (${item.address})`).join(', ') || 'N/D'}`);
    process.exitCode = 1;
    process.exit();
  }
  console.log(`[starlink-check] interface detectada: ${selectedInterface.name} (${selectedInterface.address})`);
  const status = await client.getStatus();
  console.log(`[starlink-check] conexão OK: ${host}:${port}`);
  const latency = typeof status.popPingLatencyMs === 'number' && status.popPingLatencyMs >= 0 ? `${status.popPingLatencyMs}ms` : 'N/D';
  console.log(`[starlink-check] estado=${status.state ?? 'N/D'} latência=${latency}`);
} catch (error) {
  console.error(`[starlink-check] falha: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  client.close();
}
