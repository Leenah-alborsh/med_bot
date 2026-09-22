import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { attachmentInputSchema, contentInputSchema } from '../src/content/content.schemas.js';
import { validateExternalUrl } from '../src/content/content.service.js';
import { isPathInsideUploadRoot, uploadRoot } from '../src/content/upload.js';
import { join } from 'node:path';

describe('content and attachment validation', () => {
  it('rejects unsafe URL schemes and private network targets', () => {
    expect(() => validateExternalUrl('http://example.com/file.pdf')).toThrow(BadRequestException);
    expect(() => validateExternalUrl('https://127.0.0.1/private')).toThrow(BadRequestException);
    expect(validateExternalUrl('https://example.com/file.pdf')).toBe(
      'https://example.com/file.pdf',
    );
  });
  it('validates Telegram file IDs without treating them as URLs', () => {
    expect(
      attachmentInputSchema.safeParse({
        storageProvider: 'TELEGRAM',
        originalFilename: 'lecture.pdf',
        telegramFileId: 'AgACAgQAAxkBAAIB_valid_123',
        mimeType: 'application/pdf',
        fileSize: 12,
      }).success,
    ).toBe(true);
    expect(
      attachmentInputSchema.safeParse({
        storageProvider: 'TELEGRAM',
        originalFilename: 'lecture.pdf',
        telegramFileId: '../bad',
        mimeType: 'application/pdf',
        fileSize: 12,
      }).success,
    ).toBe(false);
  });
  it('requires text bodies and prevents upload path traversal', () => {
    expect(
      contentInputSchema.safeParse({
        sectionId: '11111111-1111-4111-8111-111111111111',
        titleAr: 'Title',
        contentType: 'TEXT',
        displayOrder: 1,
      }).success,
    ).toBe(false);
    expect(isPathInsideUploadRoot(join(uploadRoot, 'safe.pdf'))).toBe(true);
    expect(isPathInsideUploadRoot(join(uploadRoot, '..', 'outside.pdf'))).toBe(false);
  });
});
