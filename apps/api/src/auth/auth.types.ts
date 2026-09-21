import type { PermissionKey } from '@medical/shared';
import type { Request } from 'express';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  displayNameAr: string;
  displayNameEn: string;
  status: 'ACTIVE';
  mustChangePassword: boolean;
  permissions: PermissionKey[];
  roleKeys: string[];
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}
