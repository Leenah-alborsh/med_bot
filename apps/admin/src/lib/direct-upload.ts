export function directUploadBaseUrl(environment: Record<string, string | undefined>) {
  const candidates = [
    environment.API_PUBLIC_BASE_URL,
    environment.API_INTERNAL_BASE_URL,
    environment.NEXT_PUBLIC_API_BASE_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.username || url.password || url.search || url.hash) continue;
      if (
        url.protocol === 'https:' ||
        (environment.NODE_ENV !== 'production' && url.protocol === 'http:')
      ) {
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      /* Try the next explicitly configured base URL. */
    }
  }
  return environment.NODE_ENV === 'production' ? undefined : 'http://localhost:3001/api';
}

export function uploadEndpoint(base: string | undefined, path: string, protocol: string) {
  if (!base)
    throw new Error(
      'عنوان خدمة رفع الملفات غير مهيأ. راجعي إعداد API_PUBLIC_BASE_URL في استضافة الموقع.',
    );
  const url = new URL(base.replace(/\/$/, '') + '/v1/' + path);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('عنوان خدمة رفع الملفات غير صالح.');
  }
  if (
    protocol === 'https:' &&
    (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new Error('خدمة الرفع يجب أن تستخدم عنوان HTTPS عامًا، وليس localhost.');
  }
  return url.toString();
}
