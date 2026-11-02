import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  attachmentInputSchema,
  contentInputSchema,
  contentUpdateSchema,
  listContentSchema,
  stateInputSchema,
  type AttachmentInput,
  type ContentInput,
  type ListContentInput,
} from './content.schemas.js';
import { ContentService } from './content.service.js';
import { uploadOptions } from './upload.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('content')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}
  @Get()
  @RequirePermissions('content.read')
  list(
    @Query(new ZodValidationPipe(listContentSchema)) query: ListContentInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.content.list(query, actor);
  }
  @Get('storage/status')
  @RequirePermissions('content.read')
  verifyStorage() {
    return this.content.verifyStorage();
  }
  @Get('upload-targets')
  @RequirePermissions('content.update')
  uploadTargets(@CurrentAdmin() actor: AuthenticatedAdmin) {
    return this.content.uploadTargets(actor);
  }
  @Get(['upload-config', 'upload-config/dashboard'])
  @RequirePermissions('content.read')
  uploadConfig() {
    return { maxUploadBytes: uploadOptions.limits.fileSize, inboxClassificationAvailable: true };
  }
  @Get(':id')
  @RequirePermissions('content.read')
  get(@Param('id') id: string, @CurrentAdmin() actor: AuthenticatedAdmin) {
    return this.content.get(id, actor);
  }
  @Get(':id/attachments/:attachmentId/open')
  async openAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.content.openAttachment(id, attachmentId, actor);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if ('url' in file && file.url) {
      response.status(302).setHeader('Location', file.url);
      return;
    }
    const safeInline = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'video/mp4',
      'video/webm',
    ]);
    const mime =
      file.mimeType && safeInline.has(file.mimeType) ? file.mimeType : 'application/octet-stream';
    const filename = encodeURIComponent(file.filename).replace(
      /['()*]/g,
      (char) => '%' + char.charCodeAt(0).toString(16),
    );
    response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    return new StreamableFile(Readable.fromWeb(file.body! as NodeReadableStream), {
      type: mime,
      disposition: `${mime === 'application/octet-stream' ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}`,
    });
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.create')
  create(
    @Body(new ZodValidationPipe(contentInputSchema)) input: ContentInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.create(input, actor, metadata(request));
  }
  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(contentUpdateSchema)) input: Partial<ContentInput>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.update(id, input, actor, metadata(request));
  }
  @Delete(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.archive')
  delete(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.delete(id, actor, metadata(request));
  }
  @Post(':id/state')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.publish')
  state(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(stateInputSchema))
    input: { state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' },
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.setState(id, input.state, actor, metadata(request));
  }
  @Post(':id/upload-ticket')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.update')
  uploadTicket(@Param('id') id: string, @CurrentAdmin() actor: AuthenticatedAdmin) {
    return this.content.issueUploadTicket(id, actor);
  }
  @Post(':id/attachments')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.update')
  attach(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(attachmentInputSchema)) input: AttachmentInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.attach(id, input, actor, metadata(request));
  }
  @Post(':id/attachments/upload')
  @UseGuards(CsrfGuard)
  @RequirePermissions('content.update')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.content.attachUpload(id, file, actor, metadata(request));
  }
}
