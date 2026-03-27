import { describe, expect, it, vi } from 'vitest'
import { gerarId, normalizarCPF, obterMensagemErro } from './robustness'

describe('utils/robustness', () => {
  it('gera id com prefixo informado', () => {
    const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-1234567890ab')
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    const id = gerarId('pessoa')

    expect(id).toBe('pessoa_1700000000000_123456781234')

    randomUUIDSpy.mockRestore()
    nowSpy.mockRestore()
  })

  it('retorna mensagem do erro quando disponível', () => {
    const msg = obterMensagemErro(new Error('Falha específica'), 'fallback')
    expect(msg).toBe('Falha específica')
  })

  it('retorna fallback quando erro não é Error válido', () => {
    expect(obterMensagemErro('erro em string', 'fallback')).toBe('fallback')
    expect(obterMensagemErro(new Error('   '), 'fallback')).toBe('fallback')
  })

  it('normaliza cpf removendo caracteres não numéricos', () => {
    expect(normalizarCPF('123.456.789-09')).toBe('12345678909')
  })
})
