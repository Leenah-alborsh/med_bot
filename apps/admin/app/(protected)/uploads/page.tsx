import { AdminFileUploader, type UploadTarget } from '../../../src/components/admin-file-uploader';
import { serverApi } from '../../../src/lib/server-api';

export default async function UploadsPage() {
  const { items } = await serverApi<{ items: UploadTarget[] }>('content/upload-targets');
  return <AdminFileUploader items={items} />;
}
