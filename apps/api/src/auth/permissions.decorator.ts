import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@medical/shared';

export const PERMISSIONS_METADATA_KEY = 'required-permissions';
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
