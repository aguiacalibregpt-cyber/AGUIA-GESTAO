import { create } from 'zustand'
import type { Pessoa } from '../types/models'
import { api } from '../lib/api'
import { gerarId, normalizarCPF, obterMensagemErro } from '../utils/robustness'
import {
  criptografarSenhaGov,
  descriptografarSenhaGov,
  senhaGovEstaCriptografada,
  senhaGovUsaEsquemaLegado,
  registrarAcessoSenhaGov,
} from '../lib/crypto'

interface PessoasStore {
  pessoas: Pessoa[]
  carregando: boolean
  erro: string | null
  avisos: string[]
  carregarPessoas: () => Promise<void>
  adicionarPessoa: (pessoaData: Omit<Pessoa, 'id' | 'dataCadastro' | 'dataAtualizacao'>) => Promise<Pessoa>
  atualizarPessoa: (id: string, atualizacoes: Partial<Pessoa>) => Promise<void>
  deletarPessoa: (id: string) => Promise<void>
}

type PessoaPersistida = Omit<Pessoa, 'dataCadastro' | 'dataAtualizacao'> & {
  dataCadastro: string
  dataAtualizacao: string
}

const parseDateSafe = (v: string): Date => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const parsePessoa = (p: PessoaPersistida): Pessoa => ({
  ...p,
  dataCadastro: parseDateSafe(p.dataCadastro),
  dataAtualizacao: parseDateSafe(p.dataAtualizacao),
})

const serializarPessoa = (p: Pessoa): PessoaPersistida => ({
  ...p,
  dataCadastro: p.dataCadastro.toISOString(),
  dataAtualizacao: p.dataAtualizacao.toISOString(),
})

