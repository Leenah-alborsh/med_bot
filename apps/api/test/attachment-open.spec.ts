import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
vi.mock('../src/prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('@medical/database', () => ({ Prisma: {} }));
import { ContentService } from '../src/content/content.service.js';
import type { AuthenticatedAdmin } from '../src/auth/auth.types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { ScopeAuthorizationService } from '../src/auth/scope-authorization.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { TelegramFileStorageService } from '../src/content/telegram-file-storage.service.js';
import type { UploadTicketService } from '../src/content/upload-ticket.service.js';

const actor = {
  id: 'a',
  roleKeys: ['super-admin'],
  permissions: ['content.read'],
} as AuthenticatedAdmin;
function setup() {
  const file = {
    id: 'f',
    contentItemId: 'c',
    storageProvider: 'TELEGRAM',
    telegramFileId: 'private-file',
    originalFilename: 'lecture.pdf',
    mimeType: 'application/pdf',
    uploadedById: 'a',
  };
  const prisma = { contentAttachment: { findFirst: vi.fn().mockResolvedValue(file) } };
  const storage = { open: vi.fn().mockResolvedValue(new ReadableStream()) };
  const service = new ContentService(
    prisma as unknown as PrismaService,
    {} as ScopeAuthorizationService,
    {} as AuditService,
    storage as unknown as TelegramFileStorageService,
    {} as UploadTicketService,
  );
  // openAttachment only awaits this authorization check; it does not consume the
  // content payload. Keep the partial stub typed against the real method result.
  const scopedContent = { state: 'PUBLISHED' } as Awaited<ReturnType<ContentService['get']>>;
  const scopeCheck = vi.spyOn(service, 'get').mockResolvedValue(scopedContent);
  return { service, prisma, storage, scopeCheck };
}
describe('authenticated attachment access', () => {
  it('opens published attachments after checking content access and attachment membership', async () => {
    const { service, prisma, storage, scopeCheck } = setup();
    const result = await service.openAttachment('c', 'f', actor);
    expect(scopeCheck).toHaveBeenCalledWith('c', actor);
    expect(prisma.contentAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'f', contentItemId: 'c', archivedAt: null },
    });
    expect(storage.open).toHaveBeenCalledWith('private-file');
    expect(result).toMatchObject({ filename: 'lecture.pdf', mimeType: 'application/pdf' });
    expect(result).not.toHaveProperty('url');
  });
  it('does not fetch a file when the actor is outside the content scope', async () => {
    const { service, storage, scopeCheck } = setup();
    scopeCheck.mockRejectedValue(new Error('Forbidden scope'));
    await expect(service.openAttachment('c', 'f', actor)).rejects.toThrow('Forbidden scope');
    expect(storage.open).not.toHaveBeenCalled();
  });
  it('does not allow upload-only actors to read someone else’s files', async () => {
    const { service, storage } = setup();
    await expect(
      service.openAttachment('c', 'f', { ...actor, id: 'b', permissions: ['content.update'] }),
    ).rejects.toThrow('own uploads');
    expect(storage.open).not.toHaveBeenCalled();
  });
  it('allows upload-only actors to verify their own uploaded files', async () => {
    const { service, storage } = setup();
    await service.openAttachment('c', 'f', { ...actor, permissions: ['content.update'] });
    expect(storage.open).toHaveBeenCalledOnce();
  });
  it('falls back to the original channel message when Telegram cannot download the file', async () => {
    const { service, prisma, storage } = setup();
    prisma.contentAttachment.findFirst.mockResolvedValue({
      id: 'f',
      contentItemId: 'c',
      storageProvider: 'TELEGRAM',
      telegramFileId: 'private-file',
      originalFilename: 'lecture.pdf',
      mimeType: 'application/pdf',
      uploadedById: 'a',
      storageChatId: -1001234567890n,
      storageMessageId: 42,
    });
    storage.open.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.openAttachment('c', 'f', actor)).resolves.toEqual({
      url: 'https://t.me/c/1234567890/42',
      filename: 'lecture.pdf',
    });
  });
  it('rejects absent attachments without contacting Telegram', async () => {
    const { service, prisma, storage } = setup();
    prisma.contentAttachment.findFirst.mockResolvedValue(null);
    await expect(service.openAttachment('c', 'f', actor)).rejects.toThrow('Attachment not found');
    expect(storage.open).not.toHaveBeenCalled();
  });
});
