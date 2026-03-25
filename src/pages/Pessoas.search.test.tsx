import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Pessoas } from './Pessoas'

const mockCarregarPessoas = vi.fn(async () => {})
const mockAdicionarPessoa = vi.fn(async () => ({ id: 'nova-pessoa' }))
const mockAtualizarPessoa = vi.fn(async () => {})
const mockDeletarPessoa = vi.fn(async () => {})

const hoje = new Date('2026-03-25T12:00:00.000Z')

const pessoasMock = [
  {
    id: 'p1',
    nome: 'Ana Lima',
    cpf: '111.111.111-11',
    telefone: '',
    dataCadastro: hoje,
    dataAtualizacao: hoje,
    ativo: true,
  },
  {
    id: 'p2',
    nome: 'Bruno Souza',
    cpf: '222.222.222-22',
    telefone: '',
    dataCadastro: hoje,
    dataAtualizacao: hoje,
    ativo: true,
  },
  {
    id: 'p3',
    nome: 'Ana Líma',
    cpf: '333.333.333-33',
    telefone: '',
    dataCadastro: hoje,
    dataAtualizacao: hoje,
    ativo: true,
  },
]

vi.mock('../stores/pessoasStore', () => ({
  usePessoasStore: () => ({
    pessoas: pessoasMock,
    carregarPessoas: mockCarregarPessoas,
    adicionarPessoa: mockAdicionarPessoa,
    atualizarPessoa: mockAtualizarPessoa,
    deletarPessoa: mockDeletarPessoa,
    erro: null,
    carregando: false,
    avisos: [],
  }),
}))

describe('Pessoas busca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('filtra por nome sem ser invalidado pela busca de CPF', async () => {
    const user = userEvent.setup()
    render(<Pessoas />)

    expect(screen.getByText('3 pessoa(s) cadastrada(s)')).toBeTruthy()

    const inputBusca = screen.getByPlaceholderText('Buscar por nome ou CPF...')
    await user.type(inputBusca, 'bruno')

    expect(screen.getByText('1 resultado(s)')).toBeTruthy()
    expect(screen.getAllByText('Bruno Souza')).toHaveLength(2)
    expect(screen.queryByText('Ana Lima')).toBeNull()
  })

  test('filtra por nome ignorando acentos', async () => {
    const user = userEvent.setup()
    render(<Pessoas />)

    const inputBusca = screen.getByPlaceholderText('Buscar por nome ou CPF...')
    await user.type(inputBusca, 'ana lima')

    expect(screen.getByText('2 resultado(s)')).toBeTruthy()
    expect(screen.getAllByText('Ana Lima')).toHaveLength(2)
    expect(screen.getAllByText('Ana Líma')).toHaveLength(2)
  })
})