export const usePessoasStore = create<PessoasStore>((set, get) => ({
  pessoas: [],
  carregando: false,
  erro: null,
  avisos: [],

  carregarPessoas: async () => {
    if (get().carregando) return
    set({ carregando: true, erro: null })
    try {
      const pessoasBrutas = ((await api.get<PessoaPersistida[]>('/pessoas')) ?? []).map(parsePessoa)
      const falhasDescriptografia: string[] = []

      // Processa em lotes de 5 para evitar disparar centenas de PUTs simultâneos
      // (migração de senha legada) e atingir o rate limit do servidor.
      const LOTE = 5
      const pessoas: Pessoa[] = []
      for (let i = 0; i < pessoasBrutas.length; i += LOTE) {
        const lote = pessoasBrutas.slice(i, i + LOTE)
        const resultados = await Promise.all(
          lote.map(async (pessoa) => {
            try {
              if (!pessoa.senhaGov) return pessoa
              if (senhaGovEstaCriptografada(pessoa.senhaGov)) {
                try {
                  const senhaTextoPlano = await descriptografarSenhaGov(pessoa.senhaGov, pessoa.cpf)
                  if (senhaGovUsaEsquemaLegado(pessoa.senhaGov)) {
                    const senhaMigrada = await criptografarSenhaGov(senhaTextoPlano, pessoa.cpf)
                    if (senhaMigrada) {
                      await api.put(`/pessoas/${pessoa.id}`, {
                        senhaGov: senhaMigrada,
                        dataAtualizacao: new Date().toISOString(),
                      })
                    }
                  }
                  return { ...pessoa, senhaGov: senhaTextoPlano }
                } catch {
                  registrarAcessoSenhaGov('falha_descriptografia', { pessoaId: pessoa.id })
                  falhasDescriptografia.push(pessoa.nome)
                  return { ...pessoa, senhaGov: undefined }
                }
              }

              const senhaLegada = pessoa.senhaGov.trim()
              if (!senhaLegada) return { ...pessoa, senhaGov: undefined }
              const senhaCriptografada = await criptografarSenhaGov(senhaLegada, pessoa.cpf)
              if (senhaCriptografada) {
                await api.put(`/pessoas/${pessoa.id}`, {
                  senhaGov: senhaCriptografada,
                  dataAtualizacao: new Date().toISOString(),
                })
              }
              return { ...pessoa, senhaGov: senhaLegada }
            } catch {
              registrarAcessoSenhaGov('falha_descriptografia', { pessoaId: pessoa.id })
              falhasDescriptografia.push(pessoa.nome)
              return { ...pessoa, senhaGov: undefined }
            }
          }),
        )
        pessoas.push(...resultados)
      }
      pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      set({ pessoas, avisos: falhasDescriptografia.length > 0
        ? [`Falha ao descriptografar senha de: ${falhasDescriptografia.join(', ')}`]
        : [] })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao carregar pessoas') })
    } finally {
      set({ carregando: false })
    }
  },

  adicionarPessoa: async (pessoaData) => {
    set({ erro: null })
    try {
      const cpfNormalizado = normalizarCPF(pessoaData.cpf)
      const pessoaDuplicada = get().pessoas.find((p) => normalizarCPF(p.cpf) === cpfNormalizado)
      if (pessoaDuplicada) throw new Error('Já existe uma pessoa cadastrada com este CPF')

      const senhaTextoPlano = pessoaData.senhaGov?.trim()
      const senhaCriptografada = await criptografarSenhaGov(senhaTextoPlano, pessoaData.cpf)

      const novaPessoa: Pessoa = {
        ...pessoaData,
        senhaGov: senhaTextoPlano || undefined,
        id: gerarId('pessoa'),
        dataCadastro: new Date(),
        dataAtualizacao: new Date(),
      }

      await api.post('/pessoas', serializarPessoa({ ...novaPessoa, senhaGov: senhaCriptografada }))

      set({ pessoas: [...get().pessoas, novaPessoa].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) })
      return novaPessoa
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao adicionar pessoa') })
      throw error
    }
  },

  atualizarPessoa: async (id, atualizacoes) => {
    set({ erro: null })
    try {
      const pessoaAtual = get().pessoas.find((p) => p.id === id)
      if (!pessoaAtual) throw new Error('Pessoa não encontrada')

      if (atualizacoes.cpf) {
        const cpfNormalizado = normalizarCPF(atualizacoes.cpf)
        const dup = get().pessoas.find((p) => p.id !== id && normalizarCPF(p.cpf) === cpfNormalizado)
        if (dup) throw new Error('Já existe outra pessoa cadastrada com este CPF')
      }

      const cpfAtualizado = atualizacoes.cpf ?? pessoaAtual.cpf
      const atualizacoesPersistencia: Partial<Pessoa> = { ...atualizacoes }
      const atualizacoesEstado: Partial<Pessoa> = { ...atualizacoes }

      if (Object.prototype.hasOwnProperty.call(atualizacoes, 'senhaGov')) {
        const senhaTextoPlano = atualizacoes.senhaGov?.trim()
        atualizacoesPersistencia.senhaGov = await criptografarSenhaGov(senhaTextoPlano, cpfAtualizado)
        atualizacoesEstado.senhaGov = senhaTextoPlano || undefined
      } else if (atualizacoes.cpf && pessoaAtual.senhaGov) {
        try {
          const senhaAtualTextoPlano = senhaGovEstaCriptografada(pessoaAtual.senhaGov)
            ? await descriptografarSenhaGov(pessoaAtual.senhaGov, pessoaAtual.cpf)
            : pessoaAtual.senhaGov
          atualizacoesPersistencia.senhaGov = await criptografarSenhaGov(senhaAtualTextoPlano, cpfAtualizado)
        } catch {
          registrarAcessoSenhaGov('falha_descriptografia', { pessoaId: pessoaAtual.id })
        }
      }

      const dataAtualizacao = new Date()
      await api.put(`/pessoas/${id}`, {
        ...atualizacoesPersistencia,
        dataAtualizacao: dataAtualizacao.toISOString(),
      })

      set({
        pessoas: get().pessoas.map((p) => (p.id === id ? { ...p, ...atualizacoesEstado, dataAtualizacao } : p)),
      })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao atualizar pessoa') })
      throw error
    }
  },

  deletarPessoa: async (id) => {
    set({ erro: null })
    try {
      await api.del(`/pessoas/${id}`)
      set({ pessoas: get().pessoas.filter((p) => p.id !== id) })
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao deletar pessoa') })
      throw error
    }
  },
}))
