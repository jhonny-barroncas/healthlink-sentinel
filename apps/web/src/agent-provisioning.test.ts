import { describe, expect, it } from 'vitest';
import { agentInstallerFileName, extractAgentInstallerFileName, getAgentProvisioningRequirements } from './agent-provisioning.js';

describe('agent provisioning presentation', () => {
  it('reports the exact missing requirement instead of enabling an invalid generation', () => {
    expect(getAgentProvisioningRequirements([
      { equipment_id: 'server', equipment_type: 'linux_server', active: true },
    ])).toEqual({
      servers: [{ equipment_id: 'server', equipment_type: 'linux_server', active: true }],
      sources: [],
      missingMessages: ['Cadastre uma Starlink, um MikroTik ou um link de internet ativo nesta unidade.'],
    });

    expect(getAgentProvisioningRequirements([
      { equipment_id: 'source', equipment_type: 'starlink', active: true },
    ])).toEqual({
      servers: [],
      sources: [{ equipment_id: 'source', equipment_type: 'starlink', active: true }],
      missingMessages: ['Cadastre um equipamento do tipo Servidor nesta unidade.'],
    });
  });

  it('builds a safe platform-specific download name', () => {
    expect(agentInstallerFileName('UM 01/Manaus', 'windows')).toBe('healthlink-agent-um-01-manaus-windows.ps1');
    expect(agentInstallerFileName('UM 01/Manaus', 'linux')).toBe('healthlink-agent-um-01-manaus-linux.sh');
  });

  it('reads a safe filename from the download header', () => {
    expect(extractAgentInstallerFileName('attachment; filename="healthlink-agent-ums-windows.ps1"', 'fallback.ps1'))
      .toBe('healthlink-agent-ums-windows.ps1');
    expect(extractAgentInstallerFileName('attachment; filename="..\\evil.ps1"', 'fallback.ps1')).toBe('fallback.ps1');
    expect(extractAgentInstallerFileName(null, 'fallback.sh')).toBe('fallback.sh');
  });
});
