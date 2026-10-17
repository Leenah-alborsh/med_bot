import { describe, expect, it, vi } from 'vitest';
import { recordBotUsage, SESSION_IDLE_MS, startsNewSession } from '../src/bot/usage.js';

describe('bot usage sessions', () => {
  it('counts first interaction and exactly 30 minutes idle as new sessions', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    expect(startsNewSession(undefined, now)).toBe(true);
    expect(startsNewSession(new Date(now.getTime() - SESSION_IDLE_MS + 1), now)).toBe(false);
    expect(startsNewSession(new Date(now.getTime() - SESSION_IDLE_MS), now)).toBe(true);
  });

  it('locks the membership before checking for duplicate updates, and ignores redelivery', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      botUsageEvent: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing' }),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    await recordBotUsage(
      { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as never,
      'membership',
      42,
      'START',
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.botUsageEvent.findUnique.mock.invocationCallOrder[0]!,
    );
    expect(tx.botUsageEvent.create).not.toHaveBeenCalled();
    expect(tx.botUsageEvent.findFirst).not.toHaveBeenCalled();
  });

  it.each([null, { createdAt: new Date() }])(
    'records sanitized action metadata and session state',
    async (previous) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        botUsageEvent: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(previous),
          create: vi.fn(),
        },
      };
      await recordBotUsage(
        { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as never,
        'membership',
        42,
        'START',
      );
      expect(tx.botUsageEvent.create).toHaveBeenCalledWith({
        data: {
          botMembershipId: 'membership',
          updateId: 42n,
          action: 'START',
          createdAt: expect.any(Date) as unknown,
          isSessionStart: !previous,
        },
      });
    },
  );
});
