import { describe, expect, it } from 'vitest';
import { validateManagedUserForm } from './user-form.js';

describe('validateManagedUserForm', () => {
  it('accepts a new user without unrelated CPF or coligada fields', () => {
    expect(validateManagedUserForm({ displayName: 'Maria Silva', email: 'maria@healthlink.test', role: 'viewer', password: 'senha-segura', editing: false })).toEqual([]);
  });

  it('requires a password only when creating a user', () => {
    expect(validateManagedUserForm({ displayName: 'Maria Silva', email: 'maria@healthlink.test', role: 'viewer', password: '', editing: false })).toContain('password');
    expect(validateManagedUserForm({ displayName: 'Maria Silva', email: 'maria@healthlink.test', role: 'viewer', password: '', editing: true })).not.toContain('password');
  });
});
