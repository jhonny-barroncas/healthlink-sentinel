export type AgentPlatform = 'windows' | 'linux';

export type AgentVersionRecord = {
  id: string;
  version: string;
  platform: AgentPlatform;
  file_name: string;
  file_size: number;
  checksum_sha256: string;
  active: boolean;
  created_at: string;
};

export function agentPlatformLabel(platform: AgentPlatform): string {
  return platform === 'windows' ? 'Windows' : 'Linux';
}

export function canPublishAgentVersion(fileName: string, platform: AgentPlatform): boolean {
  const lower = fileName.toLowerCase();
  return platform === 'windows' ? lower.endsWith('.exe') || lower.endsWith('.msi') : !lower.endsWith('.exe') && !lower.endsWith('.msi');
}
