import 'dotenv/config';
import { z } from 'zod';
import { database } from '../platform/database.js';
import { hashPassword } from '../modules/auth/password.js';

const inputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const input = inputSchema.parse(JSON.parse(raw));
  const passwordHash = await hashPassword(input.password);
  const result = await database.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2 AND active = true RETURNING id',
    [passwordHash, input.email],
  );
  if (!result.rows[0]) throw new Error('Usuário ativo não encontrado.');
  process.stdout.write('Senha redefinida com sucesso.\n');
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Falha ao redefinir a senha.'}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}
