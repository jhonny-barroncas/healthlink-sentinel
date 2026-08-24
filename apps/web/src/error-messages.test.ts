import { describe, expect, it } from 'vitest';
import { friendlyApiMessage } from './error-messages.js';

describe('friendlyApiMessage', () => {
  it('converts a raw email validation payload into a clear message', () => {
    expect(friendlyApiMessage('[{"validation":"email","code":"invalid_string","message":"Invalid email","path":["email"]}]', 'Falha ao entrar.'))
      .toBe('Informe um e-mail corporativo válido.');
  });

  it('explains password length validation without exposing the API payload', () => {
    expect(friendlyApiMessage('[{"code":"too_big","path":["password"],"message":"String must contain at most 200 character(s)"}]', 'Falha ao entrar.'))
      .toBe('A senha pode ter no máximo 200 caracteres.');
  });

  it('maps connection failures to an operational message', () => {
    expect(friendlyApiMessage('Failed to fetch', 'Falha ao entrar.'))
      .toBe('Não foi possível conectar ao HealthLink. Verifique a disponibilidade da aplicação e tente novamente.');
  });

  it('never returns raw structured errors to the screen', () => {
    const raw = '[{"code":"custom","path":["email"],"message":"database password leaked"}]';
    expect(friendlyApiMessage(raw, 'Confira os dados informados e tente novamente.'))
      .toBe('Confira os dados informados e tente novamente.');
  });
});
