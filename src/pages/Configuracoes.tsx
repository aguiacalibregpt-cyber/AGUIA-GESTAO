import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../data/db'
import type { BackupHistorico, Processo, Pessoa, DocumentoProcesso, Configuracao } from '../types/models'
import { api } from '../lib/api'
import { useProcessosStore } from '../stores/processosStore'
import { usePessoasStore } from '../stores/pessoasStore'
import { useConfiguracoesStore } from '../stores/configuracoesStore'
import { Button, Alert, Input, ConfirmDialog, PageHeader, Skeleton } from '../components'
import { gerarId, obterMensagemErro } from '../utils/robustness'
import { montarTabelaRelatorioProcessos } from '../utils/relatorio'
import {
  criptografarSenhaGovParaBackup,
  criptografarSenhaGov,
  descriptografarSenhaGov,
  senhaGovEstaCriptografada,
} from '../lib/crypto'
import { hashPin, validarFormatoPin } from '../lib/pin'
import {
  Settings,
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  RefreshCw,
  Activity,
} from 'lucide-react'

// ─── Tipos de backup ──────────────────────────────────────────────────────────
interface BackupData {
  versao: string
  timestamp: string
  checksum?: string
  pessoas: (Pessoa & { senhaGovBackup?: string })[]
  processos: Processo[]
  documentosProcesso: DocumentoProcesso[]
  configuracoes: Configuracao[]
}

interface ConexaoAtiva {
  ip: string
  ultimaAtividade: string
  totalRequisicoes: number
  ultimoPath: string
  userAgent?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcularChecksum = async (dados: string): Promise<string> => {
  try {
    if (typeof crypto !== 'undefined' && crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dados))
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // crypto.subtle indisponível em contexto não-HTTPS (modo LAN por IP)
  }
  return ''
}

const MAX_HISTORICO = 10

const carregarDocumentosApi = async (processosLista: Array<{ id: string }>): Promise<DocumentoProcesso[]> => {
  const grupos = await Promise.all(
    processosLista.map((processo) =>
      api.get<DocumentoProcesso[]>(`/documentos-processo?processoId=${encodeURIComponent(processo.id)}`),
    ),
  )
  return grupos.flat()
}

