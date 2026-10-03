import { Injectable } from '@nestjs/common';
import { Prisma } from '@medical/database';
import type { AuthenticatedAdmin } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListContentInput } from './content.schemas.js';
import { ContentService } from './content.service.js';

@Injectable()
export class UnifiedContentService {
  constructor(
    private readonly content: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: ListContentInput, actor: AuthenticatedAdmin) {
    // Unclassified files have no academic relationships or publication state.
    const includeInbox = !(
      query.yearId ||
      query.semesterId ||
      query.courseId ||
      query.sectionId ||
      query.contentCategoryId ||
      query.state ||
      (query.type && query.type !== 'FILE')
    );
    const where: Prisma.TelegramChannelFileWhereInput = {
      status: 'UNCLASSIFIED',
      contentItemId: null,
      attachmentId: null,
      ...(query.search
        ? {
            OR: [
              { fileName: { contains: query.search, mode: 'insensitive' } },
              { mimeType: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const start = (query.page - 1) * query.pageSize;
    let inboxTotal = 0;
    let inboxAvailable = true;
    let inbox: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: bigint;
      mediaType: string;
      receivedAt: Date;
    }> = [];
    if (includeInbox) {
      try {
        inboxTotal = await this.prisma.telegramChannelFile.count({ where });
        if (start < inboxTotal)
          inbox = await this.prisma.telegramChannelFile.findMany({
            where,
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              fileSize: true,
              mediaType: true,
              receivedAt: true,
            },
            orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
            skip: start,
            take: query.pageSize,
          });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2021' ||
          error.meta?.table !== 'public.TelegramChannelFile'
        )
          throw error;
        // A database without the inbox table must still expose its managed library.
        inboxAvailable = false;
        inboxTotal = 0;
        inbox = [];
      }
    }

    // Inbox rows come first, followed by the existing managed-content ordering.
    // Translate the combined offset into existing service pages, preserving scope checks.
    const managedStart = Math.max(0, start - inboxTotal);
    const managedPage = Math.floor(managedStart / query.pageSize) + 1;
    const offset = managedStart % query.pageSize;
    const managed = await this.content.list({ ...query, page: managedPage }, actor);
    const needed = query.pageSize - inbox.length;
    let managedItems = managed.items.slice(offset, offset + needed);
    if (needed > managedItems.length && managedStart + managedItems.length < managed.total) {
      const next = await this.content.list({ ...query, page: managedPage + 1 }, actor);
      managedItems = managedItems.concat(next.items.slice(0, needed - managedItems.length));
    }
    return {
      items: [
        ...inbox.map((row) => ({
          ...row,
          source: 'telegram_inbox' as const,
          unifiedId: `telegram_inbox:${row.id}`,
          titleAr: row.fileName,
          contentType: 'FILE' as const,
          needsClassification: true,
          section: null,
          contentCategory: null,
          state: null,
          fileSize: row.fileSize.toString(),
          receivedAt: row.receivedAt.toISOString(),
        })),
        ...managedItems.map((row) => ({
          ...row,
          source: 'managed_content' as const,
          unifiedId: `managed_content:${row.id}`,
          needsClassification: false,
        })),
      ],
      total: managed.total + inboxTotal,
      inboxAvailable,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
