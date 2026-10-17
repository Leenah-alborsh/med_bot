import type { PrismaClient } from '@medical/database';

export const SESSION_IDLE_MS = 30 * 60_000;

export function startsNewSession(previous: Date | undefined, now: Date) {
  return !previous || now.getTime() - previous.getTime() >= SESSION_IDLE_MS;
}

// No message text is stored. Serialize per membership so concurrent updates cannot
// count two sessions, and use Telegram's update ID to ignore redelivery.
export async function recordBotUsage(
  prisma: PrismaClient,
  membershipId: string,
  updateId: number,
  action: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "StudentBotMembership" WHERE "id" = ${membershipId}::uuid FOR UPDATE`;
    const duplicate = await tx.botUsageEvent.findUnique({
      where: {
        botMembershipId_updateId: { botMembershipId: membershipId, updateId: BigInt(updateId) },
      },
      select: { id: true },
    });
    if (duplicate) return;
    const previous = await tx.botUsageEvent.findFirst({
      where: { botMembershipId: membershipId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const now = new Date();
    await tx.botUsageEvent.create({
      data: {
        botMembershipId: membershipId,
        updateId: BigInt(updateId),
        action,
        createdAt: now,
        isSessionStart: startsNewSession(previous?.createdAt, now),
      },
    });
  });
}
