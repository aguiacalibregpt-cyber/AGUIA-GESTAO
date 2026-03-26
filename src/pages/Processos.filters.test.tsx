import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    pessoaId: ' p1 ',
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
  { id: 'p1', nome: 'Ana Líma', cpf: '111.111.111-11', telefone: '', dataCadastro: hoje, dataAtualizacao: hoje, ativo: true },
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

  test('filtra por nome ignorando acentos', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    const inputBusca = screen.getByPlaceholderText('Buscar por nº processo, tipo, nome ou CPF...')
    await user.type(inputBusca, 'ana lima')

    expect(screen.getByText('1 processo(s)')).toBeTruthy()
  })

  test('nao submete formulario ao pressionar Enter na busca de pessoa sem resultados', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    const buscaPessoa = screen.getByPlaceholderText('Pesquisar pessoa por nome ou CPF')
    await user.type(buscaPessoa, 'pessoa inexistente')
    await user.keyboard('{Enter}')

    expect(screen.queryByText('Selecione o tipo de processo')).toBeNull()
  })

  test('modal novo processo nao lista pessoas antes de iniciar busca', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))

    expect(screen.queryByRole('listbox', { name: 'Sugestões de pessoas' })).toBeNull()
    expect(screen.queryByText('Use a barra acima para pesquisar e clique em uma sugestão para selecionar.')).toBeNull()
    expect(screen.queryByRole('button', { name: /Bruno Silva - 222\.222\.222-22/i })).toBeNull()
  })

  test('Ctrl+Enter no modal salva quando formulario esta valido', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    const dialog = screen.getByRole('dialog', { name: 'Novo Processo' })
    expect(dialog).toBeTruthy()

    const buscaPessoa = screen.getByPlaceholderText('Pesquisar pessoa por nome ou CPF')
    await user.type(buscaPessoa, 'bruno')

    const combos = within(dialog).getAllByRole('combobox') as HTMLSelectElement[]
    const comboTipo = combos.find((combo) => Array.from(combo.options).some((op) => op.value === TipoProcesso.CRAF_CR))
    expect(comboTipo).toBeTruthy()
    await user.selectOptions(comboTipo as HTMLSelectElement, TipoProcesso.CRAF_CR)

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(mockAdicionarProcesso).toHaveBeenCalledTimes(1)
    })
  })

  test('Esc fecha o modal de novo processo', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    expect(screen.getByRole('dialog', { name: 'Novo Processo' })).toBeTruthy()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Novo Processo' })).toBeNull()
  })

  test('busca de pessoa com resultado unico auto seleciona pessoa no modal', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    const buscaPessoa = screen.getByPlaceholderText('Pesquisar pessoa por nome ou CPF')
    await user.type(buscaPessoa, 'bruno')

    const dialog = screen.getByRole('dialog', { name: 'Novo Processo' })
    const combos = within(dialog).getAllByRole('combobox') as HTMLSelectElement[]
    const comboTipo = combos.find((combo) => Array.from(combo.options).some((op) => op.value === TipoProcesso.CRAF_CR))
    expect(comboTipo).toBeTruthy()
    await user.selectOptions(comboTipo as HTMLSelectElement, TipoProcesso.CRAF_CR)

    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await waitFor(() => {
      expect(mockAdicionarProcesso).toHaveBeenCalledTimes(1)
    })
    expect(mockAdicionarProcesso).toHaveBeenCalledWith(expect.objectContaining({ pessoaId: 'p2' }))
  })

  test('Esc fecha apenas modal de Nova Pessoa e mantém Novo Processo aberto', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    expect(screen.getByRole('dialog', { name: 'Novo Processo' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Criar nova pessoa rapidamente' }))
    expect(screen.getByRole('dialog', { name: 'Nova Pessoa' })).toBeTruthy()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Nova Pessoa' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Novo Processo' })).toBeTruthy()
  })

  test('Ctrl+Enter nao salva processo enquanto modal de Nova Pessoa estiver aberto', async () => {
    const user = userEvent.setup()
    render(<Processos />)

    await user.click(screen.getByRole('button', { name: 'Novo Processo' }))
    await user.click(screen.getByRole('button', { name: 'Criar nova pessoa rapidamente' }))

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })

    expect(mockAdicionarProcesso).not.toHaveBeenCalled()
  })

})
