import { describe, expect, it } from 'vitest';
import { shouldResetPassword, validateBootstrapPassword } from './bootstrap-policy.js';

describe('políticas de bootstrap do sysadmin', () => {
  it('aceita a senha configurada explicitamente pelo administrador', () => {
    expect(validateBootstrapPassword('b\\@123456')).toEqual({ valid: true });
  });

  it('rejeita configuração ausente ou curta', () => {
    expect(validateBootstrapPassword('')).toEqual({ valid: false, reason: 'ausente' });
    expect(validateBootstrapPassword('curta')).toEqual({ valid: false, reason: 'curta' });
  });

  it('só permite trocar a senha existente quando o reset explícito está ativo', () => {
    expect(shouldResetPassword(undefined)).toBe(false);
    expect(shouldResetPassword('false')).toBe(false);
    expect(shouldResetPassword('true')).toBe(true);
  });
});
