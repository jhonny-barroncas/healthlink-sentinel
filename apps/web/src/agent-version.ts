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
  void platform;
  return /^[a-z0-9][a-z0-9._-]*\.(?:cjs|js)$/i.test(fileName);
}
