import { describe, expect, it } from 'vitest';
import { HealthService } from '../src/health/health.service.js';

describe('HealthService', () => {
  it('reports degraded health when the database query fails', async () => {
    const prisma = {
      $queryRaw: () => Promise.reject(new Error('offline')),
    };
    const service = new HealthService(prisma as never);

    await expect(service.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      database: { status: 'error' },
    });
  });
});
