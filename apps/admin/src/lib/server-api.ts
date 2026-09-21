import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminSummary } from '@medical/shared';

const baseUrl =
  process.env.API_INTERNAL_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001/api';

export async function serverApi<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${baseUrl}/v1/${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  });
  if (response.status === 401) redirect('/login');
  if (!response.ok) throw new Error('API request failed');
  return response.json() as Promise<T>;
}

export async function getCurrentAdmin(): Promise<AdminSummary & { roleKeys: string[] }> {
  const result = await serverApi<{ admin: AdminSummary & { roleKeys: string[] } }>('auth/me');
  return result.admin;
}

export function hasPermission(
  admin: AdminSummary,
  permission: AdminSummary['permissions'][number],
) {
  return admin.permissions.includes(permission);
}
