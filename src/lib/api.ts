const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || `${window.location.origin}/api`
const API_TOKEN_ENV = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim()
const API_TOKEN_STORAGE_KEY = 'aguia.api.token'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  timeoutMs?: number
  retries?: number
}

const DEFAULT_TIMEOUT = 15_000
const RETRY_BASE_MS = 1_000

const obterTokenApi = (): string | undefined => {
  if (API_TOKEN_ENV) return API_TOKEN_ENV
  try {
    const valor = localStorage.getItem(API_TOKEN_STORAGE_KEY)?.trim()
    return valor || undefined
  } catch {
    return undefined
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const timeout = opts?.timeoutMs ?? DEFAULT_TIMEOUT
  const maxAttempts = (opts?.retries ?? 0) + 1
  const token = obterTokenApi()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let lastError: Error | undefined
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1)
      await new Promise(r => setTimeout(r, delay))
    }
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      })

      if (!res.ok) {
        let message = `Erro HTTP ${res.status}`
        try {
          const payload = await res.json()
          if (payload?.message) message = payload.message
        } catch {
          // sem payload json
        }
        throw new Error(message)
      }

      if (res.status === 204) return undefined as T
      return (await res.json()) as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Não retentar erros de negócio (4xx)
      if (lastError.message.startsWith('Erro HTTP 4')) throw lastError
    }
  }
  throw lastError!
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  del: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
}
