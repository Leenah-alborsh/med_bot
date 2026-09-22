import { type NextRequest } from 'next/server';
const baseUrl =
  process.env.API_INTERNAL_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001/api';
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== request.nextUrl.origin) {
      return Response.json({ error: { message: 'Invalid request origin' } }, { status: 403 });
    }
  }
  const { path } = await context.params;
  const target = new URL(`${baseUrl}/v1/${path.join('/')}`);
  target.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'x-csrf-token', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  });
  const responseHeaders = new Headers({
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  });
  for (const cookie of upstream.headers.getSetCookie())
    responseHeaders.append('set-cookie', cookie);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;

export const DELETE = proxy;
