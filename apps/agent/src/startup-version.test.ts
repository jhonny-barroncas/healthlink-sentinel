import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

describe('inicialização após atualização', () => {
  it('usa a versão persistida no agent.json ao carregar a configuração instalada', () => {
    expect(source).toMatch(/agentConfigFromInstalled\(await loadInstalledAgentConfig\(cli\.configPath\)\)/);
  });
});
