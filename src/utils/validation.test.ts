import { describe, expect, it } from 'vitest'
import { validarPessoaFormulario, validarProcessoFormulario } from './validation'

describe('utils/validation', () => {
  it('valida formulário de pessoa com dados corretos', () => {
    const erros = validarPessoaFormulario({
      nome: 'Maria Oliveira',
      cpf: '529.982.247-25',
      telefone: '(11) 99999-9999',
      email: 'maria@teste.com',
      endereco: 'Rua 1',
      senhaGov: 'segredo',
    })

    expect(erros).toEqual({})
  })

  it('retorna erros esperados para pessoa inválida', () => {
    const erros = validarPessoaFormulario({
      nome: 'A',
      cpf: '111.111.111-11',
      telefone: '12345',
      email: 'invalido',
      endereco: '',
      senhaGov: '',
    })

    expect(erros.nome).toBeDefined()
    expect(erros.cpf).toBe('CPF inválido')
    expect(erros.telefone).toBeDefined()
    expect(erros.email).toBeDefined()
  })

  it('exige pessoa e tipo no formulário de processo', () => {
    const erros = validarProcessoFormulario({
      pessoaId: '',
      tipo: '',
      numero: '',
      dataAbertura: '',
      dataPrazo: '',
      descricao: '',
      observacoes: '',
    })

    expect(erros.pessoaId).toBe('Selecione a pessoa vinculada ao processo')
    expect(erros.tipo).toBe('Selecione o tipo do processo')
  })

  it('considera inválido pessoaId/tipo com apenas espaços', () => {
    const erros = validarProcessoFormulario({
      pessoaId: '   ',
      tipo: '   ',
      numero: '1234',
      dataAbertura: '2026-03-10',
      dataPrazo: '2026-03-12',
      descricao: '',
      observacoes: '',
    })

    expect(erros.pessoaId).toBe('Selecione a pessoa vinculada ao processo')
    expect(erros.tipo).toBe('Selecione o tipo do processo')
  })

  it('valida número mínimo e prazo não anterior à abertura', () => {
    const erros = validarProcessoFormulario({
      pessoaId: 'p1',
      tipo: 'AQUISICAO_ARMA_SINARM',
      numero: '12',
      dataAbertura: '2026-03-10',
      dataPrazo: '2026-03-09',
      descricao: '',
      observacoes: '',
    })

    expect(erros.numero).toBe('Número do processo deve ter ao menos 4 caracteres')
    expect(erros.dataPrazo).toBe('A data de prazo não pode ser anterior à data de abertura')
  })
})
