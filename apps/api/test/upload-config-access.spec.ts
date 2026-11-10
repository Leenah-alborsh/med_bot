import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PermissionGuard } from '../src/auth/permission.guard.js';
import { SessionAuthGuard } from '../src/auth/session-auth.guard.js';
import { CsrfGuard } from '../src/auth/csrf.guard.js';
import type { AuthenticatedAdmin, AuthenticatedRequest } from '../src/auth/auth.types.js';
vi.mock('../src/prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('@medical/database', () => ({ Prisma: {} }));
import { ContentController } from '../src/content/content.controller.js';
import { ContentService } from '../src/content/content.service.js';

let permissions: AuthenticatedAdmin['permissions'] = [];
let app: INestApplication;
let base: string;
beforeAll(async () => {
  Reflect.defineMetadata('design:paramtypes', [ContentService], ContentController);
  const module = await Test.createTestingModule({
    controllers: [ContentController],
    providers: [{ provide: ContentService, useValue: {} }],
  })
    .overrideGuard(SessionAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest<AuthenticatedRequest>().admin = {
          permissions,
          roleKeys: ['content-admin'],
        } as AuthenticatedAdmin;
        return true;
      },
    })
    .overrideGuard(PermissionGuard)
    .useValue(new PermissionGuard(new Reflector()))
    .overrideGuard(CsrfGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = module.createNestApplication();
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/content/upload-config/dashboard`;
});
afterAll(async () => {
  await app?.close();
});
describe('upload page configuration permission', () => {
  it.each(['content.update', 'content.read'] as const)(
    'allows an admin with %s to load upload settings',
    async (permission) => {
      permissions = [permission];
      const response = await fetch(base);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ maxUploadBytes: 50_000_000 });
    },
  );
  it('does not expose configuration to unrelated admin roles', async () => {
    permissions = [];
    expect((await fetch(base)).status).toBe(403);
  });
});
