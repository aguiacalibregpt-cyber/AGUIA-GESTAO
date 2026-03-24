import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('api token header', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('envia Authorization quando token existe no localStorage', async () => {
    localStorage.setItem('aguia.api.token', 'token-teste')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    await api.get('/health')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const options = fetchSpy.mock.calls[0][1] as RequestInit
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer token-teste')
  })

  it('nao envia Authorization quando token nao existe', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response)

    await api.get('/health')

    const options = fetchSpy.mock.calls[0][1] as RequestInit
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})
