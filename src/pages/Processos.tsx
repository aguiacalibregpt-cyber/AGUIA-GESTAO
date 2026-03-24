import React, { useState, useEffect, useMemo } from 'react'
import type { Processo } from '../types/models'
import { TipoProcesso, StatusProcesso } from '../types/models'
import { useProcessosStore } from '../stores/processosStore'
import { usePessoasStore } from '../stores/pessoasStore'
import { Input, Button, Alert, ConfirmDialog, PageHeader, Skeleton, BackgroundSyncBadge } from '../components'
import {
  formatarData,
  obterDataHoje,
  calcularDiasRestantes,
  converterDataStringParaDate,
  nomesTipoProcesso,
  nomesStatusProcesso,
  coresStatusProcesso,
  formatarCPF,
  formatarTelefone,
} from '../utils/constants'
import { obterMensagemErro } from '../utils/robustness'
import { validarProcessoFormulario, validarPessoaFormulario } from '../utils/validation'
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  FileText,
  AlertTriangle,
  ClipboardList,
  Eye,
  EyeOff,
  Copy,
  ArrowUp,
  XCircle,
} from 'lucide-react'
import { registrarAcessoSenhaGov } from '../lib/crypto'
import { DetalheProcesso } from './DetalheProcesso'

interface ProcessosProps {
  pessoaIdInicial?: string
}

type FiltroStatus = 'todos' | StatusProcesso
type FiltroTipo = 'todos' | TipoProcesso
type FiltroVenc = 'todos' | 'vencidos' | 'hoje' | 'semana'

const ORDEM_TIPOS_PROCESSO: TipoProcesso[] = [
  TipoProcesso.CR_ATIRADOR_CACADOR,
  TipoProcesso.AQUISICAO_ARMA_CR_ATIRADOR,
  TipoProcesso.AQUISICAO_ARMA_CR_CACADOR,
  TipoProcesso.CRAF_CR,
  TipoProcesso.RENOVACAO_CRAF_CR,
  TipoProcesso.GUIA_TRAFEGO_TIRO,
  TipoProcesso.GUIA_TRAFEGO_CACA,
  TipoProcesso.GUIA_TRAFEGO_MUDANCA_ACERVO,
  TipoProcesso.GUIA_TRAFEGO_RECUPERACAO,
  TipoProcesso.AQUISICAO_ARMA_SINARM,
  TipoProcesso.REGISTRO_SINARM,
  TipoProcesso.RENOVACAO_REGISTRO_SINARM,
  TipoProcesso.GUIA_TRAFEGO_SINARM,
  TipoProcesso.TRANSFERENCIA_ARMA_CR,
]

const TIPOS_OPTIONS = ORDEM_TIPOS_PROCESSO.map((value) => ({
  value,
  label: nomesTipoProcesso[value],
}))
const STATUS_OPTIONS = Object.entries(nomesStatusProcesso).map(([value, label]) => ({ value, label }))
const FORM_INICIAL = {
  pessoaId: '',
  tipo: '' as TipoProcesso | '',
  numero: '',
  status: StatusProcesso.ABERTO,
  dataAbertura: obterDataHoje(),
  dataPrazo: '',
  descricao: '',
  observacoes: '',
}

