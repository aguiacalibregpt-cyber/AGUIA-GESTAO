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
  carregarPessoas: () => Promise<void>
  adicionarPessoa: (pessoaData: Omit<Pessoa, 'id' | 'dataCadastro' | 'dataAtualizacao'>) => Promise<Pessoa>
  atualizarPessoa: (id: string, atualizacoes: Partial<Pessoa>) => Promise<void>
  deletarPessoa: (id: string) => Promise<void>
  buscarPessoa: (id: string) => Promise<Pessoa | undefined>
  buscarPorCPF: (cpf: string) => Promise<Pessoa | undefined>
}

type PessoaPersistida = Omit<Pessoa, 'dataCadastro' | 'dataAtualizacao'> & {
  dataCadastro: string
  dataAtualizacao: string
}

const parsePessoa = (p: PessoaPersistida): Pessoa => ({
  ...p,
  dataCadastro: new Date(p.dataCadastro),
  dataAtualizacao: new Date(p.dataAtualizacao),
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

  carregarPessoas: async () => {
    set({ carregando: true, erro: null })
    try {
      const pessoasBrutas = (await api.get<PessoaPersistida[]>('/pessoas')).map(parsePessoa)
      const pessoas = await Promise.all(
        pessoasBrutas.map(async (pessoa) => {
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
        }),
      )
      pessoas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      set({ pessoas })
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

  buscarPessoa: async (id) => {
    try {
      const pessoa = get().pessoas.find((p) => p.id === id)
      if (!pessoa?.senhaGov) return pessoa
      if (!senhaGovEstaCriptografada(pessoa.senhaGov)) return pessoa
      try {
        const senhaTextoPlano = await descriptografarSenhaGov(pessoa.senhaGov, pessoa.cpf)
        return { ...pessoa, senhaGov: senhaTextoPlano }
      } catch {
        registrarAcessoSenhaGov('falha_descriptografia', { pessoaId: pessoa.id })
        return { ...pessoa, senhaGov: undefined }
      }
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao buscar pessoa') })
      throw error
    }
  },

  buscarPorCPF: async (cpf) => {
    try {
      const resultado = get().pessoas.find((p) => normalizarCPF(p.cpf) === normalizarCPF(cpf))
      if (!resultado?.senhaGov) return resultado
      if (!senhaGovEstaCriptografada(resultado.senhaGov)) return resultado
      try {
        const senhaTextoPlano = await descriptografarSenhaGov(resultado.senhaGov, resultado.cpf)
        return { ...resultado, senhaGov: senhaTextoPlano }
      } catch {
        registrarAcessoSenhaGov('falha_descriptografia', { pessoaId: resultado.id })
        return { ...resultado, senhaGov: undefined }
      }
    } catch (error) {
      set({ erro: obterMensagemErro(error, 'Erro ao buscar pessoa por CPF') })
      throw error
    }
  },
}))
