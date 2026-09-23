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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminsService } from './admins.service.js';
import {
  createAdminSchema,
  listAdminsSchema,
  rolesSchema,
  scopesSchema,
  statusSchema,
  updateAdminSchema,
  type CreateAdminInput,
  type ListAdminsInput,
  type RolesInput,
  type ScopesInput,
  type UpdateAdminInput,
} from './admin.schemas.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('admins')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @RequirePermissions('admins.read')
  list(@Query(new ZodValidationPipe(listAdminsSchema)) query: ListAdminsInput) {
    return this.admins.list(query);
  }

  @Get('roles')
  @RequirePermissions('roles.read')
  roles() {
    return this.admins.roles();
  }

  @Get(':id')
  @RequirePermissions('admins.read')
  get(@Param('id') id: string) {
    return this.admins.get(id);
  }

  @Get(':id/audit')
  @RequirePermissions('audit.read')
  audit(@Param('id') id: string) {
    return this.admins.audit(id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.create')
  create(
    @Body(new ZodValidationPipe(createAdminSchema)) input: CreateAdminInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.create(input, actor, metadata(request));
  }

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.update')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminSchema)) input: UpdateAdminInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.update(id, input, actor, metadata(request));
  }

  @Post(':id/status')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.disable')
  status(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(statusSchema)) input: { active: boolean },
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.setStatus(id, input.active, actor, metadata(request));
  }

  @Post(':id/roles')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.roles.assign')
  assignRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rolesSchema)) input: RolesInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.assignRoles(id, input, actor, metadata(request));
  }

  @Post(':id/scopes')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.roles.assign')
  assignScopes(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(scopesSchema)) input: ScopesInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.assignScopes(id, input, actor, metadata(request));
  }

  @Post(':id/revoke-sessions')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.disable')
  revokeSessions(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.revokeSessions(id, actor, metadata(request));
  }

  @Delete(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.disable')
  remove(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.remove(id, actor, metadata(request));
  }

  @Post(':id/setup-credential')
  @UseGuards(CsrfGuard)
  @RequirePermissions('admins.update')
  regenerateSetup(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.admins.regenerateSetup(id, actor, metadata(request));
  }
}
