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
  CalendarDays,
  UserPlus,
  Check,
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

const normalizarTextoBusca = (valor?: string): string => {
  if (!valor) return ''
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const normalizarIdRelacionamento = (valor?: string): string => (valor || '').trim()

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
  const [buscaPessoaModal, setBuscaPessoaModal] = useState('')
  const [indicePessoaDestacada, setIndicePessoaDestacada] = useState(0)
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
  const formProcessoRef = React.useRef<HTMLFormElement | null>(null)
  const inputBuscaPessoaRef = React.useRef<HTMLInputElement | null>(null)
  const inputDataPrazoInlineRef = React.useRef<HTMLInputElement | null>(null)
  const inputDataPrazoModalRef = React.useRef<HTMLInputElement | null>(null)
  const carregandoInicial = Boolean(carregandoProcessos || carregandoPessoas) && processos.length === 0
  const atualizandoEmSegundoPlano = Boolean(carregandoProcessos || carregandoPessoas) && !carregandoInicial

  const abrirSeletorData = (input: HTMLInputElement | null) => {
    if (!input) return
    input.focus()
    const picker = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof picker.showPicker === 'function') picker.showPicker()
  }

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

  const pessoasPorId = useMemo(() => {
    const mapa = new Map<string, (typeof pessoas)[number]>()
    pessoas.forEach((pessoa) => {
      mapa.set(normalizarIdRelacionamento(pessoa.id), pessoa)
    })
    return mapa
  }, [pessoas])

  const obterPessoaDoProcesso = (pessoaId: string) => pessoasPorId.get(normalizarIdRelacionamento(pessoaId))

  const pessoasFiltradasModal = useMemo(() => {
    const textoBusca = normalizarTextoBusca(buscaPessoaModal)
    const buscaCpf = buscaPessoaModal.replace(/\D/g, '')
    const temBuscaTexto = textoBusca.length > 0
    const temBuscaCpf = buscaCpf.length > 0

    if (!temBuscaTexto && !temBuscaCpf) return pessoas

    return pessoas.filter((pessoa) => {
      const nomeNormalizado = normalizarTextoBusca(pessoa.nome)
      const cpfNormalizado = pessoa.cpf.replace(/\D/g, '')
      const correspondeNome = temBuscaTexto && nomeNormalizado.includes(textoBusca)
      const correspondeCpf = temBuscaCpf && cpfNormalizado.includes(buscaCpf)
      const pessoaSelecionada = normalizarIdRelacionamento(pessoa.id) === normalizarIdRelacionamento(formData.pessoaId)
      return correspondeNome || correspondeCpf || pessoaSelecionada
    })
  }, [pessoas, buscaPessoaModal, formData.pessoaId])

  const processadosFiltrados = useMemo(() => {
    const textoBusca = normalizarTextoBusca(busca)
    const buscaNormalizada = busca.replace(/\D/g, '')
    const temBuscaTexto = textoBusca.length > 0
    const temBuscaCpf = buscaNormalizada.length > 0

    return processos.filter((p) => {
      if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false
      if (temBuscaTexto || temBuscaCpf) {
        const pessoa = obterPessoaDoProcesso(p.pessoaId)
        const numeroNormalizado = normalizarTextoBusca(p.numero)
        const tipoNormalizado = normalizarTextoBusca(nomesTipoProcesso[p.tipo])
        const nomePessoaNormalizado = normalizarTextoBusca(pessoa?.nome)
        const cpfNormalizado = pessoa?.cpf?.replace(/\D/g, '') || ''
        const buscaCPFValida = temBuscaCpf && cpfNormalizado.includes(buscaNormalizada)
        if (
          !(temBuscaTexto && numeroNormalizado.includes(textoBusca)) &&
          !(temBuscaTexto && tipoNormalizado.includes(textoBusca)) &&
          !(temBuscaTexto && nomePessoaNormalizado.includes(textoBusca)) &&
          !buscaCPFValida
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
  }, [processos, busca, filtroStatus, filtroTipo, filtroVenc, pessoasPorId])

  const abrirModalNovo = () => {
    setFormData({ ...FORM_INICIAL, pessoaId: pessoaIdInicial || '' })
    setEditandoId(null)
    setFormErros({})
    setBuscaPessoaModal('')
    setIndicePessoaDestacada(0)
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
    setBuscaPessoaModal('')
    setIndicePessoaDestacada(0)
    setMostraModal(true)
  }

  const selecionarPessoaNoModal = (pessoaId: string) => {
    setFormData((atual) => ({ ...atual, pessoaId }))
    if (formErros.pessoaId) {
      setFormErros((atual) => ({ ...atual, pessoaId: undefined }))
    }
  }

  const lidarTecladoBuscaPessoa = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter' && pessoasFiltradasModal.length === 0) {
      evento.preventDefault()
      return
    }

    if (pessoasFiltradasModal.length === 0) return

    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setIndicePessoaDestacada((atual) => (atual + 1) % pessoasFiltradasModal.length)
      return
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndicePessoaDestacada((atual) => (atual - 1 + pessoasFiltradasModal.length) % pessoasFiltradasModal.length)
      return
    }

    if (evento.key === 'Enter' && indicePessoaDestacada >= 0) {
      evento.preventDefault()
      const pessoa = pessoasFiltradasModal[indicePessoaDestacada]
      if (pessoa) selecionarPessoaNoModal(pessoa.id)
    }
  }

  useEffect(() => {
    if (!mostraModal) return
    if (pessoasFiltradasModal.length === 0) {
      setIndicePessoaDestacada(-1)
      return
    }

    const indiceSelecionada = pessoasFiltradasModal.findIndex(
      (pessoa) => normalizarIdRelacionamento(pessoa.id) === normalizarIdRelacionamento(formData.pessoaId),
    )
    setIndicePessoaDestacada(indiceSelecionada >= 0 ? indiceSelecionada : 0)
  }, [mostraModal, pessoasFiltradasModal, formData.pessoaId])

  useEffect(() => {
    if (!mostraModal) return
    window.requestAnimationFrame(() => {
      inputBuscaPessoaRef.current?.focus()
    })
  }, [mostraModal])

  useEffect(() => {
    if (!mostraModal) return
    const buscaAtiva = buscaPessoaModal.trim().length > 0
    if (!buscaAtiva || pessoasFiltradasModal.length !== 1) return
    const unicaPessoa = pessoasFiltradasModal[0]
    if (normalizarIdRelacionamento(unicaPessoa.id) !== normalizarIdRelacionamento(formData.pessoaId)) {
      selecionarPessoaNoModal(unicaPessoa.id)
    }
  }, [mostraModal, buscaPessoaModal, pessoasFiltradasModal, formData.pessoaId])

  useEffect(() => {
    if (!mostraModal) return
    const aoPressionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        if (mostraCriarPessoa) {
          setMostraCriarPessoa(false)
        } else {
          setMostraModal(false)
        }
        return
      }

      if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey) && !mostraCriarPessoa) {
        evento.preventDefault()
        formProcessoRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [mostraModal, mostraCriarPessoa])

  const salvarProcessoFormulario = async (criarOutro = false) => {
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
        if (criarOutro) {
          setMensagem({ tipo: 'success', texto: 'Processo cadastrado! Pronto para criar o próximo.' })
          setFormData((atual) => ({
            ...FORM_INICIAL,
            tipo: atual.tipo,
            status: atual.status,
            dataAbertura: atual.dataAbertura,
          }))
          setBuscaPessoaModal('')
          setIndicePessoaDestacada(0)
          setFormErros({})
          window.requestAnimationFrame(() => {
            inputBuscaPessoaRef.current?.focus()
          })
        } else {
          setMensagem({ tipo: 'success', texto: 'Processo cadastrado com sucesso!' })
          setMostraModal(false)
          setDetalhesId(novoProcesso.id)
        }
      }
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar processo') })
    } finally {
      setSalvandoProcesso(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await salvarProcessoFormulario(false)
  }

  const abrirCredenciais = async (processo: Processo) => {
    const pessoa = obterPessoaDoProcesso(processo.pessoaId)
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
        const pessoa = obterPessoaDoProcesso(processos.find((pr) => pr.id === credenciais.processoid)?.pessoaId || '')
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

  const marcarUltimaConsulta = (quando: Date) => {
    setCredenciais((c) => c ? { ...c, ultimaConsulta: quando } : c)
  }

  const atualizarCampoCredenciais = async (atualizacoes: Partial<Processo>, erroPadrao: string) => {
    if (!credenciais) return false
    try {
      await atualizarProcesso(credenciais.processoid, atualizacoes)
      return true
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, erroPadrao) })
      return false
    }
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

  useEffect(() => {
    if (editandoDataPrazoId) abrirSeletorData(inputDataPrazoInlineRef.current)
  }, [editandoDataPrazoId])

  if (detalhesId) {
    return (
      <DetalheProcesso
        processoId={detalhesId}
        onVoltar={() => setDetalhesId(null)}
      />
    )
  }

  const processoCredenciais = credenciais
    ? processos.find((processo) => processo.id === credenciais.processoid)
    : undefined
  const pessoaCredenciais = processoCredenciais
    ? obterPessoaDoProcesso(processoCredenciais.pessoaId)
    : undefined

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nº processo, tipo, nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,220px)_minmax(180px,220px)_1fr] gap-3 items-end">
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="h-10 text-sm border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-red-500 w-full bg-white"
          >
            <option value="todos">Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
            className="h-10 text-sm border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-red-500 w-full bg-white"
          >
            <option value="todos">Todos os tipos</option>
            {TIPOS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
          <div className="flex flex-col min-w-0">
            <label className="text-xs font-medium text-gray-500 mb-1">Prazo</label>
            <div className="h-10 flex gap-1 p-1 rounded-xl bg-gray-100 ring-1 ring-gray-200">
            {(['todos', 'vencidos', 'hoje', 'semana'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFiltroVenc(v)}
                className={`text-sm px-3 rounded-lg border transition-all duration-150 font-medium flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 whitespace-nowrap ${filtroVenc === v
                  ? 'bg-white text-red-700 border-red-200 shadow-sm'
                  : 'bg-transparent text-gray-700 border-transparent hover:bg-white/80 hover:text-gray-900'
                }`}
              >
                {v === 'todos' ? 'Todos prazos' : v === 'vencidos' ? 'Vencidos' : v === 'hoje' ? 'Vence hoje' : 'Esta semana'}
              </button>
            ))}
            </div>
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
              const pessoa = obterPessoaDoProcesso(processo.pessoaId)
              const diasRestantes = processo.dataPrazo ? calcularDiasRestantes(processo.dataPrazo) : null
              const vencido = diasRestantes !== null && diasRestantes < 0
              const venceHoje = diasRestantes === 0
              const ultimoCredenciais = ultimoProcessoComCredenciais === processo.id
              const ultimoDocumentos = ultimoProcessoComDocumentos === processo.id
              return (
                <div key={processo.id} className={`bg-white rounded-2xl shadow-sm ring-1 p-4 ${ultimoCredenciais ? 'ring-emerald-200 bg-emerald-50/40' : ultimoDocumentos ? 'ring-sky-200 bg-sky-50/40' : vencido ? 'ring-red-200' : 'ring-black/5'}`}>
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
                      className={`p-1.5 rounded-lg transition-colors ${ultimoCredenciais ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-amber-600 hover:bg-amber-50'}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDetalhesId(processo.id)}
                      title="Ver documentos"
                      className={`p-1.5 rounded-lg transition-colors ${ultimoDocumentos ? 'text-sky-700 bg-sky-100 hover:bg-sky-200' : 'text-purple-600 hover:bg-purple-50'}`}
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
                    const pessoa = obterPessoaDoProcesso(processo.pessoaId)
                    const diasRestantes = processo.dataPrazo ? calcularDiasRestantes(processo.dataPrazo) : null
                    const vencido = diasRestantes !== null && diasRestantes < 0
                    const venceHoje = diasRestantes === 0
                    const ultimoCredenciais = ultimoProcessoComCredenciais === processo.id
                    const ultimoDocumentos = ultimoProcessoComDocumentos === processo.id
                    let bgClass = 'hover:bg-gray-50'
                    if (ultimoCredenciais) {
                      bgClass = 'bg-emerald-50 hover:bg-emerald-100'
                    } else if (ultimoDocumentos) {
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
                                ref={inputDataPrazoInlineRef}
                                type="date"
                                value={novaDataPrazo}
                                onChange={(e) => setNovaDataPrazo(e.target.value)}
                                className="border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => abrirSeletorData(inputDataPrazoInlineRef.current)}
                                className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                title="Abrir calendário"
                              >
                                <CalendarDays className="w-4 h-4" />
                              </button>
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
                              className={`p-1.5 rounded-lg transition-colors ${ultimoCredenciais ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' : 'text-amber-600 hover:bg-amber-50'}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDetalhesId(processo.id)}
                              title="Ver documentos"
                              className={`p-1.5 rounded-lg transition-colors ${ultimoDocumentos ? 'text-sky-700 bg-sky-100 hover:bg-sky-200' : 'text-purple-600 hover:bg-purple-50'}`}
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
        <div className="fixed inset-0 bg-black/35 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Credenciais Gov.br" onClick={() => setCredenciais(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-zinc-950 via-red-900 to-zinc-900 px-6 py-4 rounded-t-2xl flex items-center justify-between border-b border-red-900/50">
              <h2 className="text-lg font-bold text-white">Credenciais Gov.br</h2>
              <button onClick={() => setCredenciais(null)} className="text-white/60 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Nome</p>
                  <p className="text-sm font-semibold text-gray-900">{pessoaCredenciais?.nome || 'Pessoa não encontrada'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Tipo de processo</p>
                  <p className="text-sm text-gray-800">{processoCredenciais ? nomesTipoProcesso[processoCredenciais.tipo] : 'Não identificado'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Data de início</p>
                  <p className="text-sm text-gray-800">{processoCredenciais ? formatarData(processoCredenciais.dataAbertura) : 'Não informada'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">CPF</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm flex-1 bg-gray-50 px-3 py-2 rounded-lg border">{credenciais.cpf}</span>
                  <button onClick={() => void copiarCredencial(credenciais.cpf!, 'cpf')} className="p-2 hover:bg-gray-100 rounded-lg"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
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
                      {credenciais.senhaGov ? (credenciais.mostrarSenha ? credenciais.senhaGov : '••••••••') : 'Sem senha cadastrada'}
                    </span>
                    <button
                      onClick={() => setCredenciais((c) => c ? { ...c, mostrarSenha: !c.mostrarSenha } : c)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      disabled={!credenciais.senhaGov}
                      title={credenciais.senhaGov ? 'Mostrar/Ocultar senha' : 'Sem senha para exibir'}
                    >
                      {credenciais.mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => credenciais.senhaGov && void copiarCredencial(credenciais.senhaGov, 'senha')}
                      className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!credenciais.senhaGov}
                      title={credenciais.senhaGov ? 'Copiar senha' : 'Sem senha para copiar'}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={credenciais.status}
                    onChange={(e) => {
                      const novoStatus = e.target.value as StatusProcesso
                      setCredenciais((c) => c ? { ...c, status: novoStatus } : c)
                      void atualizarCampoCredenciais({ status: novoStatus }, 'Erro ao atualizar status')
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
                    onChange={(e) => setCredenciais((c) => c ? { ...c, observacoes: e.target.value } : c)}
                    onBlur={() => void atualizarCampoCredenciais({ observacoes: credenciais.observacoes }, 'Erro ao atualizar observações')}
                    placeholder="Adicione observações sobre este processo..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-none transition-colors"
                    rows={3}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Última Consulta</label>
                    <button
                      onClick={async () => {
                        const agora = new Date()
                        const ok = await atualizarCampoCredenciais({ dataUltimaConsulta: agora }, 'Erro ao marcar última consulta')
                        if (ok) marcarUltimaConsulta(agora)
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
        <div className="fixed inset-0 bg-black/35 backdrop-blur-[1px] z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade-in" role="dialog" aria-modal="true" aria-label={editandoId ? 'Editar Processo' : 'Novo Processo'} onClick={() => setMostraModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editandoId ? 'Editar Processo' : 'Novo Processo'}</h2>
              <button onClick={() => setMostraModal(false)} className="text-white/70 hover:text-white" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form ref={formProcessoRef} onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Seção: Identificação */}
              <fieldset className="space-y-4">
                <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Identificação</legend>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">👤 Pessoa *</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={inputBuscaPessoaRef}
                    type="text"
                    value={buscaPessoaModal}
                    onChange={(e) => setBuscaPessoaModal(e.target.value)}
                    onKeyDown={lidarTecladoBuscaPessoa}
                    placeholder="Pesquisar pessoa por nome ou CPF"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {formData.pessoaId
                      ? `Pessoa selecionada: ${obterPessoaDoProcesso(formData.pessoaId)?.nome || 'não encontrada'}`
                      : 'Selecione uma pessoa na lista abaixo'}
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white" role="listbox" aria-label="Pessoas disponíveis">
                    {pessoasFiltradasModal.map((p, indice) => {
                      const selecionada = normalizarIdRelacionamento(p.id) === normalizarIdRelacionamento(formData.pessoaId)
                      const destacada = indice === indicePessoaDestacada
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selecionarPessoaNoModal(p.id)}
                          onMouseEnter={() => setIndicePessoaDestacada(indice)}
                          className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${destacada ? 'bg-red-50' : 'hover:bg-gray-50'} ${selecionada ? 'text-red-700 font-medium' : 'text-gray-700'}`}
                          aria-selected={selecionada}
                        >
                          <span className="truncate pr-3">{p.nome} - {p.cpf}</span>
                          {selecionada && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">Dica: use setas para navegar e Enter para selecionar.</p>
                </div>
                {buscaPessoaModal && pessoasFiltradasModal.length === 0 && (
                  <p className="text-xs text-amber-700 mt-2">Nenhuma pessoa encontrada para essa busca.</p>
                )}
                {formErros.pessoaId && <p className="text-xs text-red-600 mt-1">{formErros.pessoaId}</p>}
                <button
                  type="button"
                  onClick={() => setMostraCriarPessoa(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Criar nova pessoa rapidamente
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
                <div className="space-y-1">
                  <label htmlFor="data-prazo" className="block text-sm font-medium text-gray-700">⏰ Data Prazo</label>
                  <div className="relative">
                    <input
                      id="data-prazo"
                      ref={inputDataPrazoModalRef}
                      type="date"
                      value={formData.dataPrazo}
                      onChange={(e) => setFormData({ ...formData, dataPrazo: e.target.value })}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${formErros.dataPrazo ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
                    />
                    <button
                      type="button"
                      onClick={() => abrirSeletorData(inputDataPrazoModalRef.current)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title="Abrir calendário"
                    >
                      <CalendarDays className="w-4 h-4" />
                    </button>
                  </div>
                  {formErros.dataPrazo && <p className="text-xs text-red-600">{formErros.dataPrazo}</p>}
                </div>
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
                {!editandoId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    disabled={salvandoProcesso}
                    onClick={() => void salvarProcessoFormulario(true)}
                  >
                    {salvandoProcesso ? 'Salvando...' : 'Salvar e criar outro'}
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={salvandoProcesso}>{salvandoProcesso ? 'Salvando...' : editandoId ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
              <p className="text-[11px] text-gray-500">Atalhos: Ctrl+Enter para salvar e Esc para fechar.</p>
            </form>
          </div>
        </div>
      )}

      {/* Modal criar nova pessoa */}
      {mostraCriarPessoa && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-[1px] z-[60] flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade-in" role="dialog" aria-modal="true" aria-label="Nova Pessoa" onClick={() => setMostraCriarPessoa(false)}>
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
