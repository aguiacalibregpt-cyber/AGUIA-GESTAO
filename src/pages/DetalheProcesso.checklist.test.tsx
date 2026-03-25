import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DetalheProcesso } from './DetalheProcesso'
import { StatusDocumento, StatusProcesso, TipoProcesso } from '../types/models'

const processoId = 'proc-1'
const pessoaId = 'pessoa-1'

const h = vi.hoisted(() => {
  let documentosProcessoState: Array<{
    id: string
    processoId: string
    documentoId: string
    nome: string
    status: string
    dataEntrega?: Date
    observacoes?: string
  }> = []

  const mockCarregarProcessos = vi.fn(async () => {})
  const mockAtualizarStatusProcesso = vi.fn(async () => {})
  const mockCarregarPessoas = vi.fn(async () => {})
  const mockCarregarDocumentosPorProcesso = vi.fn(async () => {})
  const mockAdicionarDocumentoProcesso = vi.fn(async (doc) => {
    const novo = { ...doc, id: `novo-${documentosProcessoState.length + 1}` }
    documentosProcessoState = [...documentosProcessoState, novo]
    return novo
  })
  const mockAtualizarDocumentoProcesso = vi.fn(async (id: string, atualizacoes: Record<string, unknown>) => {
    documentosProcessoState = documentosProcessoState.map((d) => (d.id === id ? { ...d, ...atualizacoes } : d))
  })
  const mockAtualizarStatusDocumento = vi.fn(async () => {})
  const mockDeletarDocumentoProcesso = vi.fn(async (id: string) => {
    documentosProcessoState = documentosProcessoState.filter((d) => d.id !== id)
  })

  const mockUseDocumentosStore = Object.assign(
    () => ({
      get documentosProcesso() {
        return documentosProcessoState
      },
      carregando: false,
      carregarDocumentosPorProcesso: mockCarregarDocumentosPorProcesso,
      adicionarDocumentoProcesso: mockAdicionarDocumentoProcesso,
      atualizarDocumentoProcesso: mockAtualizarDocumentoProcesso,
      atualizarStatusDocumento: mockAtualizarStatusDocumento,
      deletarDocumentoProcesso: mockDeletarDocumentoProcesso,
    }),
    {
      getState: () => ({
        documentosProcesso: documentosProcessoState,
      }),
    },
  )

  return {
    setDocumentosProcessoState: (docs: typeof documentosProcessoState) => {
      documentosProcessoState = docs
    },
    mockCarregarProcessos,
    mockAtualizarStatusProcesso,
    mockCarregarPessoas,
    mockCarregarDocumentosPorProcesso,
    mockAdicionarDocumentoProcesso,
    mockAtualizarDocumentoProcesso,
    mockAtualizarStatusDocumento,
    mockDeletarDocumentoProcesso,
    mockUseDocumentosStore,
  }
})

vi.mock('../stores/processosStore', () => ({
  useProcessosStore: () => ({
    processos: [
      {
        id: processoId,
        pessoaId,
        tipo: TipoProcesso.CRAF_CR,
        numero: '123',
        status: StatusProcesso.ABERTO,
        dataAbertura: new Date('2026-01-01T00:00:00.000Z'),
        documentos: [],
        dataCadastro: new Date('2026-01-01T00:00:00.000Z'),
        dataAtualizacao: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    atualizarStatusProcesso: h.mockAtualizarStatusProcesso,
    carregarProcessos: h.mockCarregarProcessos,
    erro: null,
  }),
}))

vi.mock('../stores/pessoasStore', () => ({
  usePessoasStore: () => ({
    pessoas: [
      {
        id: pessoaId,
        nome: 'Pessoa Teste',
        cpf: '111.111.111-11',
        telefone: '',
        dataCadastro: new Date('2026-01-01T00:00:00.000Z'),
        dataAtualizacao: new Date('2026-01-01T00:00:00.000Z'),
        ativo: true,
      },
    ],
    carregarPessoas: h.mockCarregarPessoas,
    erro: null,
  }),
}))

vi.mock('../stores/documentosStore', () => ({
  useDocumentosStore: h.mockUseDocumentosStore,
}))

describe('DetalheProcesso checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('auto-sync remove duplicados/indevidos, corrige nome canonico e adiciona faltantes', async () => {
    h.setDocumentosProcessoState([
      {
        id: 'doc-1',
        processoId,
        documentoId: 'req-documentodeidentificacaopessoal',
        nome: 'Documento de Identificação Pessoal',
        status: StatusDocumento.PENDENTE,
      },
      {
        id: 'doc-2',
        processoId,
        documentoId: 'req-autorizaraquisicaodearmadefogo',
        nome: 'Autorizar aquisicao de arma de fogo',
        status: StatusDocumento.ENTREGUE,
      },
      {
        id: 'doc-3',
        processoId,
        documentoId: 'req-autorizaraquisiçãodearmadefogo',
        nome: 'Autorizar aquisição de arma de fogo',
        status: StatusDocumento.PENDENTE,
      },
      {
        id: 'doc-4',
        processoId,
        documentoId: 'req-outrodoc',
        nome: 'Documento indevido',
        status: StatusDocumento.PENDENTE,
      },
    ])

    render(<DetalheProcesso processoId={processoId} />)

    await waitFor(() => {
      expect(h.mockDeletarDocumentoProcesso).toHaveBeenCalledWith('doc-3')
      expect(h.mockDeletarDocumentoProcesso).toHaveBeenCalledWith('doc-4')
    })

    await waitFor(() => {
      expect(h.mockAtualizarDocumentoProcesso).toHaveBeenCalledWith(
        'doc-2',
        expect.objectContaining({ nome: 'Autorizar aquisição de arma de fogo' }),
      )
      expect(h.mockAdicionarDocumentoProcesso).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Nota Fiscal' }),
      )
    })
  })

  test('renderiza checklist na ordem padrao do tipo de processo', async () => {
    h.setDocumentosProcessoState([
      {
        id: 'doc-10',
        processoId,
        documentoId: 'req-notafiscal',
        nome: 'Nota Fiscal',
        status: StatusDocumento.PENDENTE,
      },
      {
        id: 'doc-11',
        processoId,
        documentoId: 'req-documentodeidentificacaopessoal',
        nome: 'Documento de Identificação Pessoal',
        status: StatusDocumento.PENDENTE,
      },
      {
        id: 'doc-12',
        processoId,
        documentoId: 'req-autorizaraquisicaodearmadefogo',
        nome: 'Autorizar aquisição de arma de fogo',
        status: StatusDocumento.PENDENTE,
      },
    ])

    render(<DetalheProcesso processoId={processoId} />)

    const itens = await screen.findAllByRole('listitem')
    expect(within(itens[0]).getByText('Documento de Identificação Pessoal')).toBeTruthy()
    expect(within(itens[1]).getByText('Autorizar aquisição de arma de fogo')).toBeTruthy()
    expect(within(itens[2]).getByText('Nota Fiscal')).toBeTruthy()
  })
})
