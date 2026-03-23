import React, { useState, useEffect } from 'react'
import type { Pessoa } from '../types/models'
import { usePessoasStore } from '../stores/pessoasStore'
import { Input, Button, Alert, ConfirmDialog } from '../components'
import { formatarCPF, formatarTelefone } from '../utils/constants'
import { obterMensagemErro } from '../utils/robustness'
import { validarPessoaFormulario } from '../utils/validation'
import { Plus, Edit2, Trash2, X, FilePlus2, Search, Users, ChevronUp, Eye, EyeOff } from 'lucide-react'

interface PessoasProps {
  onNovoProcesso?: (pessoaId: string) => void
}

const FORM_INICIAL = { nome: '', cpf: '', senhaGov: '', telefone: '', email: '', endereco: '', ativo: true }

export const Pessoas: React.FC<PessoasProps> = ({ onNovoProcesso }) => {
  const { pessoas, carregarPessoas, adicionarPessoa, atualizarPessoa, deletarPessoa, erro } = usePessoasStore()
  const [mostraModal, setMostraModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [formErros, setFormErros] = useState<Partial<Record<'nome' | 'cpf' | 'telefone' | 'email', string>>>({})
  const [pessoaParaExcluir, setPessoaParaExcluir] = useState<{ id: string; nome: string } | null>(null)
  const [formData, setFormData] = useState(FORM_INICIAL)
  const [mostrarTopoBtn, setMostrarTopoBtn] = useState(false)
  const [mostraSenha, setMostraSenha] = useState(false)

  useEffect(() => { void carregarPessoas() }, [])
  useEffect(() => {
    const fn = () => setMostrarTopoBtn(window.scrollY > 300)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const pessoasFiltradas = pessoas.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf.includes(busca.replace(/\D/g, '')),
  )

  const abrirModalNovo = () => {
    setFormData(FORM_INICIAL)
    setEditandoId(null)
    setFormErros({})
    setMostraSenha(false)
    setMostraModal(true)
  }

  const abrirModalEditar = (pessoa: Pessoa) => {
    setFormData({
      nome: pessoa.nome,
      cpf: pessoa.cpf,
      senhaGov: pessoa.senhaGov || '',
      telefone: pessoa.telefone || '',
      email: pessoa.email || '',
      endereco: pessoa.endereco || '',
      ativo: pessoa.ativo,
    })
    setEditandoId(pessoa.id)
    setFormErros({})
    setMostraSenha(false)
    setMostraModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros = validarPessoaFormulario(formData)
    if (Object.keys(erros).length > 0) {
      setFormErros(erros)
      return
    }
    try {
      if (editandoId) {
        await atualizarPessoa(editandoId, formData)
        setMensagem({ tipo: 'success', texto: 'Pessoa atualizada com sucesso!' })
        setMostraModal(false)
      } else {
        const novaPessoa = await adicionarPessoa(formData)
        if (onNovoProcesso) {
          onNovoProcesso(novaPessoa.id)
        } else {
          setMensagem({ tipo: 'success', texto: 'Pessoa cadastrada com sucesso!' })
          setMostraModal(false)
        }
      }
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar pessoa') })
    }
  }

  const confirmarExclusao = async () => {
    if (!pessoaParaExcluir) return
    try {
      await deletarPessoa(pessoaParaExcluir.id)
      setMensagem({ tipo: 'success', texto: 'Pessoa excluída com sucesso!' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao excluir pessoa') })
    } finally {
      setPessoaParaExcluir(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black rounded-xl shadow-lg p-8 text-white border border-red-900/70">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="bg-red-900/50 rounded-lg p-3 border border-red-800/70">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Pessoas</h1>
              <p className="text-red-200 mt-1">{pessoas.length} pessoa(s) cadastrada(s)</p>
            </div>
          </div>
          <Button onClick={abrirModalNovo} className="bg-white/10 border border-white/20 hover:bg-white/20 text-white">
            <Plus className="w-5 h-5" />
            Nova Pessoa
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {mensagem && <Alert type={mensagem.tipo} message={mensagem.texto} onClose={() => setMensagem(null)} />}
      {erro && <Alert type="error" message={erro} />}

      {/* Busca */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        {busca && (
          <p className="text-xs text-gray-500 mt-2">{pessoasFiltradas.length} resultado(s)</p>
        )}
      </div>

      {/* Lista */}
      {pessoasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">{busca ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada'}</p>
          {!busca && (
            <Button onClick={abrirModalNovo} className="mt-4">
              <Plus className="w-4 h-4" />
              Cadastrar primeira pessoa
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left font-semibold text-gray-700 px-4 py-3">Nome</th>
                <th className="text-left font-semibold text-gray-700 px-4 py-3">CPF</th>
                <th className="text-left font-semibold text-gray-700 px-4 py-3">Telefone</th>
                <th className="text-right font-semibold text-gray-700 px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pessoasFiltradas.map((pessoa) => (
                <tr key={pessoa.id} className="border-b last:border-b-0 border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium">{pessoa.nome}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{pessoa.cpf}</td>
                  <td className="px-4 py-3 text-gray-600">{pessoa.telefone || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {onNovoProcesso && (
                        <button
                          onClick={() => onNovoProcesso(pessoa.id)}
                          title="Novo processo para esta pessoa"
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <FilePlus2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => abrirModalEditar(pessoa)}
                        title="Editar"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPessoaParaExcluir({ id: pessoa.id, nome: pessoa.nome })}
                        title="Excluir"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal cadastro/edição */}
      {mostraModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setMostraModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editandoId ? 'Editar Pessoa' : 'Nova Pessoa'}
              </h2>
              <button onClick={() => setMostraModal(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="👤 Nome Completo *"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo"
                error={formErros.nome}
                autoFocus
              />
              <Input
                label="📋 CPF *"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
                error={formErros.cpf}
              />
              <Input
                label="📞 Telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
                error={formErros.telefone}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔐 Senha Gov</label>
                <div className="relative flex items-center">
                  <input
                    type={mostraSenha ? 'text' : 'password'}
                    value={formData.senhaGov}
                    onChange={(e) => setFormData({ ...formData, senhaGov: e.target.value })}
                    placeholder="Deixe em branco se não tiver"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
                      bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setMostraSenha(!mostraSenha)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600"
                    title={mostraSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostraSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Armazenada criptografada com AES-GCM</p>
              </div>
              <Input
                label="✉️ Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="exemplo@email.com"
                error={formErros.email}
              />
              <Input
                label="📍 Endereço"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade"
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setMostraModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editandoId ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pessoaParaExcluir !== null}
        title="Excluir Pessoa"
        message={`Deseja excluir "${pessoaParaExcluir?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        danger
        onConfirm={confirmarExclusao}
        onCancel={() => setPessoaParaExcluir(null)}
      />

      {mostrarTopoBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 bg-red-700 text-white rounded-full p-3 shadow-lg hover:bg-red-800 transition"
          title="Voltar ao topo"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
