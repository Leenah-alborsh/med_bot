import { apiHealthSchema, type ApiHealth } from '@medical/shared';

export async function getApiHealth(): Promise<ApiHealth | null> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

  try {
    const response = await fetch(`${baseUrl}/v1/health`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    return apiHealthSchema.parse(await response.json());
  } catch {
    return null;
  }
}
