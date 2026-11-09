import { uploadEndpoint } from './direct-upload';
function csrfToken() {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('med_admin_csrf='))
    ?.split('=')[1];
}

export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? 'GET';
  const csrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? csrfToken() : undefined;
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'تعذر إتمام الطلب');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
    window.dispatchEvent(new Event('admin-action-completed'));
  return body as T;
}

export function clientUpload<T>(
  path: string,
  data: FormData,
  onProgress: (percent: number) => void,
  ticket: string,
  uploadBaseUrl?: string,
): Promise<T> {
  const baseUrl = uploadBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', uploadEndpoint(baseUrl, path, window.location.protocol));
    request.timeout = 3_900_000;
    request.setRequestHeader('X-Upload-Ticket', ticket);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      let body: T & { error?: { message?: string } };
      try {
        body = JSON.parse(request.responseText || '{}') as typeof body;
      } catch {
        reject(new Error(`تعذر رفع الملف (HTTP ${request.status}).`));
        return;
      }
      if (request.status >= 200 && request.status < 300) {
        window.dispatchEvent(new Event('admin-action-completed'));
        resolve(body);
      } else reject(new Error(body.error?.message ?? 'تعذر رفع الملف'));
    });
    request.addEventListener('error', () =>
      reject(
        new Error(
          'تعذر الاتصال بخدمة رفع الملفات. تحققي من اتصال الإنترنت وسماح الخدمة بدومين الموقع.',
        ),
      ),
    );
    request.addEventListener('timeout', () =>
      reject(
        new Error('انتهت مهلة رفع الملف. تحققي من الاتصال وحالة خدمة الرفع قبل إعادة المحاولة.'),
      ),
    );
    request.addEventListener('abort', () => reject(new Error('تم إلغاء رفع الملف.')));
    request.send(data);
  });
}
