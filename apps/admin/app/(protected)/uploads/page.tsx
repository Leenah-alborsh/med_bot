import { AdminFileUploader, type UploadTarget } from '../../../src/components/admin-file-uploader';
import { serverApi } from '../../../src/lib/server-api';
import { getUploadConfig } from '../../../src/lib/server-upload-config';

export default async function UploadsPage() {
  const [{ items }, config] = await Promise.all([
    serverApi<{ items: UploadTarget[] }>('content/upload-targets'),
    getUploadConfig(),
  ]);
  return <AdminFileUploader items={items} maxUploadBytes={config.maxUploadBytes} />;
}
