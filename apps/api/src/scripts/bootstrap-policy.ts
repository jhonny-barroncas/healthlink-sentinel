export type BootstrapPasswordValidation =
  | { valid: true }
  | { valid: false; reason: 'ausente' | 'curta' };

export function validateBootstrapPassword(password: string | undefined): BootstrapPasswordValidation {
  if (!password) return { valid: false, reason: 'ausente' };
  if (password.length < 8) return { valid: false, reason: 'curta' };
  return { valid: true };
}

export function shouldResetPassword(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
