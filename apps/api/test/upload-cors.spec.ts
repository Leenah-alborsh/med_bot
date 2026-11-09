import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { adminCorsOrigins } from '../src/config/cors.js';
vi.mock('../src/prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('@medical/database', () => ({ Prisma: {} }));
import { ContentUploadController } from '../src/content/content-upload.controller.js';
import { ContentService } from '../src/content/content.service.js';
import { UploadTicketGuard } from '../src/content/upload-ticket.guard.js';
import { UploadTicketService } from '../src/content/upload-ticket.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';

const origins = ['https://ardugaza.education', 'https://www.ardugaza.education'];
const id = '11111111-1111-4111-8111-111111111111';
let app: INestApplication;
let base: string;
let tickets: UploadTicketService;
beforeAll(async () => {
  // Vite does not emit Nest's constructor type metadata.
  Reflect.defineMetadata('design:paramtypes', [ContentService], ContentUploadController);
  const config = {
    get: (key: string) =>
      key === 'ADMIN_UPLOAD_TOKEN_SECRET' ? 'test-secret-'.repeat(4) : undefined,
  };
  tickets = new UploadTicketService(
    config as unknown as ConstructorParameters<typeof UploadTicketService>[0],
  );
  const module = await Test.createTestingModule({
    controllers: [ContentUploadController],
    providers: [
      { provide: UploadTicketGuard, useValue: new UploadTicketGuard(tickets) },
      {
        provide: ContentService,
        useValue: {
          attachUpload: async (_id: string, file: Express.Multer.File) => {
            await unlink(file.path);
            return { filename: file.originalname, size: file.size };
          },
        },
      },
    ],
  })
    .overrideGuard(UploadTicketGuard)
    .useValue(new UploadTicketGuard(tickets))
    .compile();
  app = module.createNestApplication();
  app.enableCors({
    origin: adminCorsOrigins('https://med-bot-admin.vercel.app'),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Upload-Ticket'],
  });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}/content-upload/${id}`;
});
afterAll(async () => {
  await app?.close();
});

describe('direct uploads from Ardu', () => {
  it.each(origins)(
    'allows preflight and authenticated multipart upload from %s',
    async (origin) => {
      const preflight = await fetch(base, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'x-upload-ticket',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
      const { ticket } = tickets.issue(id, {
        id: 'admin',
        roleKeys: ['super-admin'],
      } as AuthenticatedAdmin);
      const data = new FormData();
      data.append('file', new Blob(['%PDF-test'], { type: 'application/pdf' }), 'lecture.pdf');
      const response = await fetch(base, {
        method: 'POST',
        headers: { Origin: origin, 'X-Upload-Ticket': ticket },
        body: data,
      });
      expect(response.status).toBe(201);
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(await response.json()).toEqual({ filename: 'lecture.pdf', size: 9 });
    },
  );
  it('does not allow an arbitrary website to read responses', async () => {
    const response = await fetch(base, {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
  it('still rejects uploads without a valid signed ticket', async () => {
    const response = await fetch(base, {
      method: 'POST',
      headers: { Origin: origins[0]!, 'X-Upload-Ticket': 'invalid' },
    });
    expect(response.status).toBe(401);
  });
  it('preserves explicitly configured origins without wildcards', () => {
    expect(adminCorsOrigins('https://med-bot-admin.vercel.app/, https://other.example')).toEqual([
      'https://med-bot-admin.vercel.app',
      'https://other.example',
      ...origins,
    ]);
    expect(() => adminCorsOrigins('https://example.com/path')).toThrow();
    expect(() => adminCorsOrigins('*')).toThrow();
  });
});
