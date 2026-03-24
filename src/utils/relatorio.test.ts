import { describe, expect, it } from 'vitest'
import { montarTabelaRelatorioProcessos } from './relatorio'

describe('montarTabelaRelatorioProcessos', () => {
  const pessoas = [
    { id: 'p1', nome: 'Maria', cpf: '111.222.333-44', senhaGov: 'segredo123' },
  ]

  const processos = [
    {
      pessoaId: 'p1',
      tipo: 'INSS_APOSENTADORIA',
      status: 'EM_ANDAMENTO',
      dataAbertura: new Date('2026-01-10T00:00:00.000Z'),
      dataPrazo: new Date('2026-02-10T00:00:00.000Z'),
    },
  ]

  it('nao inclui coluna de senha quando desabilitado', () => {
    const { colunas, linhas } = montarTabelaRelatorioProcessos(processos, pessoas, false)
    expect(colunas).toEqual(['Nome', 'CPF', 'Tipo', 'Status', 'Data de Início', 'Data de Prazo'])
    expect(linhas[0]).toHaveLength(6)
    expect(linhas[0][2]).toBe('INSS APOSENTADORIA')
  })

  it('inclui coluna de senha quando habilitado', () => {
    const { colunas, linhas } = montarTabelaRelatorioProcessos(processos, pessoas, true)
    expect(colunas).toEqual(['Nome', 'CPF', 'Senha Gov', 'Tipo', 'Status', 'Data de Início', 'Data de Prazo'])
    expect(linhas[0]).toHaveLength(7)
    expect(linhas[0][2]).toBe('segredo123')
  })
})
