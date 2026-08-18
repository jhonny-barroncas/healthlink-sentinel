import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentConfig } from './config.js';

export type StarlinkStatus = {
  popPingLatencyMs?: number;
  popPingDropRate?: number;
  downlinkThroughputBps?: number;
  uplinkThroughputBps?: number;
  snr?: number;
  obstructionStats?: { fractionObstructed?: number };
  alerts?: Record<string, unknown>;
  state?: number | string;
};

export type StarlinkTransceiverStatus = { modemAsicTemp?: number };
export type StarlinkLocation = { lla?: { lat?: number; lon?: number } };

type DeviceClient = grpc.Client & {
  Handle(request: Record<string, unknown>, callback: (error: Error | null, response?: Record<string, any>) => void): void;
};

type DevicePackage = { Device: new (address: string, credentials: grpc.ChannelCredentials) => DeviceClient };

function devicePackage(): DevicePackage {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const protoRoot = path.resolve(currentDir, '../proto');
  const protoPath = path.join(protoRoot, 'spacex/api/device/device.proto');
  const definition = protoLoader.loadSync(protoPath, {
    includeDirs: [protoRoot],
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(definition) as unknown as {
    SpaceX: { API: { Device: DevicePackage } };
  };
  return loaded.SpaceX.API.Device;
}

/** Read-only adapter over the local gRPC contract documented by Eitol/starlink-client. */
export class EitolStarlinkClient {
  private readonly client: DeviceClient;

  constructor(config: Pick<AgentConfig, 'starlinkHost' | 'starlinkPort' | 'timeoutMs'>) {
    const Device = devicePackage().Device;
    this.client = new Device(`${config.starlinkHost}:${config.starlinkPort}`, grpc.credentials.createInsecure());
    this.timeoutMs = config.timeoutMs;
  }

  private readonly timeoutMs: number;

  private handle(request: Record<string, unknown>): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + this.timeoutMs);
      this.client.waitForReady(deadline, (error) => {
        if (error) {
          reject(error);
          return;
        }
        this.client.Handle(request, (handleError, response) => (handleError ? reject(handleError) : resolve(response ?? {})));
      });
    });
  }

  async getStatus(): Promise<StarlinkStatus> {
    const response = await this.handle({ get_status: {} });
    const raw = response.dish_get_status ?? response.dishGetStatus ?? {};
    return {
      popPingLatencyMs: raw.pop_ping_latency_ms ?? raw.popPingLatencyMs,
      popPingDropRate: raw.pop_ping_drop_rate ?? raw.popPingDropRate,
      downlinkThroughputBps: raw.downlink_throughput_bps ?? raw.downlinkThroughputBps,
      uplinkThroughputBps: raw.uplink_throughput_bps ?? raw.uplinkThroughputBps,
      snr: raw.snr,
      obstructionStats: (() => {
        const obstruction = raw.obstruction_stats ?? raw.obstructionStats;
        return obstruction
          ? { fractionObstructed: obstruction.fraction_obstructed ?? obstruction.fractionObstructed }
          : undefined;
      })(),
      alerts: raw.alerts,
      state: raw.state,
    };
  }

  async getTransceiverStatus(): Promise<StarlinkTransceiverStatus> {
    const response = await this.handle({ transceiver_get_status: {} });
    const raw = response.transceiver_get_status ?? response.transceiverGetStatus ?? {};
    return { modemAsicTemp: raw.modem_asic_temp ?? raw.modemAsicTemp };
  }

  async getLocation(): Promise<StarlinkLocation> {
    const response = await this.handle({ get_location: { source: 'AUTO' } });
    const raw = response.get_location ?? response.getLocation ?? response.dish_get_location ?? response.dishGetLocation ?? {};
    const lla = raw.lla ?? raw.LLA ?? raw.location?.lla ?? raw.location?.LLA ?? raw.position?.lla;
    const lat = lla?.lat ?? lla?.latitude;
    const lon = lla?.lon ?? lla?.lng ?? lla?.longitude;
    return { lla: { lat, lon } };
  }

  close(): void {
    this.client.close();
  }
}
