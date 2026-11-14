import 'dotenv/config';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/passwords.js';

const prisma = new PrismaClient();

const ask = (question) => new Promise((resolve) => {
  const prompt = createInterface({ input: stdin, output: stdout });
  prompt.question(question, (answer) => {
    prompt.close();
    resolve(answer.trim());
  });
});

const askHidden = (question) => new Promise((resolve, reject) => {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    reject(new Error('La creación de cuentas requiere una terminal interactiva.'));
    return;
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  let value = '';

  const finish = (error) => {
    stdin.removeListener('data', onData);
    stdin.setRawMode(false);
    stdin.pause();
    stdout.write('\n');
    if (error) reject(error);
    else resolve(value);
  };

  const onData = (chunk) => {
    for (const character of chunk.toString()) {
      if (character === '\u0003') {
        finish(new Error('Operación cancelada.'));
        return;
      }
      if (character === '\r' || character === '\n') {
        finish();
        return;
      }
      if (character === '\u007f' || character === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        continue;
      }
      if (character >= ' ' && value.length < 128) {
        value += character;
        stdout.write('*');
      }
    }
  };

  stdin.on('data', onData);
});

try {
  const name = await ask('Nombre: ');
  const email = (await ask('Correo: ')).toLowerCase();
  const roleName = (await ask('Rol (ADMIN/EDITOR): ')).toUpperCase();
  if (!['ADMIN', 'EDITOR'].includes(roleName)) {
    throw new Error('El rol debe ser ADMIN o EDITOR.');
  }
  const password = await askHidden('Contraseña (mínimo 12 caracteres): ');
  const confirmation = await askHidden('Confirma la contraseña: ');

  if (name.length < 2 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El nombre o el correo no son válidos.');
  }
  if (password.length < 12 || password !== confirmation) {
    throw new Error('Las contraseñas no coinciden o no cumplen la longitud mínima.');
  }

  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
      description: roleName === 'ADMIN'
        ? 'Acceso total a las funciones administrativas.'
        : 'Gestiona productos y categorías.',
    },
  });

  await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      roleId: role.id,
    },
  });
  stdout.write(`Cuenta ${roleName} creada correctamente para ${email}.\n`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
