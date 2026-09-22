import { Injectable } from '@nestjs/common';
import type { Prisma } from '@medical/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestMetadata } from '../auth/auth.types.js';

const secretPattern = /password|token|secret|cookie|authorization/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        secretPattern.test(key) ? '[redacted]' : redactSecrets(nested),
      ]),
    );
  }
  return value;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorId?: string;
    actionKey: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    metadata?: RequestMetadata;
    client?: Prisma.TransactionClient;
  }) {
    const client = input.client ?? this.prisma;
    return client.auditLog.create({
      data: {
        actorId: input.actorId,
        actionKey: input.actionKey,
        entityType: input.entityType,
        entityId: input.entityId,
        before:
          input.before === undefined
            ? undefined
            : (redactSecrets(input.before) as Prisma.InputJsonValue),
        after:
          input.after === undefined
            ? undefined
            : (redactSecrets(input.after) as Prisma.InputJsonValue),
        ipAddress: input.metadata?.ipAddress,
        userAgent: input.metadata?.userAgent,
      },
    });
  }

  async list(page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          actionKey: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          createdAt: true,
          actor: { select: { id: true, displayNameAr: true, email: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
