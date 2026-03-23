import { create } from 'zustand'
import type { Processo, StatusProcesso, TipoProcesso } from '../types/models'
import { api } from '../lib/api'
import { gerarId, obterMensagemErro } from '../utils/robustness'

interface ProcessosStore {
  processos: Processo[]
  carregando: boolean
  erro: string | null
  carregarProcessos: () => Promise<void>
  carregarProcessosPorPessoa: (pessoaId: string) => Promise<void>
  adicionarProcesso: (
    processo: Omit<Processo, 'id' | 'dataCadastro' | 'dataAtualizacao' | 'documentos'>,
  ) => Promise<Processo>
  atualizarProcesso: (id: string, atualizacoes: Partial<Processo>) => Promise<void>
  atualizarStatusProcesso: (id: string, novoStatus: StatusProcesso) => Promise<void>
  deletarProcesso: (id: string) => Promise<void>
  buscarProcesso: (id: string) => Promise<Processo | undefined>
  filtrarProcessos: (filtro: { pessoaId?: string; tipo?: TipoProcesso; status?: StatusProcesso }) => void
  limparFiltros: () => void
}

type ProcessoPersistido = Omit<Processo, 'dataCadastro' | 'dataAtualizacao' | 'dataAbertura' | 'dataPrazo' | 'dataFechamento' | 'dataRestituido' | 'dataUltimaConsulta'> & {
  dataCadastro: string
  dataAtualizacao: string
  dataAbertura: string
  dataPrazo?: string
  dataFechamento?: string
  dataRestituido?: string
  dataUltimaConsulta?: string
}

const parseProcesso = (p: ProcessoPersistido): Processo => ({
  ...p,
  dataCadastro: new Date(p.dataCadastro),
  dataAtualizacao: new Date(p.dataAtualizacao),
  dataAbertura: new Date(p.dataAbertura),
  dataPrazo: p.dataPrazo ? new Date(p.dataPrazo) : undefined,
  dataFechamento: p.dataFechamento ? new Date(p.dataFechamento) : undefined,
  dataRestituido: p.dataRestituido ? new Date(p.dataRestituido) : undefined,
  dataUltimaConsulta: p.dataUltimaConsulta ? new Date(p.dataUltimaConsulta) : undefined,
})

const toIso = (d?: Date) => (d ? d.toISOString() : undefined)

const serializarProcesso = (p: Processo): ProcessoPersistido => ({
  ...p,
  dataCadastro: p.dataCadastro.toISOString(),
  dataAtualizacao: p.dataAtualizacao.toISOString(),
  dataAbertura: p.dataAbertura.toISOString(),
  dataPrazo: toIso(p.dataPrazo),
  dataFechamento: toIso(p.dataFechamento),
  dataRestituido: toIso(p.dataRestituido),
  dataUltimaConsulta: toIso(p.dataUltimaConsulta),
})

const serializarAtualizacao = (u: Partial<Processo>) => ({
  ...u,
  dataAbertura: u.dataAbertura ? u.dataAbertura.toISOString() : undefined,
  dataPrazo: toIso(u.dataPrazo),
  dataFechamento: toIso(u.dataFechamento),
  dataRestituido: toIso(u.dataRestituido),
  dataUltimaConsulta: toIso(u.dataUltimaConsulta),
  dataCadastro: u.dataCadastro ? u.dataCadastro.toISOString() : undefined,
  dataAtualizacao: u.dataAtualizacao ? u.dataAtualizacao.toISOString() : undefined,
})

export const useProcessosStore = create<ProcessosStore>((set, get) => ({
  processos: [],
  carregando: false,
  erro: null,

  carregarProcessos: async () => {
    set({ carregando: true, erro: null })
    try {
      const processos = (await api.get<ProcessoPersistido[]>('/processos')).map(parseProcesso)
      processos.sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime())
      set({ processos })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao carregar processos') })
    } finally {
      set({ carregando: false })
    }
  },

  carregarProcessosPorPessoa: async (pessoaId) => {
    set({ carregando: true, erro: null })
    try {
      const processos = (await api.get<ProcessoPersistido[]>(`/processos?pessoaId=${encodeURIComponent(pessoaId)}`)).map(parseProcesso)
      processos.sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime())
      set({ processos })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao carregar processos') })
    } finally {
      set({ carregando: false })
    }
  },

  adicionarProcesso: async (processoData) => {
    set({ erro: null })
    try {
      const novoProcesso: Processo = {
        ...processoData,
        id: gerarId('processo'),
        documentos: [],
        dataCadastro: new Date(),
        dataAtualizacao: new Date(),
      }
      await api.post('/processos', serializarProcesso(novoProcesso))
      set({ processos: [novoProcesso, ...get().processos] })
      return novoProcesso
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao adicionar processo') })
      throw error
    }
  },

  atualizarProcesso: async (id, atualizacoes) => {
    set({ erro: null })
    try {
      const processoAtual = get().processos.find((p) => p.id === id)
      if (!processoAtual) throw new Error('Processo não encontrado')
      const dataAtualizacao = new Date()
      await api.put(`/processos/${id}`, {
        ...serializarAtualizacao(atualizacoes),
        dataAtualizacao: dataAtualizacao.toISOString(),
      })
      set({
        processos: get().processos.map((p) =>
          p.id === id ? { ...p, ...atualizacoes, dataAtualizacao } : p,
        ),
      })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao atualizar processo') })
      throw error
    }
  },

  atualizarStatusProcesso: async (id, novoStatus) => {
    const atualizacoes: Partial<Processo> = { status: novoStatus }
    if (novoStatus === 'RESTITUIDO') {
      atualizacoes.dataRestituido = new Date()
    }
    await get().atualizarProcesso(id, atualizacoes)
  },

  deletarProcesso: async (id) => {
    set({ erro: null })
    try {
      await api.del(`/processos/${id}`)
      set({ processos: get().processos.filter((p) => p.id !== id) })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao deletar processo') })
      throw error
    }
  },

  buscarProcesso: async (id) => {
    try {
      return get().processos.find((p) => p.id === id)
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao buscar processo') })
      throw error
    }
  },

  filtrarProcessos: (filtro) => {
    void filtro
  },

  limparFiltros: () => {
    // implementado em nível de componente
  },
}))
