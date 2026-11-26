// Crea un usuario admin, o promueve a admin uno existente (y le resetea la
// contrasena). Uso:
//   npm run create-admin -w server -- --email admin@burger.com --name "Admin"
// La contrasena se pide por consola sin mostrarla (nunca por argumento, para
// que no quede en el historial de la terminal).
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { emailSchema, passwordSchema } from '@burger/shared';
import { hashPassword } from '../lib/password';
import { userRepository } from '../repositories/user.repository';

// Sin terminal interactiva (ej: pipe): se lee toda la entrada una sola vez
// y cada prompt consume la siguiente linea.
let pipedLines: Promise<string[]> | null = null;
function nextPipedLine(): Promise<string> {
  pipedLines ??= new Promise((resolve) => {
    const lines: string[] = [];
    createInterface({ input: process.stdin })
      .on('line', (line) => lines.push(line))
      .on('close', () => resolve(lines));
  });
  return pipedLines.then((lines) => lines.shift() ?? '');
}

function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) return nextPipedLine();

  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          stdout.write('\n');
          process.exit(130); // Ctrl+C
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });

  const email = emailSchema.safeParse(values.email ?? '');
  if (!email.success) {
    console.error('Uso: npm run create-admin -w server -- --email <email> --name "<nombre>"');
    process.exit(1);
  }
  const name = (values.name ?? 'Admin').trim().slice(0, 80) || 'Admin';

  const password = await promptHidden('Contrasena (min. 8 caracteres): ');
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    console.error(parsed.error.issues[0]?.message ?? 'Contrasena invalida');
    process.exit(1);
  }
  if ((await promptHidden('Repeti la contrasena: ')) !== password) {
    console.error('Las contrasenas no coinciden');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await userRepository.findByEmailWithHash(email.data);

  if (existing) {
    await userRepository.update(existing.id, { role: 'admin', password_hash: passwordHash });
    console.log(`Usuario existente promovido a admin: ${email.data}`);
  } else {
    await userRepository.create({
      email: email.data,
      passwordHash,
      name,
      phone: null,
      role: 'admin',
    });
    console.log(`Admin creado: ${email.data}`);
  }
}

main().catch((err: unknown) => {
  console.error('No se pudo crear el admin:', err instanceof Error ? err.message : err);
  process.exit(1);
});
