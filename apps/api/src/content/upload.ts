import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
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

export const uploadOptions = {
  storage: diskStorage({
    destination: uploadRoot,
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const extension = extname(file.originalname).toLowerCase();
      callback(null, randomUUID() + extension);
    },
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES ?? 49_000_000), files: 1 },
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
