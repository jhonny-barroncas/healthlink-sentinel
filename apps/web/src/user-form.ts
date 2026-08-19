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
  if (!input.email.trim()) errors.push('email');
  if (!input.role.trim()) errors.push('role');
  if (!input.editing && !input.password) errors.push('password');
  return errors;
}
