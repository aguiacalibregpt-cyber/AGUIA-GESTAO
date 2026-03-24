import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { Processos } from './Processos'
import { StatusProcesso, TipoProcesso } from '../types/models'

const mockCarregarProcessos = vi.fn(async () => {})
const mockAdicionarProcesso = vi.fn(async () => ({ id: 'novo' }))
const mockAtualizarProcesso = vi.fn(async () => {})
const mockDeletarProcesso = vi.fn(async () => {})

const mockCarregarPessoas = vi.fn(async () => {})
const mockAdicionarPessoa = vi.fn(async () => ({ id: 'nova-pessoa', nome: 'Nova Pessoa' }))

const hoje = new Date()
hoje.setHours(0, 0, 0, 0)
const ontem = new Date(hoje)
ontem.setDate(ontem.getDate() - 1)

const processosMock = [
  {
    id: 'proc-sem-prazo',
    pessoaId: 'p1',
    tipo: TipoProcesso.AQUISICAO_ARMA_SINARM,
    numero: '001',
    status: StatusProcesso.ABERTO,
    dataAbertura: new Date('2026-01-10T00:00:00.000Z'),
    dataPrazo: undefined,
    descricao: '',
    observacoes: '',
    documentos: [],
    dataCadastro: new Date('2026-01-10T00:00:00.000Z'),
    dataAtualizacao: new Date('2026-01-10T00:00:00.000Z'),
  },
  {
    id: 'proc-vencido',
    pessoaId: 'p2',
    tipo: TipoProcesso.CRAF_CR,
    numero: '002',
    status: StatusProcesso.ABERTO,
    dataAbertura: new Date('2026-01-11T00:00:00.000Z'),
    dataPrazo: ontem,
    descricao: '',
    observacoes: '',
    documentos: [],
    dataCadastro: new Date('2026-01-11T00:00:00.000Z'),
    dataAtualizacao: new Date('2026-01-11T00:00:00.000Z'),
  },
  {
    id: 'proc-hoje',
    pessoaId: 'p3',
    tipo: TipoProcesso.CRAF_CR,
    numero: '003',
    status: StatusProcesso.FINALIZADO,
    dataAbertura: new Date('2026-01-12T00:00:00.000Z'),
    dataPrazo: hoje,
    descricao: '',
    observacoes: '',
    documentos: [],
    dataCadastro: new Date('2026-01-12T00:00:00.000Z'),
    dataAtualizacao: new Date('2026-01-12T00:00:00.000Z'),
  },
]

const pessoasMock = [
  { id: 'p1', nome: 'Ana Lima', cpf: '111.111.111-11', telefone: '', dataCadastro: hoje, dataAtualizacao: hoje, ativo: true },
  { id: 'p2', nome: 'Bruno Silva', cpf: '222.222.222-22', telefone: '', dataCadastro: hoje, dataAtualizacao: hoje, ativo: true },
  { id: 'p3', nome: 'Carla Souza', cpf: '333.333.333-33', telefone: '', dataCadastro: hoje, dataAtualizacao: hoje, ativo: true },
]

vi.mock('../stores/processosStore', () => ({
  useProcessosStore: () => ({
    processos: processosMock,
    carregarProcessos: mockCarregarProcessos,
    adicionarProcesso: mockAdicionarProcesso,
    atualizarProcesso: mockAtualizarProcesso,
    deletarProcesso: mockDeletarProcesso,
    erro: null,
  }),
}))

vi.mock('../stores/pessoasStore', () => ({
  usePessoasStore: () => ({
    pessoas: pessoasMock,
    carregarPessoas: mockCarregarPessoas,
    adicionarPessoa: mockAdicionarPessoa,
  }),
}))

describe('Processos filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('filtra por tipo e por vencimento, excluindo sem prazo quando filtro de data esta ativo', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    expect(screen.getByText('3 processo(s)')).toBeTruthy()

    const combos = screen.getAllByRole('combobox')
    await user.selectOptions(combos[1], TipoProcesso.CRAF_CR)
    expect(screen.getByText('2 processo(s)')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Vencidos' }))
    expect(screen.getByText('1 processo(s)')).toBeTruthy()

    await user.selectOptions(combos[1], 'todos')
    expect(screen.getByText('1 processo(s)')).toBeTruthy()
  })
})
