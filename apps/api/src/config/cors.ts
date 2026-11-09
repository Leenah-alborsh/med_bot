// Explicit deployment origins. Uploads use signed tickets and bypass the admin
// proxy so that large multipart bodies are not subject to frontend function limits.
const arduOrigins = ['https://ardugaza.education', 'https://www.ardugaza.education'];
export function adminCorsOrigins(configured: string): string[] {
  const values = [...configured.split(','), ...arduOrigins]
    .map((value) => value.trim())
    .filter(Boolean);
  return [
    ...new Set(
      values.map((value) => {
        const url = new URL(value);
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash
        ) {
          throw new Error(
            'API_CORS_ORIGIN must contain exact HTTP(S) origins, separated by commas',
          );
        }
        return url.origin;
      }),
    ),
  ];
}
