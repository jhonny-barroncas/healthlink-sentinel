import { collectStarlink, type TelemetryBatch } from './collector.js';
import { agentConfigFromInstalled, bundledAgentVersion, loadConfig, type AgentConfig } from './config.js';
import { loadQueue, saveQueue } from './queue.js';
import { HealthLinkAuth } from './healthlink-auth.js';
import { checkForAgentUpdate, finalizeAgentUpdate, restorePreviousAgent } from './agent-updater.js';
import { CollectionAgentClient } from './agent-client.js';
import { parseAgentCli } from './cli.js';
import { enrollAndSave, loadInstalledAgentConfig } from './installed-config.js';
import { bundledProtoAssets, materializeEmbeddedProtos } from './proto-assets.js';
import { starlinkTargets } from './runtime.js';

type AuthenticatedFetcher = { fetch(input: string, init?: RequestInit): Promise<Response> };
let activeAgentPath: string | undefined;

async function sendBatch(batch: TelemetryBatch, config: AgentConfig, auth: AuthenticatedFetcher): Promise<void> {
  const endpoint = config.agentId ? '/v1/collection-agents/telemetry' : '/v1/integrations/starlink/telemetry';
  const response = await auth.fetch(`${config.apiUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) throw new Error(`API HealthLink respondeu HTTP ${response.status}.`);
}

async function cycle(config: AgentConfig, auth: AuthenticatedFetcher): Promise<void> {
  const queue = await loadQueue(config.queuePath);
  try {
    const batch = await collectStarlink(config);
    queue.push(batch);
    console.log(`[healthlink-agent] coleta Starlink concluída: ${Object.keys(batch.payload).length} métricas em ${batch.observedAt}`);
  } catch (error) {
    console.error(`[healthlink-agent] Starlink indisponível: ${(error as Error).message}`);
  }
  while (queue.length) {
    try {
      await sendBatch(queue[0], config, auth);
      queue.shift();
      console.log(`[healthlink-agent] lote enviado; pendentes=${queue.length}`);
    } catch (error) {
      console.error(`[healthlink-agent] envio pendente mantido em fila: ${(error as Error).message}`);
      break;
    }
  }
  await saveQueue(config.queuePath, queue);
}

const cycleLocks = new Map<string, Promise<void>>();

function scheduleCycle(config: AgentConfig, auth: AuthenticatedFetcher): Promise<void> {
  const key = config.queuePath;
  const previous = cycleLocks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => cycle(config, auth)).finally(() => {
    if (cycleLocks.get(key) === next) cycleLocks.delete(key);
  });
  cycleLocks.set(key, next);
  return next;
}

async function prepareEmbeddedProtos(config: AgentConfig): Promise<void> {
  const assets = bundledProtoAssets();
  if (!assets || !config.dataDir) return;
  process.env.HEALTHLINK_AGENT_PROTO_DIR = await materializeEmbeddedProtos(config.dataDir, assets);
}

export async function runAgent(config: AgentConfig, once = false): Promise<void> {
  await prepareEmbeddedProtos(config);
  const installedClient = config.agentId && config.apiToken ? new CollectionAgentClient({
    apiUrl: config.apiUrl,
    credential: config.apiToken,
    platform: config.platform,
    version: config.agentVersion,
    timeoutMs: config.timeoutMs,
  }) : null;
  const auth: AuthenticatedFetcher = installedClient ?? new HealthLinkAuth(config);
  console.log(`[healthlink-agent] iniciado; plataforma=${config.platform}; versão=${config.agentVersion}; intervalo=${config.pollIntervalMs}ms`);
  try {
    if (await checkForAgentUpdate(config, auth)) {
      process.exitCode = 75;
      return;
    }
  } catch (error) {
    console.warn(`[healthlink-agent] atualização automática indisponível: ${(error as Error).message}`);
  }
  const heartbeat = async () => {
    if (!installedClient) return;
    try { await installedClient.heartbeat(); } catch (error) { console.warn(`[healthlink-agent] heartbeat pendente: ${(error as Error).message}`); }
  };
  await heartbeat();
  const targets = starlinkTargets(config);
  if (targets.length === 0) console.log('[healthlink-agent] sem Starlink atribuída; heartbeat permanece ativo aguardando configuração de fonte.');
  await Promise.all(targets.map((target) => scheduleCycle(target, auth)));
  await finalizeAgentUpdate(config.agentPath);
  if (once) return;
  setInterval(() => void heartbeat(), 15_000);
  setInterval(() => void Promise.all(targets.map((target) => scheduleCycle(target, auth))), config.pollIntervalMs);
  setInterval(() => void checkForAgentUpdate(config, auth).then((updated) => {
    if (updated) process.exit(75);
  }).catch((error) => console.warn(`[healthlink-agent] atualização automática indisponível: ${(error as Error).message}`)), 10 * 60_000);
}

export async function main(argv = process.argv): Promise<void> {
  const cli = parseAgentCli(argv);
  if (cli.command === 'enroll') {
    const installed = await enrollAndSave({
      apiUrl: cli.apiUrl,
      enrollmentToken: cli.enrollmentToken,
      configPath: cli.configPath,
      dataDir: cli.dataDir,
      agentPath: cli.agentPath,
    });
    console.log(`[healthlink-agent] enrollment concluído para o agente ${installed.agentId}.`);
    return;
  }
  const config = cli.configPath
    ? agentConfigFromInstalled(await loadInstalledAgentConfig(cli.configPath), bundledAgentVersion())
    : loadConfig();
  activeAgentPath = config.agentPath;
  await runAgent(config, cli.once);
}

void main().catch((error) => {
  console.error(`[healthlink-agent] falha fatal: ${(error as Error).message}`);
  if (activeAgentPath) void restorePreviousAgent(activeAgentPath);
  process.exitCode = 1;
});
