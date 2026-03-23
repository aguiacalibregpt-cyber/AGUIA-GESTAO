import { create } from 'zustand'
import type { DocumentoProcesso, StatusDocumento } from '../types/models'
import { api } from '../lib/api'
import { gerarId, obterMensagemErro } from '../utils/robustness'

interface DocumentosStore {
  documentosProcesso: DocumentoProcesso[]
  carregando: boolean
  erro: string | null
  carregarDocumentosPorProcesso: (processoId: string) => Promise<void>
  adicionarDocumentoProcesso: (doc: Omit<DocumentoProcesso, 'id'>) => Promise<DocumentoProcesso>
  atualizarDocumentoProcesso: (id: string, atualizacoes: Partial<DocumentoProcesso>) => Promise<void>
  atualizarStatusDocumento: (id: string, novoStatus: StatusDocumento) => Promise<void>
  deletarDocumentoProcesso: (id: string) => Promise<void>
  buscarDocumentoProcesso: (id: string) => Promise<DocumentoProcesso | undefined>
}

type DocumentoPersistido = Omit<DocumentoProcesso, 'dataEntrega'> & {
  dataEntrega?: string
}

const parseDocumento = (d: DocumentoPersistido): DocumentoProcesso => ({
  ...d,
  dataEntrega: d.dataEntrega ? new Date(d.dataEntrega) : undefined,
})

const serializarAtualizacao = (u: Partial<DocumentoProcesso>) => ({
  ...u,
  dataEntrega: u.dataEntrega ? u.dataEntrega.toISOString() : undefined,
})

export const useDocumentosStore = create<DocumentosStore>((set, get) => ({
  documentosProcesso: [],
  carregando: false,
  erro: null,

  carregarDocumentosPorProcesso: async (processoId) => {
    set({ carregando: true, erro: null })
    try {
      const documentos = (await api.get<DocumentoPersistido[]>(`/documentos-processo?processoId=${encodeURIComponent(processoId)}`)).map(parseDocumento)
      documentos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      set({ documentosProcesso: documentos })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao carregar documentos') })
    } finally {
      set({ carregando: false })
    }
  },

  adicionarDocumentoProcesso: async (docData) => {
    set({ erro: null })
    try {
      const novoDoc: DocumentoProcesso = { ...docData, id: gerarId('doc') }
      await api.post('/documentos-processo', {
        ...novoDoc,
        dataEntrega: novoDoc.dataEntrega ? novoDoc.dataEntrega.toISOString() : undefined,
      })
      set({ documentosProcesso: [...get().documentosProcesso, novoDoc] })
      return novoDoc
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao adicionar documento') })
      throw error
    }
  },

  atualizarDocumentoProcesso: async (id, atualizacoes) => {
    set({ erro: null })
    try {
      const docAtual = get().documentosProcesso.find((d) => d.id === id)
      if (!docAtual) throw new Error('Documento não encontrado')
      await api.put(`/documentos-processo/${id}`, serializarAtualizacao(atualizacoes))
      set({
        documentosProcesso: get().documentosProcesso.map((d) =>
          d.id === id ? { ...d, ...atualizacoes } : d,
        ),
      })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao atualizar documento') })
      throw error
    }
  },

  atualizarStatusDocumento: async (id, novoStatus) => {
    await get().atualizarDocumentoProcesso(id, {
      status: novoStatus,
      dataEntrega: novoStatus === 'ENTREGUE' ? new Date() : undefined,
    })
  },

  deletarDocumentoProcesso: async (id) => {
    set({ erro: null })
    try {
      await api.del(`/documentos-processo/${id}`)
      set({ documentosProcesso: get().documentosProcesso.filter((d) => d.id !== id) })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao deletar documento') })
      throw error
    }
  },

  buscarDocumentoProcesso: async (id) => {
    try {
      return get().documentosProcesso.find((d) => d.id === id)
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao buscar documento') })
      throw error
    }
  },
}))
