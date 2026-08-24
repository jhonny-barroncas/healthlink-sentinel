type ValidationIssue = { code?: string; path?: unknown[]; validation?: string };

function validationMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const issues = Array.isArray(parsed) ? parsed as ValidationIssue[] : [parsed as ValidationIssue];
    const issue = issues[0];
    const path = issue?.path?.[0];
    if (path === 'email' && issue?.validation === 'email' || path === 'email' && issue?.code === 'invalid_string') {
      return 'Informe um e-mail corporativo válido.';
    }
    if (path === 'password' && issue?.code === 'too_small') return 'A senha precisa ter pelo menos 8 caracteres.';
    if (path === 'password' && issue?.code === 'too_big') return 'A senha pode ter no máximo 200 caracteres.';
    if (issue?.code === 'invalid_type') return 'Confira os campos informados e tente novamente.';
  } catch { /* mensagem simples, não um payload de validação */ }
  return null;
}

export function friendlyApiMessage(raw: unknown, fallback: string): string {
  const message = typeof raw === 'string' ? raw : '';
  if (!message) return fallback;
  if (message === 'Failed to fetch' || message.includes('NetworkError')) {
    return 'Não foi possível conectar ao HealthLink. Verifique a disponibilidade da aplicação e tente novamente.';
  }
  const validation = validationMessage(message);
  if (validation) return validation;
  if (/credenciais inválidas/i.test(message)) return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  if (/sessão expirada|sessão revogada/i.test(message)) return 'Sua sessão expirou. Entre novamente para continuar.';
  if (/sem acesso a um cliente/i.test(message)) return 'Seu usuário ainda não possui acesso a um cliente.';
  if (/já existe/i.test(message)) return message;
  if (/permissão insuficiente/i.test(message)) return 'Você não tem permissão para realizar esta ação.';
  if (/não encontrado/i.test(message)) return 'O registro solicitado não foi encontrado.';
  if (/^Falha na plataforma \(HTTP \d+\)\.$/.test(message)) return 'Não foi possível concluir a operação. Tente novamente.';
  return fallback;
}
