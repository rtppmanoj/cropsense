export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number };

export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = 15_000, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  if (requestInit.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const callerSignal = requestInit.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...requestInit, headers, credentials: 'include', signal: controller.signal });
  } catch (reason) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new ApiError(408, 'The request took too long. Please try again shortly.');
    }
    throw reason;
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail)
      ? body.detail.map((item: { msg?: string }) => item.msg ?? '').join('; ')
      : `Request failed (${response.status})`;
    if (response.status === 401) window.dispatchEvent(new Event('cropsense:unauthorized'));
    throw new ApiError(response.status, detail);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