export const Configuracoes: React.FC = () => {
  const { processos, carregarProcessos } = useProcessosStore()
  const { pessoas, carregarPessoas } = usePessoasStore()
  const { obterConfiguracao, salvarConfiguracao } = useConfiguracoesStore()
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error' | 'warning' | 'info'; texto: string } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [historico, setHistorico] = useState<BackupHistorico[]>([])
  const [senhaBackup, setSenhaBackup] = useState('')
  const [senhaRestauracao, setSenhaRestauracao] = useState('')
  const [confirmaExclusao, setConfirmaExclusao] = useState(false)
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null)
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [nomeEmpresaSalvo, setNomeEmpresaSalvo] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [tempoInatividade, setTempoInatividade] = useState('5')
  const [pinConfigurado, setPinConfigurado] = useState(false)
  const [tokenApi, setTokenApi] = useState('')
  const [incluirSenhaNoRelatorio, setIncluirSenhaNoRelatorio] = useState(false)
  const [conexoesAtivas, setConexoesAtivas] = useState<ConexaoAtiva[]>([])
  const [ttlConexoesSegundos, setTtlConexoesSegundos] = useState(300)
  const [carregandoConexoes, setCarregandoConexoes] = useState(false)
  const [ultimaAtualizacaoConexoes, setUltimaAtualizacaoConexoes] = useState<Date | null>(null)
  const [erroConexoes, setErroConexoes] = useState<string | null>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const conexoesJaCarregadasRef = useRef(false)
  const conexoesEndpointIndisponivelRef = useRef(false)
  const [carregandoInicial, setCarregandoInicial] = useState(true)

  const carregarConexoesAtivas = useCallback(async () => {
    if (conexoesEndpointIndisponivelRef.current) return
    if (!conexoesJaCarregadasRef.current) setCarregandoConexoes(true)
    try {
      const resposta = await api.get<{ totalAtivas: number; ttlSegundos: number; conexoes: ConexaoAtiva[] }>('/conexoes-ativas')
      setConexoesAtivas(resposta?.conexoes || [])
      setErroConexoes(null)
      if (typeof resposta?.ttlSegundos === 'number' && resposta.ttlSegundos > 0) {
        setTtlConexoesSegundos(resposta.ttlSegundos)
      }
      setUltimaAtualizacaoConexoes(new Date())
    } catch (error) {
      const mensagem = obterMensagemErro(error, 'Não foi possível carregar dispositivos conectados')
      const mensagemNormalizada = mensagem.toLowerCase()
      const endpointIndisponivel =
        mensagemNormalizada.includes('rota api não encontrada')
        || mensagemNormalizada.includes('erro http 404')
      if (endpointIndisponivel) {
        conexoesEndpointIndisponivelRef.current = true
        setErroConexoes('Dispositivos conectados indisponível nesta versão da API. Atualize ou reinicie o servidor AGUIA para habilitar este painel.')
      } else {
        setErroConexoes(mensagem)
      }
    } finally {
      conexoesJaCarregadasRef.current = true
      setCarregandoConexoes(false)
    }
  }, [])

  const criarHistorico = (params: {
    origem: BackupHistorico['origem']
    nomeArquivo: string
    tamanhoBytes: number
    checksum?: string
    pessoas: number
    processos: number
    documentos: number
    configuracoes: number
    payload: string
  }): BackupHistorico => ({
    id: gerarId('bkp'),
    timestamp: new Date(),
    origem: params.origem,
    nomeArquivo: params.nomeArquivo,
    tamanhoBytes: params.tamanhoBytes,
    checksum: params.checksum,
    pessoas: params.pessoas,
    processos: params.processos,
    documentos: params.documentos,
    configuracoes: params.configuracoes,
    statusIntegridade: 'OK',
    payload: params.payload,
  })

  const carregarDadosIniciais = useCallback(async () => {
    try {
      await Promise.all([carregarPessoas(), carregarProcessos()])
      const hist = await db.backupsHistorico.orderBy('timestamp').reverse().limit(MAX_HISTORICO).toArray()
      setHistorico(hist)
      const ub = await obterConfiguracao('ultimoBackup')
      setUltimoBackup(typeof ub === 'string' ? ub : null)
      const emp = await obterConfiguracao('nomeEmpresa')
      const nome = typeof emp === 'string' ? emp : ''
      setNomeEmpresa(nome)
      setNomeEmpresaSalvo(nome)
      const pinHash = await obterConfiguracao('seguranca_pin_hash')
      setPinConfigurado(typeof pinHash === 'string' && pinHash.length > 0)
      const idle = await obterConfiguracao('seguranca_idle_minutos')
      if (typeof idle === 'number' && idle > 0) setTempoInatividade(String(Math.floor(idle)))
      try {
        setTokenApi(localStorage.getItem('aguia.api.token') || '')
      } catch {
        setTokenApi('')
      }
    } finally {
      setCarregandoInicial(false)
    }
  }, [carregarPessoas, carregarProcessos, obterConfiguracao])

  useEffect(() => {
    void carregarDadosIniciais()
  }, [carregarDadosIniciais])

  useEffect(() => {
    void carregarConexoesAtivas()
    const timer = window.setInterval(() => {
      void carregarConexoesAtivas()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [carregarConexoesAtivas])

  const salvarNomeEmpresa = async () => {
    await salvarConfiguracao('nomeEmpresa', nomeEmpresa.trim())
    setNomeEmpresaSalvo(nomeEmpresa.trim())
    setMensagem({ tipo: 'success', texto: 'Nome da empresa salvo!' })
  }

  const salvarSeguranca = async () => {
    try {
      const idle = Number.parseInt(tempoInatividade, 10)
      if (!Number.isFinite(idle) || idle < 1 || idle > 120) {
        setMensagem({ tipo: 'warning', texto: 'Inatividade deve ficar entre 1 e 120 minutos' })
        return
      }

      // Persiste token antes das chamadas de API abaixo (ex.: primeiro cadastro de PIN com auth ativa).
      try {
        const token = tokenApi.trim()
        if (token) localStorage.setItem('aguia.api.token', token)
        else localStorage.removeItem('aguia.api.token')
      } catch {
        // ignora falha de persistência local
      }

      await salvarConfiguracao('seguranca_idle_minutos', idle)

      if (novoPin || confirmarPin) {
        if (!validarFormatoPin(novoPin)) {
          setMensagem({ tipo: 'warning', texto: 'PIN deve ter de 4 a 8 dígitos numéricos' })
          return
        }
        if (novoPin !== confirmarPin) {
          setMensagem({ tipo: 'warning', texto: 'Confirmação do PIN não confere' })
          return
        }
        const pinHash = await hashPin(novoPin)
        await salvarConfiguracao('seguranca_pin_hash', pinHash)
        setPinConfigurado(true)
        setNovoPin('')
        setConfirmarPin('')
      }

      setMensagem({ tipo: 'success', texto: 'Configurações de segurança salvas!' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar segurança') })
    }
  }

  // ─── Geração de backup ────────────────────────────────────────────────────
  const gerarBackup = async () => {
    if (!senhaBackup.trim()) {
      setMensagem({ tipo: 'warning', texto: 'Informe uma senha para proteger o backup' })
      return
    }
    setCarregando(true)
    try {
      const backupOpts = { timeoutMs: 60_000, retries: 1 }
      const pessoasApi = await api.get<Pessoa[]>('/pessoas', backupOpts)
      const processosApi = await api.get<Processo[]>('/processos', backupOpts)
      const todosDocumentos = await carregarDocumentosApi(processosApi)
      const todasConfiguracoes = await api.get<Configuracao[]>('/configuracoes', backupOpts)

      // Re-criptografa senhaGov com a senha do backup (portátil)
      const pessoasParaBackup = await Promise.all(
        pessoasApi.map(async (p) => {
          if (!p.senhaGov) return { ...p, senhaGovBackup: undefined }
          try {
            const senhaPlano = senhaGovEstaCriptografada(p.senhaGov)
              ? await descriptografarSenhaGov(p.senhaGov, p.cpf)
              : p.senhaGov
            const senhaPortatil = await criptografarSenhaGovParaBackup(senhaPlano || '', senhaBackup)
            return { ...p, senhaGov: undefined, senhaGovBackup: senhaPortatil || undefined }
          } catch {
            return { ...p, senhaGov: undefined, senhaGovBackup: undefined }
          }
        }),
      )

      const payloadSemChecksum: BackupData = {
        versao: '2.0',
        timestamp: new Date().toISOString(),
        pessoas: pessoasParaBackup,
        processos: processosApi,
        documentosProcesso: todosDocumentos,
        configuracoes: todasConfiguracoes,
      }
      const serializado = JSON.stringify(payloadSemChecksum, null, 2)
      const checksum = await calcularChecksum(serializado)
      const payload = { ...payloadSemChecksum, checksum }
      const jsonBackup = JSON.stringify(payload, null, 2)

      const blob = new Blob([jsonBackup], { type: 'application/json' })
      const nomeArquivo = `aguia-backup-${new Date().toISOString().slice(0, 10)}.json`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nomeArquivo
      a.click()
      URL.revokeObjectURL(url)

      const agora = new Date().toISOString()
      await salvarConfiguracao('ultimoBackup', agora)
      setUltimoBackup(agora)
      const novoHistorico = criarHistorico({
        origem: 'EXPORTACAO',
        nomeArquivo,
        tamanhoBytes: blob.size,
        checksum,
        pessoas: pessoasParaBackup.length,
        processos: processosApi.length,
        documentos: todosDocumentos.length,
        configuracoes: todasConfiguracoes.length,
        payload: jsonBackup,
      })
      await db.backupsHistorico.add(novoHistorico)
      // mantém only MAX_HISTORICO
      const todos = await db.backupsHistorico.orderBy('timestamp').reverse().toArray()
      if (todos.length > MAX_HISTORICO) {
        const remover = todos.slice(MAX_HISTORICO)
        await db.backupsHistorico.bulkDelete(remover.map((r) => r.id))
      }
      await carregarDadosIniciais()
      setMensagem({ tipo: 'success', texto: 'Backup gerado com sucesso!' })
      setSenhaBackup('')
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao gerar backup') })
    } finally {
      setCarregando(false)
    }
  }

  // ─── Restauração de backup ────────────────────────────────────────────────
  const restaurarBackup = async (arquivo: File) => {
    if (!senhaRestauracao.trim()) {
      setMensagem({ tipo: 'warning', texto: 'Informe a senha usada ao criar o backup' })
      return
    }
    setCarregando(true)
    try {
      const text = await arquivo.text()
      const dados: BackupData = JSON.parse(text)

      // Verifica checksum
      if (dados.checksum) {
        const { checksum: cs, ...semChecksum } = dados
        const checksumCalculado = await calcularChecksum(JSON.stringify(semChecksum, null, 2))
        if (checksumCalculado !== cs) {
          throw new Error('Checksum inválido — arquivo pode estar corrompido ou adulterado')
        }
      }

      if (!dados.versao || !dados.pessoas || !dados.processos) {
        throw new Error('Arquivo de backup inválido ou incompatível')
      }

      if ((dados.pessoas?.length ?? 0) === 0 && (dados.processos?.length ?? 0) > 0) {
        throw new Error('Backup inconsistente: há processos sem pessoas. Não é seguro restaurar este arquivo.')
      }

      // Re-criptografa senhas com chave local
      const pessoasRestauradas = await Promise.all(
        dados.pessoas.map(async (p) => {
          const { senhaGovBackup, ...pessoaBase } = p as Pessoa & { senhaGovBackup?: string }
          if (!senhaGovBackup) return pessoaBase
          try {
            const senhaPlano = await descriptografarSenhaGov(senhaGovBackup, senhaRestauracao)
            const senhaCript = await criptografarSenhaGov(senhaPlano || '', pessoaBase.cpf)
            return { ...pessoaBase, senhaGov: senhaCript || undefined }
          } catch {
            return pessoaBase
          }
        }),
      )

      await api.post('/backup/import', {
        versao: dados.versao,
        timestamp: dados.timestamp,
        pessoas: pessoasRestauradas,
        processos: dados.processos,
        documentosProcesso: dados.documentosProcesso ?? [],
        configuracoes: dados.configuracoes ?? [],
      }, { timeoutMs: 60_000, retries: 1 })

      // Mantém também o banco local em sincronia para rotinas de diagnóstico/backup.
      await db.pessoas.clear()
      await db.processos.clear()
      await db.documentosProcesso.clear()
      await db.configuracoes.clear()

      await db.pessoas.bulkAdd(pessoasRestauradas)
      await db.processos.bulkAdd(dados.processos)
      if (dados.documentosProcesso?.length) {
        await db.documentosProcesso.bulkAdd(dados.documentosProcesso as Parameters<typeof db.documentosProcesso.bulkAdd>[0])
      }
      if (dados.configuracoes?.length) {
        await db.configuracoes.bulkAdd(dados.configuracoes as Parameters<typeof db.configuracoes.bulkAdd>[0])
      }

      const novoHistorico = criarHistorico({
        origem: 'IMPORTACAO',
        nomeArquivo: arquivo.name,
        tamanhoBytes: arquivo.size,
        checksum: dados.checksum,
        pessoas: pessoasRestauradas.length,
        processos: dados.processos.length,
        documentos: dados.documentosProcesso?.length ?? 0,
        configuracoes: dados.configuracoes?.length ?? 0,
        payload: text,
      })
      await db.backupsHistorico.add(novoHistorico)
      await carregarPessoas()
      await carregarProcessos()
      await carregarDadosIniciais()
      setMensagem({ tipo: 'success', texto: `Backup restaurado com sucesso! ${pessoasRestauradas.length} pessoas e ${dados.processos.length} processos restaurados.` })
      setSenhaRestauracao('')
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao restaurar backup') })
    } finally {
      setCarregando(false)
    }
  }

  // ─── Apagar todos os dados ────────────────────────────────────────────────
  const apagarTodosDados = async () => {
    setCarregando(true)
    try {
      // Limpa o servidor via import de backup vazio (atômico)
      await api.post('/backup/import', {
        versao: '2.0',
        timestamp: new Date().toISOString(),
        pessoas: [],
        processos: [],
        documentosProcesso: [],
        configuracoes: [],
      }, { timeoutMs: 30_000, retries: 1 })

      // Limpa banco local (cache de diagnóstico)
      await db.pessoas.clear()
      await db.processos.clear()
      await db.documentosProcesso.clear()
      await db.configuracoes.clear()
      await db.backupsHistorico.clear()

      await carregarPessoas()
      await carregarProcessos()
      await carregarDadosIniciais()
      setMensagem({ tipo: 'success', texto: 'Todos os dados foram apagados.' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao apagar dados') })
    } finally {
      setCarregando(false)
      setConfirmaExclusao(false)
    }
  }

  // ─── Diagnóstico de saúde ──────────────────────────────────────────────────
  const [saude, setSaude] = useState<{ ok: boolean; mensagem: string }[] | null>(null)
  const verificarSaude = async () => {
    const checks: { ok: boolean; mensagem: string }[] = []
    try {
      const [todasPessoas, todosProcessos] = await Promise.all([
        api.get<Pessoa[]>('/pessoas'),
        api.get<Processo[]>('/processos'),
      ])
      const todosDocumentos = await carregarDocumentosApi(todosProcessos)

      checks.push({ ok: true, mensagem: `${todasPessoas.length} pessoa(s) no servidor` })
      checks.push({ ok: true, mensagem: `${todosProcessos.length} processo(s) no servidor` })
      checks.push({ ok: true, mensagem: `${todosDocumentos.length} documento(s) no servidor` })

      // Processos órfãos
      const pessoasIds = new Set(todasPessoas.map((p) => p.id))
      const processosOrfaos = todosProcessos.filter((p) => !pessoasIds.has(p.pessoaId))
      checks.push({
        ok: processosOrfaos.length === 0,
        mensagem:
          processosOrfaos.length === 0
            ? 'Nenhum processo órfão encontrado'
            : `${processosOrfaos.length} processo(s) sem pessoa vinculada`,
      })

      // Documentos órfãos
      const processosIds = new Set(todosProcessos.map((p) => p.id))
      const docsOrfaos = todosDocumentos.filter((d) => !processosIds.has(d.processoId))
      checks.push({
        ok: docsOrfaos.length === 0,
        mensagem:
          docsOrfaos.length === 0
            ? 'Nenhum documento órfão encontrado'
            : `${docsOrfaos.length} documento(s) sem processo vinculado`,
      })
    } catch (error) {
      checks.push({ ok: false, mensagem: obterMensagemErro(error, 'Erro ao verificar saúde do servidor') })
    }
    setSaude(checks)
  }

  // ─── Gerar relatório PDF ──────────────────────────────────────────────────
  const gerarRelatorioPDF = async () => {
    setCarregando(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape' })
      const empresa = nomeEmpresaSalvo || 'ÁGUIA GESTÃO'
      doc.setFontSize(18)
      doc.setTextColor(127, 29, 29)
      doc.text(empresa, 14, 18)
      doc.setFontSize(11)
      doc.setTextColor(60, 60, 60)
      doc.text(`Relatório de Processos — ${new Date().toLocaleDateString('pt-BR')}`, 14, 26)
      doc.text(`Total: ${processos.length} processos | ${pessoas.length} pessoas`, 14, 33)

      const { colunas, linhas } = montarTabelaRelatorioProcessos(processos, pessoas, incluirSenhaNoRelatorio)

      autoTable(doc, {
        startY: 40,
        head: [colunas],
        body: linhas,
        headStyles: { fillColor: [127, 29, 29] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 8, cellPadding: 2 },
      })

      doc.save(`relatorio-aguia-${new Date().toISOString().slice(0, 10)}.pdf`)
      setMensagem({ tipo: 'success', texto: 'Relatório PDF gerado!' })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao gerar PDF') })
    } finally {
      setCarregando(false)
    }
  }

  const diasDesdeBackup = ultimoBackup
    ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / 86_400_000)
    : null

  const descreverAtividadeRecente = (ultimaAtividadeIso: string) => {
    const ultima = new Date(ultimaAtividadeIso).getTime()
    const diffSeg = Math.max(0, Math.floor((Date.now() - ultima) / 1000))
    if (diffSeg < 60) return `${diffSeg}s atrás`
    const minutos = Math.floor(diffSeg / 60)
    if (minutos < 60) return `${minutos}min atrás`
    const horas = Math.floor(minutos / 60)
    return `${horas}h atrás`
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={<Settings className="w-8 h-8" />}
        title="Configurações"
        subtitle="Backup, restauração, relatórios e dados"
      />

      {diasDesdeBackup !== null && diasDesdeBackup > 7 && (
        <Alert
          type={diasDesdeBackup > 30 ? 'error' : 'warning'}
          message={`Último backup foi há ${diasDesdeBackup} dias. Recomendamos fazer backup regularmente!`}
        />
      )}

      {mensagem && <Alert type={mensagem.tipo} message={mensagem.texto} onClose={() => setMensagem(null)} />}

      {carregandoInicial && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`config-skeleton-${idx}`} className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Nome da empresa */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" /> Configurações Gerais
        </h2>
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            label="Nome da empresa / despachante"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder="Ex: Águia Gestão e Despachante"
            className="flex-1"
          />
          <div className="flex items-end md:pb-0">
            <Button onClick={() => void salvarNomeEmpresa()} disabled={nomeEmpresa === nomeEmpresaSalvo}>
              Salvar
            </Button>
          </div>
        </div>
      </div>}

      {/* Segurança */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-500" /> Segurança de Acesso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Novo PIN (4 a 8 dígitos)"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={novoPin}
            onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
            placeholder={pinConfigurado ? 'Deixe vazio para manter' : 'Obrigatório'}
            helperText={pinConfigurado ? 'PIN já configurado' : 'Nenhum PIN configurado'}
          />
          <Input
            label="Confirmar novo PIN"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={confirmarPin}
            onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Repita o PIN"
          />
          <Input
            label="Bloqueio por inatividade (minutos)"
            type="number"
            min={1}
            max={120}
            value={tempoInatividade}
            onChange={(e) => setTempoInatividade(e.target.value)}
            placeholder="Ex: 5"
          />
          <Input
            label="Token da API (opcional)"
            type="password"
            value={tokenApi}
            onChange={(e) => setTokenApi(e.target.value)}
            placeholder="Necessário se servidor usar AGUIA_API_TOKEN"
            helperText="Salvo localmente neste navegador"
          />
        </div>
        <div className="mt-4">
          <Button onClick={() => void salvarSeguranca()}>
            <ShieldCheck className="w-4 h-4" />
            Salvar segurança
          </Button>
        </div>
      </div>}

      {/* Conexões ativas */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-500" /> Dispositivos Conectados na Web
            </h2>
            <p className="text-sm text-gray-500">
              Lista de atividade recente na API. Expira após {Math.floor(ttlConexoesSegundos / 60)} min sem tráfego.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregarConexoesAtivas()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
            {conexoesAtivas.length} ativo(s)
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            TTL {Math.floor(ttlConexoesSegundos / 60)} min
          </span>
          {ultimaAtualizacaoConexoes && (
            <span className="text-xs text-gray-500">
              Atualizado às {ultimaAtualizacaoConexoes.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>

        {erroConexoes && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            {erroConexoes}
          </p>
        )}

        {carregandoConexoes ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : conexoesAtivas.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cliente ativo no momento.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {conexoesAtivas.map((conexao) => (
              <div key={conexao.ip} className="rounded-xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">IP {conexao.ip}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{conexao.totalRequisicoes} req</span>
                  <span className="text-xs text-gray-500">{descreverAtividadeRecente(conexao.ultimaAtividade)}</span>
                </div>
                <p className="text-xs text-gray-600">Última rota: {conexao.ultimoPath}</p>
                {conexao.userAgent && <p className="text-xs text-gray-500 truncate mt-1">{conexao.userAgent}</p>}
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Backup */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Download className="w-5 h-5 text-gray-500" /> Gerar Backup
        </h2>
        {ultimoBackup && (
          <p className="text-xs text-gray-500 mb-4">
            Último backup: {new Date(ultimoBackup).toLocaleDateString('pt-BR')} (há {diasDesdeBackup} dias)
          </p>
        )}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              label="Senha de proteção do backup *"
              type="password"
              value={senhaBackup}
              onChange={(e) => setSenhaBackup(e.target.value)}
              placeholder="Senha forte para criptografar"
              helperText="Necessária para restaurar. Guarde em local seguro."
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => void gerarBackup()}
              disabled={carregando || !senhaBackup.trim()}
              isLoading={carregando}
            >
              <Download className="w-4 h-4" />
              Baixar Backup
            </Button>
          </div>
        </div>
      </div>}

      {/* Restauração */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Upload className="w-5 h-5 text-gray-500" /> Restaurar Backup
        </h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          ⚠️ A restauração <strong>apaga todos os dados atuais</strong> e os substitui pelo backup.
        </p>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              label="Senha do backup *"
              type="password"
              value={senhaRestauracao}
              onChange={(e) => setSenhaRestauracao(e.target.value)}
              placeholder="Senha usada ao criar o backup"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              disabled={carregando || !senhaRestauracao.trim()}
              onClick={() => inputArquivoRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Selecionar arquivo
            </Button>
          </div>
        </div>
        <input
          ref={inputArquivoRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            if (arquivo) void restaurarBackup(arquivo)
            e.target.value = ''
          }}
        />
      </div>}

      {/* Relatório PDF */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" /> Relatório em PDF
        </h2>
        <p className="text-sm text-gray-500 mb-4">Gera um relatório PDF com todos os processos cadastrados.</p>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <input
            type="checkbox"
            checked={incluirSenhaNoRelatorio}
            onChange={(e) => setIncluirSenhaNoRelatorio(e.target.checked)}
            className="rounded border-gray-300"
          />
          Incluir senha Gov no relatório
        </label>
        <Button onClick={() => void gerarRelatorioPDF()} disabled={carregando || processos.length === 0}>
          <FileText className="w-4 h-4" />
          Gerar PDF
        </Button>
      </div>}

      {/* Diagnóstico */}
      {!carregandoInicial && <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-gray-500" /> Diagnóstico de Integridade
        </h2>
        <p className="text-sm text-gray-500 mb-4">Verifica a consistência dos dados no banco local.</p>
        <Button variant="secondary" onClick={() => void verificarSaude()}>
          <ShieldCheck className="w-4 h-4" />
          Verificar agora
        </Button>
        {saude && (
          <ul className="mt-4 space-y-2">
            {saude.map((item, idx) => (
              <li key={idx} className={`flex items-center gap-2 text-sm ${item.ok ? 'text-green-700' : 'text-red-700'}`}>
                {item.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {item.mensagem}
              </li>
            ))}
          </ul>
        )}
      </div>}

      {/* Histórico de backups */}
      {!carregandoInicial && historico.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" /> Histórico de Backups
          </h2>
          <ul className="space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 hidden sm:block" />
                <span className="font-medium text-gray-800">
                  {new Date(h.timestamp).toLocaleDateString('pt-BR')} {new Date(h.timestamp).toLocaleTimeString('pt-BR')}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 w-fit">{h.origem}</span>
                <span className="text-xs text-gray-400 sm:ml-auto">{h.pessoas} pessoas · {h.processos} processos</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Zona de perigo */}
      {!carregandoInicial && <div className="bg-red-50 rounded-2xl shadow-sm ring-1 ring-red-200 p-5">
        <h2 className="font-semibold text-red-800 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Zona de Perigo
        </h2>
        <p className="text-sm text-red-700/80 mb-4">
          Apaga TODOS os dados do sistema (pessoas, processos, documentos e configurações). Esta ação é IRREVERSÍVEL.
        </p>
        <Button variant="danger" onClick={() => setConfirmaExclusao(true)} disabled={carregando}>
          <Trash2 className="w-4 h-4" />
          Apagar todos os dados
        </Button>
      </div>}

      <ConfirmDialog
        open={confirmaExclusao}
        title="⚠️ Apagar TODOS os dados?"
        message="Esta ação é IRREVERSÍVEL. Todos os dados serão apagados permanentemente. Certifique-se de ter feito um backup antes de continuar."
        confirmText="Sim, apagar tudo"
        danger
        onConfirm={() => void apagarTodosDados()}
        onCancel={() => setConfirmaExclusao(false)}
      />
    </div>
  )
}
