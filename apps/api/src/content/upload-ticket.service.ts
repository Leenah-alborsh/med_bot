import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Environment } from '../config/environment.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';

type UploadClaims = {
  adminId: string;
  contentId: string;
  roleKeys: string[];
  exp: number;
  nonce: string;
};

@Injectable()
export class UploadTicketService {
  private readonly secret: string;
  constructor(config: ConfigService<Environment, true>) {
    this.secret =
      config.get('ADMIN_UPLOAD_TOKEN_SECRET', { infer: true }) ??
      config.get('TELEGRAM_WEBHOOK_SECRET', { infer: true }) ??
      '';
  }

  issue(contentId: string, actor: AuthenticatedAdmin) {
    if (this.secret.length < 32) throw new BadRequestException('خدمة الرفع المباشر غير مهيأة.');
    const claims: UploadClaims = {
      adminId: actor.id,
      contentId,
      roleKeys: actor.roleKeys,
      exp: Date.now() + 5 * 60_000,
      nonce: randomUUID(),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { ticket: `${payload}.${this.sign(payload)}`, expiresInSeconds: 300 };
  }

  verify(ticket: string, contentId: string) {
    const [payload, signature] = ticket.split('.');
    if (!payload || !signature) throw new UnauthorizedException('تذكرة الرفع غير صالحة.');
    const expected = this.sign(payload);
    const valid =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) throw new UnauthorizedException('تذكرة الرفع غير صالحة.');
    let claims: UploadClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UploadClaims;
    } catch {
      throw new UnauthorizedException('تذكرة الرفع غير صالحة.');
    }
    if (claims.contentId !== contentId || claims.exp < Date.now())
      throw new UnauthorizedException('انتهت تذكرة الرفع أو لا تخص هذا المحتوى.');
    return { id: claims.adminId, roleKeys: claims.roleKeys };
  }

  private sign(payload: string) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