const dataParaInput = (data?: Date): string => {
  if (!data) return ''
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return ''
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export const Processos: React.FC<ProcessosProps> = ({ pessoaIdInicial }) => {
  const { processos, carregarProcessos, adicionarProcesso, atualizarProcesso, deletarProcesso, erro, carregando: carregandoProcessos } =
    useProcessosStore()
  const { pessoas, carregarPessoas, adicionarPessoa, carregando: carregandoPessoas, erro: erroPessoas } = usePessoasStore()
  const erroConexao = Boolean(erro || erroPessoas)
  const topoRef = React.useRef<HTMLDivElement>(null)
  const [mostraModal, setMostraModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalhesId, setDetalhesId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [filtroVenc, setFiltroVenc] = useState<FiltroVenc>('todos')
  const [formData, setFormData] = useState({ ...FORM_INICIAL, pessoaId: pessoaIdInicial || '' })
  const [formErros, setFormErros] = useState<Partial<Record<string, string>>>({})
  const [processoParaExcluir, setProcessoParaExcluir] = useState<{ id: string; numero: string } | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [ultimoProcessoComCredenciais, setUltimoProcessoComCredenciais] = useState<string | null>(null)
  const [ultimoProcessoComDocumentos, setUltimoProcessoComDocumentos] = useState<string | null>(null)
  const [editandoDataPrazoId, setEditandoDataPrazoId] = useState<string | null>(null)
  const [novaDataPrazo, setNovaDataPrazo] = useState('')
  const [credenciais, setCredenciais] = useState<{
    processoid: string
    senhaGov: string | null
    cpf: string | null
    mostrarSenha: boolean
    mostraEditSenha: boolean
    senhaGovEditavel: string
    salvandoSenha: boolean
    observacoes: string
    status: StatusProcesso
    ultimaConsulta: Date | null
  } | null>(null)
  const [mostraCriarPessoa, setMostraCriarPessoa] = useState(false)
  const [mostraSenhaNovaP, setMostraSenhaNovaP] = useState(false)
  const [formDataNovaP, setFormDataNovaP] = useState({
    nome: '',
    cpf: '',
    senhaGov: '',
    telefone: '',
    email: '',
    endereco: '',
    ativo: true,
  })
  const [formErrosNovaP, setFormErrosNovaP] = useState<Partial<Record<string, string>>>({})
  const [salvandoNovaP, setSalvandoNovaP] = useState(false)
  const [salvandoProcesso, setSalvandoProcesso] = useState(false)
  const carregandoInicial = Boolean(carregandoProcessos || carregandoPessoas) && processos.length === 0
  const atualizandoEmSegundoPlano = Boolean(carregandoProcessos || carregandoPessoas) && !carregandoInicial

  useEffect(() => { void carregarProcessos() }, [carregarProcessos])
  useEffect(() => { void carregarPessoas() }, [carregarPessoas])
  useEffect(() => {
    let ativo = true
    const sincronizar = () => {
      if (!ativo) return
      if (document.hidden) return
      void carregarProcessos()
      void carregarPessoas()
    }
    const timer = window.setInterval(sincronizar, 5000)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [carregarProcessos, carregarPessoas])

  useEffect(() => {
    const aoVoltarParaAba = () => {
      if (!document.hidden) {
        void carregarProcessos()
        void carregarPessoas()
      }
    }
    document.addEventListener('visibilitychange', aoVoltarParaAba)
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAba)
  }, [carregarProcessos, carregarPessoas])

  useEffect(() => {
    if (pessoaIdInicial) {
      setFormData((f) => ({ ...f, pessoaId: pessoaIdInicial }))
      setMostraModal(true)
    }
  }, [pessoaIdInicial])

  const processadosFiltrados = useMemo(() => {
    return processos.filter((p) => {
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
      if (busca) {
        const pessoa = pessoas.find((pe) => pe.id === p.pessoaId)
        const textoBusca = busca.toLowerCase()
        const cpfNormalizado = pessoa?.cpf?.replace(/\D/g, '') || ''
        const buscaNormalizada = busca.replace(/\D/g, '')
        if (
          !p.numero.toLowerCase().includes(textoBusca) &&
          !nomesTipoProcesso[p.tipo]?.toLowerCase().includes(textoBusca) &&
          !pessoa?.nome.toLowerCase().includes(textoBusca) &&
          !cpfNormalizado.includes(buscaNormalizada)
        ) return false
      }
      if (filtroVenc !== 'todos') {
        if (!p.dataPrazo) return false
        const diff = calcularDiasRestantes(p.dataPrazo)
        if (filtroVenc === 'vencidos' && (diff === null || diff >= 0)) return false
        if (filtroVenc === 'hoje' && diff !== 0) return false
        if (filtroVenc === 'semana' && (diff === null || diff < 0 || diff > 7)) return false
      }
      return true
    }).sort((a, b) => {
      const dataA = new Date(a.dataAbertura || a.dataCadastro).getTime()
      const dataB = new Date(b.dataAbertura || b.dataCadastro).getTime()
      return dataA - dataB
    })
  }, [processos, pessoas, busca, filtroStatus, filtroTipo, filtroVenc])

  const abrirModalNovo = () => {
    setFormData({ ...FORM_INICIAL, pessoaId: pessoaIdInicial || '' })
    setEditandoId(null)
    setFormErros({})
    setMostraModal(true)
  }

  const abrirModalEditar = (processo: Processo) => {
    setFormData({
      pessoaId: processo.pessoaId,
      tipo: processo.tipo,
      numero: processo.numero,
      status: processo.status,
      dataAbertura: dataParaInput(processo.dataAbertura),
      dataPrazo: dataParaInput(processo.dataPrazo),
      descricao: processo.descricao || '',
      observacoes: processo.observacoes || '',
    })
    setEditandoId(processo.id)
    setFormErros({})
    setMostraModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvandoProcesso) return
    if (!formData.tipo) {
      setFormErros({ tipo: 'Selecione o tipo de processo' })
      return
    }
    const erros = validarProcessoFormulario(formData as typeof formData & { tipo: TipoProcesso })
    if (Object.keys(erros).length > 0) { setFormErros(erros); return }
    const payload = {
      pessoaId: formData.pessoaId,
      tipo: formData.tipo as TipoProcesso,
      numero: formData.numero,
      status: formData.status,
      dataAbertura: converterDataStringParaDate(formData.dataAbertura),
      dataPrazo: formData.dataPrazo ? converterDataStringParaDate(formData.dataPrazo) : undefined,
      descricao: formData.descricao,
      observacoes: formData.observacoes,
    }
    setSalvandoProcesso(true)
    try {
      if (editandoId) {
        await atualizarProcesso(editandoId, payload)
        setMensagem({ tipo: 'success', texto: 'Processo atualizado com sucesso!' })
        setMostraModal(false)
      } else {
        const novoProcesso = await adicionarProcesso(payload)
        setMensagem({ tipo: 'success', texto: 'Processo cadastrado com sucesso!' })
        setMostraModal(false)
        setDetalhesId(novoProcesso.id)
      }
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar processo') })
    } finally {
      setSalvandoProcesso(false)
    }
  }

  const abrirCredenciais = async (processo: Processo) => {
    const pessoa = pessoas.find((p) => p.id === processo.pessoaId)
    if (!pessoa) return
      // senhaGov já vem descriptografada pelo store durante carregarPessoas
      if (pessoa.senhaGov) {
        registrarAcessoSenhaGov('visualizacao', { pessoaId: pessoa.id, processoId: processo.id })
      }
      setUltimoProcessoComCredenciais(processo.id)
      setCredenciais({ 
        processoid: processo.id, 
        senhaGov: pessoa.senhaGov || null, 
        cpf: pessoa.cpf, 
        mostrarSenha: false,
        mostraEditSenha: false,
        senhaGovEditavel: pessoa.senhaGov || '',
        salvandoSenha: false,
        observacoes: processo.observacoes || '',
        status: processo.status,
        ultimaConsulta: processo.dataUltimaConsulta ? new Date(processo.dataUltimaConsulta) : null
      })
  }

  const copiarCredencial = async (valor: string, tipo: 'cpf' | 'senha') => {
    try {
      await navigator.clipboard.writeText(valor)
      if (tipo === 'senha' && credenciais) {
        const pessoa = pessoas.find((p) => p.id === processos.find((pr) => pr.id === credenciais.processoid)?.pessoaId)
        if (pessoa) registrarAcessoSenhaGov('copia', { pessoaId: pessoa.id, processoId: credenciais.processoid })
      }
      setMensagem({ tipo: 'success', texto: 'Copiado para a área de transferência.' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Não foi possível copiar para a área de transferência') })
    }
  }

  const salvarSenhaGov = async () => {
    if (!credenciais) return
    const processo = processos.find((p) => p.id === credenciais.processoid)
    if (!processo) return
    
    try {
      setCredenciais((c) => c ? { ...c, salvandoSenha: true } : c)
      const { atualizarPessoa } = usePessoasStore.getState()
      await atualizarPessoa(processo.pessoaId, { senhaGov: credenciais.senhaGovEditavel })
      setCredenciais((c) => c ? { 
        ...c, 
        senhaGov: credenciais.senhaGovEditavel,
        mostraEditSenha: false,
        salvandoSenha: false 
      } : c)
      setMensagem({ tipo: 'success', texto: 'Senha atualizada com sucesso!' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao atualizar senha') })
      setCredenciais((c) => c ? { ...c, salvandoSenha: false } : c)
    }
  }

  const adicionarNovaPessoa = async (e: React.FormEvent) => {
    e.preventDefault()
    const erros = validarPessoaFormulario(formDataNovaP)
    if (Object.keys(erros).length > 0) {
      setFormErrosNovaP(erros)
      return
    }
    try {
      setSalvandoNovaP(true)
      const novaPessoa = await adicionarPessoa(formDataNovaP)
      setFormData((f) => ({ ...f, pessoaId: novaPessoa.id }))
      setMostraCriarPessoa(false)
      setFormDataNovaP({ nome: '', cpf: '', senhaGov: '', telefone: '', email: '', endereco: '', ativo: true })
      setFormErrosNovaP({})
      setMostraSenhaNovaP(false)
      setMensagem({ tipo: 'success', texto: `Pessoa "${novaPessoa.nome}" criada com sucesso!` })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao criar pessoa') })
    } finally {
      setSalvandoNovaP(false)
    }
  }

  const salvarDataPrazo = async (processoId: string) => {
    if (!novaDataPrazo) return
    try {
      const novaData = converterDataStringParaDate(novaDataPrazo)
      await atualizarProcesso(processoId, { dataPrazo: novaData })
      setMensagem({ tipo: 'success', texto: 'Data prazo atualizada com sucesso!' })
      setEditandoDataPrazoId(null)
      setNovaDataPrazo('')
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao atualizar data') })
    }
  }

  const limparFiltros = () => {
    setBusca('')
    setFiltroStatus('todos')
    setFiltroTipo('todos')
    setFiltroVenc('todos')
  }

  const irParaTopo = () => {
    topoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const marcarUltimaConsulta = () => {
    setCredenciais((c) => c ? { ...c, ultimaConsulta: new Date() } : c)
  }

  const confirmarExclusao = async () => {
    if (!processoParaExcluir) return
    try {
      await deletarProcesso(processoParaExcluir.id)
      setMensagem({ tipo: 'success', texto: 'Processo excluído com sucesso!' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao excluir processo') })
    } finally {
      setProcessoParaExcluir(null)
    }
  }

  useEffect(() => {
    if (detalhesId) {
      setUltimoProcessoComDocumentos(detalhesId)
    }
  }, [detalhesId])

  if (detalhesId) {
    return (
      <DetalheProcesso
        processoId={detalhesId}
        onVoltar={() => setDetalhesId(null)}
      />
    )
  }

  return (
    <div className="space-y-6" ref={topoRef}>
      {/* Cabeçalho */}
      <PageHeader
        icon={<FileText className="w-8 h-8" />}
        title="Processos"
        subtitle={`${processadosFiltrados.length} processo(s)`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BackgroundSyncBadge active={atualizandoEmSegundoPlano} erro={erroConexao} />
            <Button onClick={abrirModalNovo} className="w-full sm:w-auto bg-white/10 border border-white/20 hover:bg-white/20 text-white">
              <Plus className="w-5 h-5" />
              Novo Processo
            </Button>
          </div>
        }
      />

      {mensagem && <Alert type={mensagem.tipo} message={mensagem.texto} onClose={() => setMensagem(null)} />}
      {erro && <Alert type="error" message={erro} />}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nº processo, tipo, nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col flex-1 sm:flex-none">
            <label className="text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-auto"
          >
            <option value="todos">Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
          <div className="flex flex-col flex-1 sm:flex-none">
            <label className="text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-auto"
          >
            <option value="todos">Todos os tipos</option>
            {TIPOS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
          <div className="flex flex-1 sm:flex-none gap-1 p-1 rounded-xl bg-gray-100 ring-1 ring-gray-200">
            {(['todos', 'vencidos', 'hoje', 'semana'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFiltroVenc(v)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-all duration-150 font-medium flex-1 sm:flex-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${filtroVenc === v
                  ? 'bg-white text-red-700 border-red-200 shadow-sm'
                  : 'bg-transparent text-gray-700 border-transparent hover:bg-white/80 hover:text-gray-900'
                }`}
              >
                {v === 'todos' ? 'Todos prazos' : v === 'vencidos' ? 'Vencidos' : v === 'hoje' ? 'Vence hoje' : 'Esta semana'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={limparFiltros}
            disabled={!busca && filtroStatus === 'todos' && filtroTipo === 'todos' && filtroVenc === 'todos'}
            className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {carregandoInicial && (
        <div className="space-y-3">
          {[{w1: 'w-3/4', w2: 'w-1/4', w3: 'w-1/3'}, {w1: 'w-2/3', w2: 'w-1/3', w3: 'w-1/2'}, {w1: 'w-1/2', w2: 'w-1/4', w3: 'w-2/5'}, {w1: 'w-3/5', w2: 'w-1/3', w3: 'w-1/3'}, {w1: 'w-2/3', w2: 'w-1/4', w3: 'w-1/2'}].map((s, idx) => (
            <div key={`processo-skeleton-${idx}`} className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-4 space-y-3">
              <Skeleton className={`h-5 ${s.w1}`} />
              <Skeleton className={`h-4 ${s.w2}`} />
              <Skeleton className={`h-4 ${s.w3}`} />
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {!carregandoInicial && processadosFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-10 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">Nenhum processo encontrado</p>
          {(busca || filtroStatus !== 'todos' || filtroTipo !== 'todos' || filtroVenc !== 'todos') && (
            <p className="text-sm text-gray-500 mt-1">Tente ajustar os filtros para encontrar resultados.</p>
          )}
          <Button onClick={abrirModalNovo} className="mt-4">
            <Plus className="w-4 h-4" />
            Cadastrar processo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="md:hidden space-y-3">
            {processadosFiltrados.map((processo) => {
              const pessoa = pessoas.find((p) => p.id === processo.pessoaId)
              const diasRestantes = processo.dataPrazo ? calcularDiasRestantes(processo.dataPrazo) : null
              const vencido = diasRestantes !== null && diasRestantes < 0
              const venceHoje = diasRestantes === 0
              const processoAberto = ultimoProcessoComDocumentos === processo.id || ultimoProcessoComCredenciais === processo.id
              return (
                <div key={processo.id} className={`bg-white rounded-2xl shadow-sm ring-1 p-4 ${processoAberto ? 'ring-sky-200 bg-sky-50/40' : vencido ? 'ring-red-200' : 'ring-black/5'}`}>
                  <p className="font-semibold text-gray-900">{pessoa?.nome || 'Pessoa não encontrada'}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">{pessoa?.cpf || 'Sem CPF'}</p>
                  <p className="text-sm text-gray-700 mt-2">{nomesTipoProcesso[processo.tipo]}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${coresStatusProcesso[processo.status]}`}>
                      {nomesStatusProcesso[processo.status]}
                    </span>
                    {vencido && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {Math.abs(diasRestantes!)}d
                      </span>
                    )}
                    {venceHoje && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Hoje
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Prazo: {processo.dataPrazo ? formatarData(processo.dataPrazo) : '-'}
                  </p>
                  <div className="flex justify-end gap-1 mt-3">
                    <button
                      onClick={() => void abrirCredenciais(processo)}
                      title="Ver credenciais"
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDetalhesId(processo.id)}
                      title="Ver documentos"
                      className={`p-1.5 rounded-lg transition-colors ${processoAberto ? 'text-sky-700 bg-sky-100 hover:bg-sky-200' : 'text-purple-600 hover:bg-purple-50'}`}
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => abrirModalEditar(processo)}
                      title="Editar"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setProcessoParaExcluir({ id: processo.id, numero: processo.numero || 'este processo' })}
                      title="Excluir"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Pessoa</th>
                    <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                    <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th scope="col" className="text-left px-4 py-3 font-semibold text-gray-600">Data Prazo</th>
                    <th scope="col" className="text-right px-4 py-3 font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {processadosFiltrados.map((processo) => {
                    const pessoa = pessoas.find((p) => p.id === processo.pessoaId)
                    const diasRestantes = processo.dataPrazo ? calcularDiasRestantes(processo.dataPrazo) : null
                    const vencido = diasRestantes !== null && diasRestantes < 0
                    const venceHoje = diasRestantes === 0
                    const processoAberto = ultimoProcessoComDocumentos === processo.id || ultimoProcessoComCredenciais === processo.id
                    let bgClass = 'hover:bg-gray-50'
                    if (processoAberto) {
                      bgClass = 'bg-sky-50 hover:bg-sky-100'
                    } else if (vencido) {
                      bgClass = 'bg-red-50 hover:bg-red-100'
                    }
                    return (
                      <tr key={processo.id} className={`border-b border-gray-100 transition-colors ${bgClass}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{pessoa?.nome || 'Pessoa não encontrada'}</p>
                          <p className="text-xs text-gray-500 font-mono">{pessoa?.cpf || 'Sem CPF'}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{nomesTipoProcesso[processo.tipo]}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${coresStatusProcesso[processo.status]}`}>
                              {nomesStatusProcesso[processo.status]}
                            </span>
                            {vencido && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {Math.abs(diasRestantes!)}d
                              </span>
                            )}
                            {venceHoje && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Hoje
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {editandoDataPrazoId === processo.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={novaDataPrazo}
                                onChange={(e) => setNovaDataPrazo(e.target.value)}
                                className="border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => salvarDataPrazo(processo.id)}
                                disabled={!novaDataPrazo}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditandoDataPrazoId(null)
                                  setNovaDataPrazo('')
                                }}
                                className="px-2 py-1 text-xs font-medium bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditandoDataPrazoId(processo.id)
                                setNovaDataPrazo(dataParaInput(processo.dataPrazo))
                              }}
                              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                              title="Clique para editar"
                            >
                              {processo.dataPrazo ? formatarData(processo.dataPrazo) : '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => void abrirCredenciais(processo)}
                              title="Ver credenciais"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDetalhesId(processo.id)}
                              title="Ver documentos"
                              className={`p-1.5 rounded-lg transition-colors ${processoAberto ? 'text-sky-700 bg-sky-100 hover:bg-sky-200' : 'text-purple-600 hover:bg-purple-50'}`}
                            >
                              <ClipboardList className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalEditar(processo)}
                              title="Editar"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setProcessoParaExcluir({ id: processo.id, numero: processo.numero || 'este processo' })}
                              title="Excluir"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Painel credenciais */}
      {credenciais && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Credenciais Gov.br" onClick={() => setCredenciais(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-zinc-950 via-red-900 to-zinc-900 px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-red-900/50">
              <h2 className="text-lg font-bold text-white">Credenciais Gov.br</h2>
              <button onClick={() => setCredenciais(null)} className="text-white/60 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">CPF</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm flex-1 bg-gray-50 px-3 py-2 rounded-lg border">{credenciais.cpf}</span>
                  <button onClick={() => void copiarCredencial(credenciais.cpf!, 'cpf')} className="p-2 hover:bg-gray-100 rounded-lg"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
              {credenciais.senhaGov && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500 font-medium">Senha Gov</p>
                    {!credenciais.mostraEditSenha && (
                      <button
                        onClick={() => setCredenciais((c) => c ? { ...c, mostraEditSenha: true } : c)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  {credenciais.mostraEditSenha ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type={credenciais.mostrarSenha ? 'text' : 'password'}
                          value={credenciais.senhaGovEditavel}
                          onChange={(e) => setCredenciais((c) => c ? { ...c, senhaGovEditavel: e.target.value } : c)}
                          className="font-mono text-sm flex-1 bg-white px-3 py-2 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => setCredenciais((c) => c ? { ...c, mostrarSenha: !c.mostrarSenha } : c)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          {credenciais.mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={salvarSenhaGov}
                          disabled={credenciais.salvandoSenha}
                          className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {credenciais.salvandoSenha ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setCredenciais((c) => c ? { ...c, mostraEditSenha: false, senhaGovEditavel: credenciais.senhaGov || '' } : c)}
                          disabled={credenciais.salvandoSenha}
                          className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm flex-1 bg-gray-50 px-3 py-2 rounded-lg border">
                        {credenciais.mostrarSenha ? credenciais.senhaGov : '••••••••'}
                      </span>
                      <button
                        onClick={() => setCredenciais((c) => c ? { ...c, mostrarSenha: !c.mostrarSenha } : c)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        {credenciais.mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => void copiarCredencial(credenciais.senhaGov!, 'senha')} className="p-2 hover:bg-gray-100 rounded-lg"><Copy className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={credenciais.status}
                    onChange={(e) => {
                      setCredenciais((c) => c ? { ...c, status: e.target.value as StatusProcesso } : c)
                      void atualizarProcesso(credenciais.processoid, { status: e.target.value as StatusProcesso })
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Observações</label>
                  <textarea
                    value={credenciais.observacoes}
                    onChange={(e) => {
                      setCredenciais((c) => c ? { ...c, observacoes: e.target.value } : c)
                      void atualizarProcesso(credenciais.processoid, { observacoes: e.target.value })
                    }}
                    placeholder="Adicione observações sobre este processo..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-none transition-colors"
                    rows={3}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Última Consulta</label>
                    <button
                      onClick={() => {
                        marcarUltimaConsulta()
                        void atualizarProcesso(credenciais.processoid, { dataUltimaConsulta: new Date() })
                      }}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors"
                    >
                      Marcar hoje
                    </button>
                  </div>
                  <p className="text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                    {credenciais.ultimaConsulta ? formatarData(credenciais.ultimaConsulta) : 'Sem registro'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center pt-2 border-t border-gray-200">O acesso foi registrado no log de auditoria</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar processo */}
      {mostraModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade-in" role="dialog" aria-modal="true" aria-label={editandoId ? 'Editar Processo' : 'Novo Processo'} onClick={() => setMostraModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editandoId ? 'Editar Processo' : 'Novo Processo'}</h2>
              <button onClick={() => setMostraModal(false)} className="text-white/70 hover:text-white" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Seção: Identificação */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Identificação</legend>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Pessoa *</label>
                <select
                  value={formData.pessoaId}
                  onChange={(e) => setFormData({ ...formData, pessoaId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Selecione a pessoa</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} — {p.cpf}</option>
                  ))}
                </select>
                {formErros.pessoaId && <p className="text-xs text-red-600 mt-1">{formErros.pessoaId}</p>}
                <button
                  type="button"
                  onClick={() => setMostraCriarPessoa(true)}
                  className="text-xs text-red-600 hover:text-red-700 mt-2 underline"
                >
                  ou Criar nova pessoa
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📋 Tipo de Processo *</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoProcesso })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Selecione o tipo</option>
                  {TIPOS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {formErros.tipo && <p className="text-xs text-red-600 mt-1">{formErros.tipo}</p>}
              </div>
              </fieldset>
              {/* Seção: Detalhes */}
              <fieldset className="space-y-4 border-t border-gray-100 pt-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Detalhes</legend>
              {editandoId && (
                <Input
                  label="🔢 Número do Processo"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="Ex: 2024/12345"
                />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">📊 Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusProcesso })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="📅 Data de Abertura *"
                  type="date"
                  value={formData.dataAbertura}
                  onChange={(e) => setFormData({ ...formData, dataAbertura: e.target.value })}
                  error={formErros.dataAbertura}
                />
                <Input
                  label="⏰ Data Prazo"
                  type="date"
                  value={formData.dataPrazo}
                  onChange={(e) => setFormData({ ...formData, dataPrazo: e.target.value })}
                  error={formErros.dataPrazo}
                />
              </div>
              </fieldset>
              {/* Seção: Informações complementares */}
              <fieldset className="space-y-4 border-t border-gray-100 pt-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Informações complementares</legend>
              {editandoId && (
                <Input
                  label="📝 Descrição"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição opcional"
                />
              )}
              <Input
                label="🗒️ Observações"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações internas"
              />
              </fieldset>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setMostraModal(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={salvandoProcesso}>{salvandoProcesso ? 'Salvando...' : editandoId ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal criar nova pessoa */}
      {mostraCriarPessoa && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade-in" role="dialog" aria-modal="true" aria-label="Nova Pessoa" onClick={() => setMostraCriarPessoa(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Nova Pessoa</h2>
              <button onClick={() => setMostraCriarPessoa(false)} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={adicionarNovaPessoa} className="p-6 space-y-4">
              <Input
                label="👤 Nome Completo *"
                value={formDataNovaP.nome}
                onChange={(e) => setFormDataNovaP({ ...formDataNovaP, nome: e.target.value })}
                placeholder="Nome completo"
                error={formErrosNovaP.nome as string}
                autoFocus
              />
              <Input
                label="📋 CPF *"
                value={formDataNovaP.cpf}
                onChange={(e) => setFormDataNovaP({ ...formDataNovaP, cpf: formatarCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
                error={formErrosNovaP.cpf as string}
              />
              <Input
                label="📞 Telefone"
                value={formDataNovaP.telefone}
                onChange={(e) => setFormDataNovaP({ ...formDataNovaP, telefone: formatarTelefone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
                error={formErrosNovaP.telefone as string}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🔐 Senha Gov</label>
                <div className="relative flex items-center">
                  <input
                    type={mostraSenhaNovaP ? 'text' : 'password'}
                    value={formDataNovaP.senhaGov}
                    onChange={(e) => setFormDataNovaP({ ...formDataNovaP, senhaGov: e.target.value })}
                    placeholder="Deixe em branco se não tiver"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
                      bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setMostraSenhaNovaP(!mostraSenhaNovaP)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600"
                    title={mostraSenhaNovaP ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostraSenhaNovaP ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Armazenada criptografada com AES-GCM</p>
              </div>
              <Input
                label="✉️ Email"
                type="email"
                value={formDataNovaP.email}
                onChange={(e) => setFormDataNovaP({ ...formDataNovaP, email: e.target.value })}
                placeholder="exemplo@email.com"
                error={formErrosNovaP.email as string}
              />
              <Input
                label="📍 Endereço"
                value={formDataNovaP.endereco}
                onChange={(e) => setFormDataNovaP({ ...formDataNovaP, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade"
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setMostraCriarPessoa(false)} className="flex-1" disabled={salvandoNovaP}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={salvandoNovaP}>
                  {salvandoNovaP ? 'Criando...' : 'Criar Pessoa'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={processoParaExcluir !== null}
        title="Excluir Processo"
        message={`Deseja excluir o processo "${processoParaExcluir?.numero}"? Esta ação não pode ser desfeita e também removerá todos os documentos associados.`}
        confirmText="Excluir"
        danger
        onConfirm={confirmarExclusao}
        onCancel={() => setProcessoParaExcluir(null)}
      />

      {/* Painel flutuante - Ações rápidas */}
      {!mostraModal && !mostraCriarPessoa && !credenciais && (
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 flex flex-col gap-3 z-40">
        <button
          onClick={irParaTopo}
          className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          title="Ir para o topo"
        >
          <ArrowUp className="w-6 h-6" />
          <span className="absolute right-16 bg-gray-900 text-white text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Ir para topo
          </span>
        </button>
        <button
          onClick={abrirModalNovo}
          className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          title="Novo Processo"
        >
          <Plus className="w-6 h-6" />
          <span className="absolute right-16 bg-gray-900 text-white text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Novo processo
          </span>
        </button>
      </div>
      )}
    </div>
  )
}
