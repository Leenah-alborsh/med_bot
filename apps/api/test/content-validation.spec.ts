import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { attachmentInputSchema, contentInputSchema } from '../src/content/content.schemas.js';
import { validateExternalUrl } from '../src/content/content.service.js';
import { MAX_UPLOAD_BYTES } from '../src/config/environment.js';
import {
  isPathInsideUploadRoot,
  normalizeUploadedFileName,
  safeUploadFilename,
  uploadOriginalFilename,
  uploadOptions,
  uploadRoot,
} from '../src/content/upload.js';
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
  it('allows dashboard uploads up to 2000 MB', () => {
    expect(uploadOptions.limits.fileSize).toBe(MAX_UPLOAD_BYTES);
  });

  it('keeps original upload names while removing unsafe path data', () => {
    expect(
      safeUploadFilename('\u0645\u062d\u0627\u0636\u0631\u0629 \u0627\u0644\u0642\u0644\u0628.pdf'),
    ).toBe('\u0645\u062d\u0627\u0636\u0631\u0629 \u0627\u0644\u0642\u0644\u0628.pdf');
    expect(safeUploadFilename('../private/lecture.pdf')).toBe('lecture.pdf');
    expect(safeUploadFilename('..\\private\\lecture.pdf')).toBe('lecture.pdf');

    const arabicName = '\u062a\u0634\u0631\u064a\u062d \u0627\u0644\u0628\u0637\u0646.pdf';
    const mojibakeName = Buffer.from(arabicName, 'utf8').toString('latin1');
    const file = { originalname: mojibakeName };

    expect(normalizeUploadedFileName(file)).toBe(arabicName);
    expect(file.originalname).toBe(arabicName);

    const browserFile = { originalname: 'misread.pdf' };
    expect(
      uploadOriginalFilename({ body: { originalFilename: 'ملخص التشريح.pdf' } }, browserFile),
    ).toBe('ملخص التشريح.pdf');
    expect(browserFile.originalname).toBe('ملخص التشريح.pdf');
    expect(safeUploadFilename('%D9%85%D9%84%D9%81.pdf')).toBe('ملف.pdf');
  });
});
