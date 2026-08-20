export type AgentCli =
  | { command: 'run'; configPath?: string; once: boolean }
  | { command: 'enroll'; apiUrl: string; enrollmentToken: string; configPath: string; dataDir: string; agentPath: string };

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requiredOption(args: string[], name: string): string {
  const value = option(args, name)?.trim();
  if (!value) throw new Error(`O instalador não informou ${name}. Gere um novo arquivo no HealthLink.`);
  return value;
}

export function parseAgentCli(argv = process.argv): AgentCli {
  const args = argv.slice(2);
  if (args[0] === 'enroll') {
    return {
      command: 'enroll',
      apiUrl: requiredOption(args, '--api'),
      enrollmentToken: requiredOption(args, '--token'),
      configPath: requiredOption(args, '--config'),
      dataDir: requiredOption(args, '--data-dir'),
      agentPath: requiredOption(args, '--agent-path'),
    };
  }
  const runArgs = args[0] === 'run' ? args.slice(1) : args;
  return { command: 'run', configPath: option(runArgs, '--config'), once: runArgs.includes('--once') };
}

