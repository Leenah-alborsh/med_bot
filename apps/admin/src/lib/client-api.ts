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
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${baseUrl}/v1/${path}`);
    request.setRequestHeader('X-Upload-Ticket', ticket);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      const body = JSON.parse(request.responseText || '{}') as T & { error?: { message?: string } };
      if (request.status >= 200 && request.status < 300) resolve(body);
      else reject(new Error(body.error?.message ?? 'تعذر رفع الملف'));
    });
    request.addEventListener('error', () => reject(new Error('تعذر الاتصال بخدمة رفع الملفات')));
    request.send(data);
  });
}
