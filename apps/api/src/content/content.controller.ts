import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
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
  @Get(':id')
  @RequirePermissions('content.read')
  get(@Param('id') id: string, @CurrentAdmin() actor: AuthenticatedAdmin) {
    return this.content.get(id, actor);
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
