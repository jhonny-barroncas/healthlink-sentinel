const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

export function nextAgentVersion(versions: string[]): string {
  const latest = versions
    .map((version) => semverPattern.exec(version))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => match.slice(1).map(Number))
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]))
    .at(-1);
  if (!latest) return '1.0.0';
  return `${latest[0]}.${latest[1]}.${latest[2] + 1}`;
}

export function embedAgentVersion(artifact: Buffer, version: string): Buffer {
  if (!semverPattern.test(version)) throw new Error('Versão do agente inválida.');
  const source = artifact.toString('utf8');
  const replaced = source.replace(/HealthLink Sentinel Agent v\d+\.\d+\.\d+/, `HealthLink Sentinel Agent v${version}`);
  if (replaced === source) throw new Error('O bundle não contém o marcador de versão do agente. Gere um novo bundle.');
  return Buffer.from(replaced, 'utf8');
}

export function extractEmbeddedAgentVersion(artifact: Buffer): string | null {
  return artifact.toString('utf8').match(/HealthLink Sentinel Agent v(\d+\.\d+\.\d+)/)?.[1] ?? null;
}
