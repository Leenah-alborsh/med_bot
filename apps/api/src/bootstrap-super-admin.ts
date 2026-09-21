import 'reflect-metadata';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { BootstrapService } from './bootstrap/bootstrap.service.js';

function hiddenQuestion(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode)
    throw new Error('Bootstrap must run in an interactive terminal');
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (key: string) => {
      if (key === '\u0003') {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }
      if (key === '\r' || key === '\n') {
        stdout.write('\n');
        cleanup();
        resolve(value);
        return;
      }
      if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += key;
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const reader = createInterface({ input: stdin, output: stdout });
  try {
    const email = await reader.question('Super Admin email: ');
    const displayNameAr = await reader.question('Arabic display name: ');
    const displayNameEn = await reader.question('English display name: ');
    reader.close();
    const password = await hiddenQuestion('Password (hidden): ');
    const confirmation = await hiddenQuestion('Confirm password (hidden): ');
    if (password !== confirmation) throw new Error('Passwords do not match');
    const result = await app
      .get(BootstrapService)
      .createFirstSuperAdmin({ email, password, displayNameAr, displayNameEn });
    stdout.write(
      result.created ? 'Super Admin created.\n' : 'Super Admin already exists for this email.\n',
    );
  } finally {
    reader.close();
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Bootstrap failed'}\n`);
  process.exitCode = 1;
});
