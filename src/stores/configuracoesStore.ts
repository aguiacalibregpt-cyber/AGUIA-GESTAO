import { create } from 'zustand'
import type { Configuracao } from '../types/models'
import { api } from '../lib/api'
import { gerarId, obterMensagemErro } from '../utils/robustness'

interface ConfiguracoesStore {
  configuracoes: Configuracao[]
  carregando: boolean
  erro: string | null
  carregarConfiguracoes: () => Promise<void>
  obterConfiguracao: (chave: string) => Promise<string | number | boolean | object | null>
  salvarConfiguracao: (chave: string, valor: string | number | boolean | object) => Promise<void>
  deletarConfiguracao: (chave: string) => Promise<void>
}

type ConfigPersistida = Omit<Configuracao, 'dataCadastro' | 'dataAtualizacao'> & {
  dataCadastro: string
  dataAtualizacao: string
}

const parseDateSafe = (v: string): Date => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const normalizarDateValida = (d: Date | undefined, fallback: Date): Date => {
  if (!d) return fallback
  return Number.isNaN(d.getTime()) ? fallback : d
}

const parseConfig = (c: ConfigPersistida): Configuracao => ({
  ...c,
  dataCadastro: parseDateSafe(c.dataCadastro),
  dataAtualizacao: parseDateSafe(c.dataAtualizacao),
})

const ehConfiguracaoInexistente = (mensagem: string): boolean => {
  const txt = mensagem.toLowerCase()
  return txt.includes('configuração não encontrada') || txt.includes('erro http 404')
}

export const useConfiguracoesStore = create<ConfiguracoesStore>((set, get) => ({
  configuracoes: [],
  carregando: false,
  erro: null,

  carregarConfiguracoes: async () => {
    set({ carregando: true, erro: null })
    try {
      const configuracoes = (await api.get<ConfigPersistida[]>('/configuracoes')).map(parseConfig)
      configuracoes.sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'))
      set({ configuracoes })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao carregar configurações') })
    } finally {
      set({ carregando: false })
    }
  },

  obterConfiguracao: async (chave) => {
    set({ erro: null })
    try {
      const local = get().configuracoes.find((c) => c.chave === chave)
      if (local) return local.valor
      try {
        const config = parseConfig(await api.get<ConfigPersistida>(`/configuracoes/${encodeURIComponent(chave)}`))
        set({ configuracoes: [...get().configuracoes.filter((c) => c.chave !== chave), config] })
        return config.valor
      } catch (error) {
        const mensagem = obterMensagemErro(error, 'Erro ao obter configuração')
        if (ehConfiguracaoInexistente(mensagem)) return null
        throw error
      }
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao obter configuração') })
      throw error
    }
  },

  salvarConfiguracao: async (chave, valor) => {
    set({ erro: null })
    try {
      const dataAtualizacao = new Date()
      const configExistente = get().configuracoes.find((c) => c.chave === chave)
      const dataCadastroExistente = normalizarDateValida(configExistente?.dataCadastro, dataAtualizacao)
      const configSalva: Configuracao = configExistente
        ? { ...configExistente, valor, dataCadastro: dataCadastroExistente, dataAtualizacao }
        : {
            id: gerarId('config'),
            chave,
            valor,
            dataCadastro: dataAtualizacao,
            dataAtualizacao,
          }

      await api.put(`/configuracoes/${encodeURIComponent(chave)}`, {
        ...configSalva,
        dataCadastro: configSalva.dataCadastro.toISOString(),
        dataAtualizacao: configSalva.dataAtualizacao.toISOString(),
      })

      set({
        configuracoes: [
          ...get().configuracoes.filter((c) => c.chave !== chave),
          configSalva,
        ],
      })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao salvar configuração') })
      throw error
    }
  },

  deletarConfiguracao: async (chave) => {
    set({ erro: null })
    try {
      await api.del(`/configuracoes/${encodeURIComponent(chave)}`)
      set({ configuracoes: get().configuracoes.filter((c) => c.chave !== chave) })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao deletar configuração') })
      throw error
    }
  },
}))
