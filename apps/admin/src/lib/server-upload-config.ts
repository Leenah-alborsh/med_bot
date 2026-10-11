import { ServerApiError, serverApi } from './server-api';
import type { UploadConfig } from './upload-limits';

export async function getUploadConfig(): Promise<UploadConfig> {
  try {
    return await serverApi<UploadConfig>('content/upload-config');
  } catch (error) {
    // The previous API has no configuration endpoint during rolling deployments.
    if (error instanceof ServerApiError && error.status === 404) {
      return { maxUploadBytes: 50_000_000 };
    }
    throw error;
  }
}
