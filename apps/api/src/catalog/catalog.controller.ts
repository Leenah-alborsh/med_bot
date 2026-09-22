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
import { CurrentAdmin } from '../auth/current-admin.decorator.js';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { CsrfGuard } from '../auth/csrf.guard.js';
import { PermissionGuard } from '../auth/permission.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';
import {
  catalogUpdateSchema,
  courseInputSchema,
  listCatalogSchema,
  sectionInputSchema,
  semesterInputSchema,
  yearInputSchema,
  type ListCatalogInput,
} from './catalog.schemas.js';

const metadata = (request: Request) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

@Controller('catalog')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('years')
  @RequirePermissions('catalog.read')
  years(
    @Query(new ZodValidationPipe(listCatalogSchema)) query: ListCatalogInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.catalog.years(query, actor);
  }
  @Get('semesters')
  @RequirePermissions('catalog.read')
  semesters(
    @Query(new ZodValidationPipe(listCatalogSchema)) query: ListCatalogInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.catalog.semesters(query, actor);
  }
  @Get('courses')
  @RequirePermissions('catalog.read')
  courses(
    @Query(new ZodValidationPipe(listCatalogSchema)) query: ListCatalogInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.catalog.courses(query, actor);
  }
  @Get('sections')
  @RequirePermissions('catalog.read')
  sections(
    @Query(new ZodValidationPipe(listCatalogSchema)) query: ListCatalogInput,
    @CurrentAdmin() actor: AuthenticatedAdmin,
  ) {
    return this.catalog.sections(query, actor);
  }

  @Post('years')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.create')
  createYear(
    @Body(new ZodValidationPipe(yearInputSchema)) input: Record<string, unknown>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.create('year', input, actor, metadata(request));
  }
  @Post('semesters')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.create')
  createSemester(
    @Body(new ZodValidationPipe(semesterInputSchema)) input: Record<string, unknown>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.create('semester', input, actor, metadata(request));
  }
  @Post('courses')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.create')
  createCourse(
    @Body(new ZodValidationPipe(courseInputSchema)) input: Record<string, unknown>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.create('course', input, actor, metadata(request));
  }
  @Post('sections')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.create')
  createSection(
    @Body(new ZodValidationPipe(sectionInputSchema)) input: Record<string, unknown>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.create('section', input, actor, metadata(request));
  }

  @Patch(':kind/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.update')
  update(
    @Param('kind') kind: 'year' | 'semester' | 'course' | 'section',
    @Param('id') id: string,
    @Body(new ZodValidationPipe(catalogUpdateSchema)) input: Record<string, unknown>,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.update(kind, id, input, actor, metadata(request));
  }

  @Post(':kind/:id/archive')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.archive')
  archive(
    @Param('kind') kind: 'year' | 'semester' | 'course' | 'section',
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.archive(kind, id, actor, metadata(request));
  }
  @Post(':kind/:id/restore')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.update')
  restore(
    @Param('kind') kind: 'year' | 'semester' | 'course' | 'section',
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.restore(kind, id, actor, metadata(request));
  }

  @Delete(':kind/:id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('catalog.archive')
  delete(
    @Param('kind') kind: 'year' | 'semester' | 'course' | 'section',
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.catalog.delete(kind, id, actor, metadata(request));
  }
}
