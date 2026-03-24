import { describe, expect, it } from 'vitest'
import { validarIntegridadeBackup } from '../../server/backup-utils.mjs'

describe('integridade de backup', () => {
  it('aceita backup consistente com pessoas, processos e documentos', () => {
    const payload = {
      versao: '2.0',
      timestamp: '2026-03-24T00:00:00.000Z',
      pessoas: [{ id: 'p1', nome: 'Pessoa 1', cpf: '000' }],
      processos: [{ id: 'pr1', pessoaId: 'p1', tipo: 'X', status: 'ABERTO' }],
      documentosProcesso: [{ id: 'd1', processoId: 'pr1', nome: 'Doc', status: 'PENDENTE' }],
      configuracoes: [],
    }
    expect(validarIntegridadeBackup(payload).ok).toBe(true)
  })

  it('reprova backup com processo sem pessoa', () => {
    const payload = {
      versao: '2.0',
      timestamp: '2026-03-24T00:00:00.000Z',
      pessoas: [],
      processos: [{ id: 'pr1', pessoaId: 'p1', tipo: 'X', status: 'ABERTO' }],
      documentosProcesso: [],
      configuracoes: [],
    }
    const resultado = validarIntegridadeBackup(payload)
    expect(resultado.ok).toBe(false)
    expect(resultado.message).toMatch(/processos sem pessoa/i)
  })

  it('reprova backup com documento sem processo', () => {
    const payload = {
      versao: '2.0',
      timestamp: '2026-03-24T00:00:00.000Z',
      pessoas: [{ id: 'p1', nome: 'Pessoa 1', cpf: '000' }],
      processos: [],
      documentosProcesso: [{ id: 'd1', processoId: 'pr1', nome: 'Doc', status: 'PENDENTE' }],
      configuracoes: [],
    }
    const resultado = validarIntegridadeBackup(payload)
    expect(resultado.ok).toBe(false)
    expect(resultado.message).toMatch(/documentos sem processo/i)
  })
})
