import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfiguracoesStore } from './configuracoesStore'

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

describe('stores/configuracoesStore', () => {
  beforeEach(() => {
    useConfiguracoesStore.setState({ configuracoes: [], carregando: false, erro: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('carrega configurações e ordena por chave', async () => {
    apiMock.get.mockResolvedValueOnce([
      {
        id: '2',
        chave: 'zeta',
        valor: 'v2',
        dataCadastro: '2026-03-01T00:00:00.000Z',
        dataAtualizacao: '2026-03-01T00:00:00.000Z',
      },
      {
        id: '1',
        chave: 'alpha',
        valor: 'v1',
        dataCadastro: '2026-03-01T00:00:00.000Z',
        dataAtualizacao: '2026-03-01T00:00:00.000Z',
      },
    ])

    await useConfiguracoesStore.getState().carregarConfiguracoes()

    const { configuracoes } = useConfiguracoesStore.getState()
    expect(configuracoes.map((c) => c.chave)).toEqual(['alpha', 'zeta'])
    expect(configuracoes[0].dataCadastro).toBeInstanceOf(Date)
  })

  it('retorna valor local sem chamar API quando configuração já existe', async () => {
    useConfiguracoesStore.setState({
      configuracoes: [
        {
          id: '1',
          chave: 'tema',
          valor: 'claro',
          dataCadastro: new Date('2026-03-01T00:00:00.000Z'),
          dataAtualizacao: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      carregando: false,
      erro: null,
    })

    const valor = await useConfiguracoesStore.getState().obterConfiguracao('tema')

    expect(valor).toBe('claro')
    expect(apiMock.get).not.toHaveBeenCalled()
  })

  it('retorna null para configuração inexistente (404)', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('Erro HTTP 404'))

    const valor = await useConfiguracoesStore.getState().obterConfiguracao('inexistente')

    expect(valor).toBeNull()
    expect(useConfiguracoesStore.getState().erro).toBeNull()
  })

  it('salva nova configuração e atualiza estado', async () => {
    apiMock.put.mockResolvedValueOnce({})

    await useConfiguracoesStore.getState().salvarConfiguracao('tema', 'escuro')

    const { configuracoes } = useConfiguracoesStore.getState()
    expect(configuracoes).toHaveLength(1)
    expect(configuracoes[0].chave).toBe('tema')
    expect(configuracoes[0].valor).toBe('escuro')
    expect(apiMock.put).toHaveBeenCalledTimes(1)
    expect(apiMock.put.mock.calls[0][0]).toBe('/configuracoes/tema')
  })

  it('deleta configuração do estado após sucesso na API', async () => {
    useConfiguracoesStore.setState({
      configuracoes: [
        {
          id: '1',
          chave: 'tema',
          valor: 'claro',
          dataCadastro: new Date('2026-03-01T00:00:00.000Z'),
          dataAtualizacao: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      carregando: false,
      erro: null,
    })
    apiMock.del.mockResolvedValueOnce(undefined)

    await useConfiguracoesStore.getState().deletarConfiguracao('tema')

    expect(useConfiguracoesStore.getState().configuracoes).toEqual([])
    expect(apiMock.del).toHaveBeenCalledWith('/configuracoes/tema')
  })

  it('salva configuração mesmo com data inválida já carregada', async () => {
    useConfiguracoesStore.setState({
      configuracoes: [
        {
          id: 'cfg-1',
          chave: 'ultimoBackup',
          valor: 'valor-antigo',
          dataCadastro: new Date('data-invalida'),
          dataAtualizacao: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      carregando: false,
      erro: null,
    })
    apiMock.put.mockResolvedValueOnce({})

    await expect(useConfiguracoesStore.getState().salvarConfiguracao('ultimoBackup', '2026-04-01T12:00:00.000Z'))
      .resolves
      .toBeUndefined()

    expect(apiMock.put).toHaveBeenCalledTimes(1)
    const payload = apiMock.put.mock.calls[0][1] as { dataCadastro: string; dataAtualizacao: string }
    expect(Number.isNaN(new Date(payload.dataCadastro).getTime())).toBe(false)
    expect(Number.isNaN(new Date(payload.dataAtualizacao).getTime())).toBe(false)
  })
})
