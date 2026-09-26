import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UploadTicketService } from './upload-ticket.service.js';

type UploadActor = ReturnType<UploadTicketService['verify']>;
export type UploadAuthenticatedRequest = Request & { uploadActor: UploadActor };

@Injectable()
export class UploadTicketGuard implements CanActivate {
  constructor(private readonly tickets: UploadTicketService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { uploadActor?: UploadActor }>();
    const contentId = request.params.id;
    if (typeof contentId !== 'string') throw new UnauthorizedException('تذكرة الرفع غير صالحة.');
    request.uploadActor = this.tickets.verify(request.get('x-upload-ticket') ?? '', contentId);
    return true;
  }
}
