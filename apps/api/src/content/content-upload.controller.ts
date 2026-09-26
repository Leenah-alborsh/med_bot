import {
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadAuthenticatedRequest } from './upload-ticket.guard.js';
import { ContentService } from './content.service.js';
import { UploadTicketGuard } from './upload-ticket.guard.js';
import { uploadOptions } from './upload.js';

@Controller('content-upload')
export class ContentUploadController {
  constructor(private readonly content: ContentService) {}

  @Post(':id')
  @UseGuards(UploadTicketGuard)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: UploadAuthenticatedRequest,
  ) {
    return this.content.attachUpload(id, file, request.uploadActor, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
