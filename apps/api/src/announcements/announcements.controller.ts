import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AnnouncementsService } from './announcements.service.js';
import {
  announcementSchema,
  welcomeSchema,
  type AnnouncementInput,
  type WelcomeInput,
} from './announcements.schemas.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('announcements')
@UseGuards(SessionAuthGuard, PermissionGuard)
@RequirePermissions('announcements.send')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  settings() {
    return this.announcements.settings();
  }

  @Post('welcome')
  @UseGuards(CsrfGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 10_000_000, files: 1 },
      fileFilter: (_request, file, callback) =>
        callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
    }),
  )
  updateWelcome(
    @Body(new ZodValidationPipe(welcomeSchema)) input: WelcomeInput,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.announcements.updateWelcome(input, photo, actor, metadata(request));
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(
    @Body(new ZodValidationPipe(announcementSchema)) input: AnnouncementInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.announcements.create(input, actor, metadata(request));
  }
}
