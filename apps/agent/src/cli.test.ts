import { describe, expect, it } from 'vitest';
import { parseAgentCli } from './cli.js';

describe('agent command line', () => {
  it('parses the version command', () => {
    expect(parseAgentCli(['node', 'healthlink-agent.cjs', '--version'])).toEqual({ command: 'version' });
  });
  it('parses a non-interactive enrollment with all installer-provided paths', () => {
    expect(parseAgentCli(['node', 'healthlink-agent.cjs', 'enroll',
      '--api', 'https://healthlink.example', '--token', 'hle_secret', '--config', '/etc/agent.json',
      '--data-dir', '/var/lib/agent', '--agent-path', '/opt/agent/healthlink-agent.cjs',
    ])).toEqual({
      command: 'enroll',
      apiUrl: 'https://healthlink.example',
      enrollmentToken: 'hle_secret',
      configPath: '/etc/agent.json',
      dataDir: '/var/lib/agent',
      agentPath: '/opt/agent/healthlink-agent.cjs',
    });
  });

  it('parses service execution without treating --once as a command', () => {
    expect(parseAgentCli(['node', 'healthlink-agent.cjs', 'run', '--config', 'C:\\agent\\agent.json', '--once'])).toEqual({
      command: 'run', configPath: 'C:\\agent\\agent.json', once: true,
    });
    expect(parseAgentCli(['node', 'index.ts', '--once'])).toEqual({ command: 'run', configPath: undefined, once: true });
  });
});

