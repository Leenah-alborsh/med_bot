import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES } from '../config/environment.js';
import { diskStorage } from 'multer';

const allowed = new Map([
  ['application/pdf', ['.pdf']],
  ['application/msword', ['.doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']],
  ['application/vnd.ms-powerpoint', ['.ppt']],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', ['.pptx']],
  ['application/vnd.ms-excel', ['.xls']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']],
  ['application/zip', ['.zip']],
  ['application/x-zip-compressed', ['.zip']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
  ['audio/mpeg', ['.mp3']],
  ['audio/ogg', ['.ogg', '.oga']],
  ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']],
]);

export const uploadRoot = resolve(process.env.UPLOAD_DIRECTORY ?? './var/uploads');
mkdirSync(uploadRoot, { recursive: true });

export function decodeUploadFilename(originalName: string) {
  if (/%[0-9a-f]{2}/i.test(originalName)) {
    try {
      return decodeURIComponent(originalName);
    } catch {
      // Continue with the multipart latin1 recovery below.
    }
  }
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  if (decoded.includes('\uFFFD')) return originalName;
  return Buffer.from(decoded, 'utf8').toString('latin1') === originalName ? decoded : originalName;
}

export function safeUploadFilename(originalName: string) {
  const decodedName = decodeUploadFilename(originalName);
  const filename = basename(decodedName.replace(/\\/g, '/')).replace(/[<>:"|?*]/g, '_');
  const sanitized = [...filename]
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
    .trim();
  return sanitized || 'file';
}

export function normalizeUploadedFileName(file: Pick<Express.Multer.File, 'originalname'>) {
  const filename = safeUploadFilename(file.originalname);
  file.originalname = filename;
  return filename;
}

export function uploadOriginalFilename(
  request: unknown,
  file: Pick<Express.Multer.File, 'originalname'>,
) {
  const suppliedName = (request as { body?: { originalFilename?: unknown } }).body
    ?.originalFilename;
  if (typeof suppliedName === 'string' && suppliedName.trim()) file.originalname = suppliedName;
  return normalizeUploadedFileName(file);
}

export const uploadOptions = {
  storage: diskStorage({
    destination: uploadRoot,
    filename: (
      request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const originalFilename = uploadOriginalFilename(request, file);
      callback(null, randomUUID() + extname(originalFilename).toLowerCase());
    },
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? MAX_UPLOAD_BYTES), files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const extension = extname(file.originalname).toLowerCase();
    const extensions = allowed.get(file.mimetype);
    if (!extensions?.includes(extension))
      return callback(new BadRequestException('Unsupported file type'), false);
    callback(null, true);
  },
};

export function isPathInsideUploadRoot(path: string) {
  const resolved = resolve(path);
  return resolved.startsWith(uploadRoot + '\\') || resolved.startsWith(uploadRoot + '/');
}
