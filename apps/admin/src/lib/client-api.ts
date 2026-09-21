function csrfToken() {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('med_admin_csrf='))
    ?.split('=')[1];
}

export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? 'GET';
  const csrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? csrfToken() : undefined;
  const response = await fetch(`/api/backend/${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'تعذر إتمام الطلب');
  return body as T;
}
