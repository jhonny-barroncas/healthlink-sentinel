export type ManagedUserFormInput = {
  displayName: string;
  email: string;
  role: string;
  password: string;
  editing: boolean;
};

export function validateManagedUserForm(input: ManagedUserFormInput): string[] {
  const errors: string[] = [];
  if (!input.displayName.trim()) errors.push('displayName');
  const email = input.email.trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email');
  if (!input.role.trim()) errors.push('role');
  if (!input.editing && (!input.password || input.password.length < 8 || input.password.length > 200)) errors.push('password');
  if (input.editing && input.password && (input.password.length < 8 || input.password.length > 200)) errors.push('password');
  return errors;
}
