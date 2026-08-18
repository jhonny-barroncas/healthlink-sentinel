import net from 'node:net';
import os from 'node:os';

export type StarlinkInterface = { name: string; address: string };

function ipv4Interfaces(): StarlinkInterface[] {
  return Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
    (entries ?? [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({ name, address: entry.address })),
  );
}

function probe(host: string, port: number, localAddress: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, localAddress });
    const finish = (connected: boolean) => {
      socket.destroy();
      resolve(connected);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

export async function detectStarlinkInterface(host: string, port: number, timeoutMs: number): Promise<StarlinkInterface | undefined> {
  for (const candidate of ipv4Interfaces()) {
    if (await probe(host, port, candidate.address, timeoutMs)) return candidate;
  }
  return undefined;
}

export function listLocalInterfaces(): StarlinkInterface[] {
  return ipv4Interfaces();
}
