import { describe, expect, it } from 'vitest';
import {
  collectionAgentInstallerFileName,
  createAgentCredential,
  createEnrollmentToken,
  evaluateAgentRequirements,
  hashAgentSecret,
  isDeployableAgentArtifact,
  parseAgentCredential,
  parseEnrollmentToken,
  resolveAgentApiUrl,
  resolveConfiguredPublicUrl,
} from './provisioning.js';

const tenantId = '11111111-1111-4111-8111-111111111111';
const enrollmentId = '22222222-2222-4222-8222-222222222222';
const agentId = '33333333-3333-4333-8333-333333333333';

describe('agent provisioning rules', () => {
  it('requires an active server and at least one active collection source', () => {
    expect(evaluateAgentRequirements([
      { id: 'legacy-server', type: 'linux_server', active: true },
      { id: 'disabled-starlink', type: 'starlink', active: false },
    ])).toEqual({
      servers: [{ id: 'legacy-server', type: 'linux_server', active: true }],
      sources: [],
      missing: ['source'],
      eligible: false,
    });

    expect(evaluateAgentRequirements([
      { id: 'server', type: 'server', active: true },
      { id: 'starlink', type: 'starlink', active: true },
      { id: 'mikrotik', type: 'mikrotik', active: true },
      { id: 'link', type: 'internet_link', active: true },
    ])).toEqual({
      servers: [{ id: 'server', type: 'server', active: true }],
      sources: [
        { id: 'starlink', type: 'starlink', active: true },
        { id: 'mikrotik', type: 'mikrotik', active: true },
        { id: 'link', type: 'internet_link', active: true },
      ],
      missing: [],
      eligible: true,
    });
  });

  it('creates parseable one-time and permanent tokens without exposing the secret in the hash', () => {
    const enrollment = createEnrollmentToken(tenantId, enrollmentId);
    const parsedEnrollment = parseEnrollmentToken(enrollment.token);
    expect(parsedEnrollment).toEqual({ tenantId, enrollmentId, secret: enrollment.secret });
    expect(enrollment.token).toMatch(/^hle_/);

    const credential = createAgentCredential(tenantId, agentId);
    const parsedCredential = parseAgentCredential(credential.token);
    expect(parsedCredential).toEqual({ tenantId, agentId, secret: credential.secret });
    expect(credential.token).toMatch(/^hla_/);

    const digest = hashAgentSecret(enrollment.secret);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(enrollment.secret);
    expect(parseEnrollmentToken('hle_invalido')).toBeNull();
    expect(parseAgentCredential('Bearer qualquer')).toBeNull();
  });

  it('resolves the public API URL safely and gives each platform a deterministic installer name', () => {
    expect(resolveConfiguredPublicUrl('https://app.example', 'https://legacy.example')).toBe('https://app.example');
    expect(resolveConfiguredPublicUrl(undefined, 'https://legacy.example')).toBe('https://legacy.example');

    expect(resolveAgentApiUrl({
      configuredUrl: 'https://sentinel.example/api/',
      requestProtocol: 'http',
      forwardedProtocol: 'http',
      host: 'internal:3000',
    })).toBe('https://sentinel.example/api');
    expect(resolveAgentApiUrl({ requestProtocol: 'http', forwardedProtocol: 'https, http', host: 'sentinel.example:5174' }))
      .toBe('https://sentinel.example:5174');
    expect(() => resolveAgentApiUrl({ requestProtocol: 'ftp', host: 'sentinel.example' })).toThrow('URL pública');
    expect(() => resolveAgentApiUrl({ configuredUrl: 'http://sentinel.example', requestProtocol: 'http', requireHttps: true })).toThrow('URL pública');
    expect(collectionAgentInstallerFileName('UMS 01/AM', 'windows')).toBe('healthlink-agent-ums-01-am-windows.ps1');
    expect(collectionAgentInstallerFileName('UMS 01/AM', 'linux')).toBe('healthlink-agent-ums-01-am-linux.sh');
  });

  it('accepts only a bundled collector artifact for provisioning', () => {
    expect(isDeployableAgentArtifact('healthlink-agent-1.0.0-linux.cjs')).toBe(true);
    expect(isDeployableAgentArtifact('healthlink-agent-1.0.0.sh')).toBe(false);
    expect(isDeployableAgentArtifact('healthlink-agent-1.0.0.ps1')).toBe(false);
  });
});
