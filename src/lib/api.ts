const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || `${window.location.origin}/api`
const API_TOKEN_ENV = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim()
const API_TOKEN_STORAGE_KEY = 'aguia.api.token'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const obterTokenApi = (): string | undefined => {
  if (API_TOKEN_ENV) return API_TOKEN_ENV
  try {
    const valor = localStorage.getItem(API_TOKEN_STORAGE_KEY)?.trim()
    return valor || undefined
  } catch {
    return undefined
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const token = obterTokenApi()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
