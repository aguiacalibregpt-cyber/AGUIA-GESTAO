import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusProcesso, TipoProcesso, type Processo } from '../types/models'
import { useProcessosStore } from './processosStore'

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
  },
}))

import { api } from '../lib/api'

const apiMock = vi.mocked(api)

const processoBase = (id: string, dataCadastroIso: string): Processo => ({
  id,
  pessoaId: 'pessoa-1',
  tipo: TipoProcesso.REGISTRO_SINARM,
  numero: `PROC-${id}`,
  status: StatusProcesso.ABERTO,
  dataAbertura: new Date('2026-01-10T00:00:00.000Z'),
  dataPrazo: new Date('2026-01-20T00:00:00.000Z'),
  dataFechamento: undefined,
  dataRestituido: undefined,
  dataUltimaConsulta: undefined,
  descricao: 'desc',
  observacoes: 'obs',
  documentos: [],
  dataCadastro: new Date(dataCadastroIso),
  dataAtualizacao: new Date(dataCadastroIso),
})

describe('stores/processosStore', () => {
  beforeEach(() => {
    useProcessosStore.setState({ processos: [], carregando: false, erro: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('carrega e ordena processos por dataCadastro desc', async () => {
    const antigo = processoBase('1', '2026-01-01T00:00:00.000Z')
    const novo = processoBase('2', '2026-02-01T00:00:00.000Z')
    apiMock.get.mockResolvedValueOnce([
      {
        ...antigo,
        dataCadastro: antigo.dataCadastro.toISOString(),
        dataAtualizacao: antigo.dataAtualizacao.toISOString(),
        dataAbertura: antigo.dataAbertura.toISOString(),
        dataPrazo: antigo.dataPrazo?.toISOString(),
      },
      {
        ...novo,
        dataCadastro: novo.dataCadastro.toISOString(),
        dataAtualizacao: novo.dataAtualizacao.toISOString(),
        dataAbertura: novo.dataAbertura.toISOString(),
        dataPrazo: novo.dataPrazo?.toISOString(),
      },
    ])

    await useProcessosStore.getState().carregarProcessos()

    const processos = useProcessosStore.getState().processos
    expect(processos).toHaveLength(2)
    expect(processos[0].id).toBe('2')
    expect(processos[1].id).toBe('1')
    expect(processos[0].dataCadastro).toBeInstanceOf(Date)
    expect(apiMock.get).toHaveBeenCalledWith('/processos')
  })

  it('atualiza status para RESTITUIDO preenchendo dataRestituido', async () => {
    const proc = processoBase('10', '2026-01-01T00:00:00.000Z')
    useProcessosStore.setState({ processos: [proc], carregando: false, erro: null })
    apiMock.put.mockResolvedValueOnce({})

    await useProcessosStore.getState().atualizarStatusProcesso('10', StatusProcesso.RESTITUIDO)

    const atualizado = useProcessosStore.getState().processos.find((p) => p.id === '10')
    expect(atualizado?.status).toBe(StatusProcesso.RESTITUIDO)
    expect(atualizado?.dataRestituido).toBeInstanceOf(Date)
    expect(apiMock.put).toHaveBeenCalledTimes(1)
    expect(apiMock.put.mock.calls[0][0]).toBe('/processos/10')
  })

  it('retorna erro ao atualizar processo inexistente', async () => {
    await expect(useProcessosStore.getState().atualizarProcesso('nao-existe', { numero: '1234' }))
      .rejects
      .toThrow('Processo não encontrado')

    expect(useProcessosStore.getState().erro).toBe('Processo não encontrado')
  })
})
