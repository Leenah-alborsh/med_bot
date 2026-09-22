import {
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ContentService } from './content.service.js';
import { UploadTicketService } from './upload-ticket.service.js';
import { uploadOptions } from './upload.js';

@Controller('content-upload')
export class ContentUploadController {
  constructor(
    private readonly content: ContentService,
    private readonly tickets: UploadTicketService,
  ) {}

  @Post(':id')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @Param('id') id: string,
    @Headers('x-upload-ticket') ticket: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    const actor = this.tickets.verify(ticket, id);
    return this.content.attachUpload(id, file, actor, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
}
