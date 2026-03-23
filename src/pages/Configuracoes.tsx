import React, { useState, useEffect, useRef } from 'react'
import { db } from '../data/db'
import type { BackupHistorico, Processo, Pessoa, DocumentoProcesso, Configuracao } from '../types/models'
import { useProcessosStore } from '../stores/processosStore'
import { usePessoasStore } from '../stores/pessoasStore'
import { useConfiguracoesStore } from '../stores/configuracoesStore'
import { Button, Alert, Input, ConfirmDialog } from '../components'
import { gerarId, obterMensagemErro } from '../utils/robustness'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcularChecksum = async (dados: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dados))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const MAX_HISTORICO = 10

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
  const inputArquivoRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    void carregarDadosIniciais()
  }, [])

  const carregarDadosIniciais = async () => {
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
  }

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
      const todosDocumentos = await db.documentosProcesso.toArray()
      const todasConfiguracoes = await db.configuracoes.toArray()
      const todasPessoasBd = await db.pessoas.toArray()

      // Re-criptografa senhaGov com a senha do backup (portátil)
      const pessoasParaBackup = await Promise.all(
        todasPessoasBd.map(async (p) => {
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
        processos,
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
        processos: processos.length,
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

      // Limpa banco
      await db.pessoas.clear()
      await db.processos.clear()
      await db.documentosProcesso.clear()
      await db.configuracoes.clear()

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
    const todasPessoas = await db.pessoas.toArray()
    const todosProcessos = await db.processos.toArray()
    const todosDocumentos = await db.documentosProcesso.toArray()

    checks.push({ ok: true, mensagem: `${todasPessoas.length} pessoa(s) no banco` })
    checks.push({ ok: true, mensagem: `${todosProcessos.length} processo(s) no banco` })
    checks.push({ ok: true, mensagem: `${todosDocumentos.length} documento(s) no banco` })

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

      const linhas = processos.map((pr) => {
        const pessoa = pessoas.find((pe) => pe.id === pr.pessoaId)
        return [
          pessoa?.nome || '-',
          pessoa?.cpf || '-',
          pessoa?.senhaGov || '-',
          pr.tipo.replace(/_/g, ' '),
          pr.status.replace(/_/g, ' '),
          pr.dataAbertura
            ? new Date(pr.dataAbertura).toLocaleDateString('pt-BR')
            : '-',
          pr.dataPrazo
            ? new Date(pr.dataPrazo).toLocaleDateString('pt-BR')
            : '-',
        ]
      })

      autoTable(doc, {
        startY: 40,
        head: [['Nome', 'CPF', 'Senha Gov', 'Tipo', 'Status', 'Data de Início', 'Data de Prazo']],
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-zinc-950 via-red-950 to-black rounded-xl shadow-lg p-8 text-white border border-red-900/70">
        <div className="flex items-center gap-4">
          <div className="bg-red-900/50 rounded-lg p-3 border border-red-800/70">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-red-200 mt-1">Backup, restauração, relatórios e dados</p>
          </div>
        </div>
      </div>

      {diasDesdeBackup !== null && diasDesdeBackup > 7 && (
        <Alert
          type={diasDesdeBackup > 30 ? 'error' : 'warning'}
          message={`Último backup foi há ${diasDesdeBackup} dias. Recomendamos fazer backup regularmente!`}
        />
      )}

      {mensagem && <Alert type={mensagem.tipo} message={mensagem.texto} onClose={() => setMensagem(null)} />}

      {/* Nome da empresa */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" /> Configurações Gerais
        </h2>
        <div className="flex gap-3">
          <Input
            label="Nome da empresa / despachante"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder="Ex: Águia Gestão e Despachante"
            className="flex-1"
          />
          <div className="flex items-end">
            <Button onClick={() => void salvarNomeEmpresa()} disabled={nomeEmpresa === nomeEmpresaSalvo}>
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-white rounded-xl shadow p-5">
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
        </div>
        <div className="mt-4">
          <Button onClick={() => void salvarSeguranca()}>
            <ShieldCheck className="w-4 h-4" />
            Salvar segurança
          </Button>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-xl shadow p-5">
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
      </div>

      {/* Restauração */}
      <div className="bg-white rounded-xl shadow p-5">
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
      </div>

      {/* Relatório PDF */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" /> Relatório em PDF
        </h2>
        <p className="text-sm text-gray-500 mb-4">Gera um relatório PDF com todos os processos cadastrados.</p>
        <Button onClick={() => void gerarRelatorioPDF()} disabled={carregando || processos.length === 0}>
          <FileText className="w-4 h-4" />
          Gerar PDF
        </Button>
      </div>

      {/* Diagnóstico */}
      <div className="bg-white rounded-xl shadow p-5">
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
      </div>

      {/* Histórico de backups */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" /> Histórico de Backups
          </h2>
          <ul className="space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                <span className="flex-1">
                  {new Date(h.timestamp).toLocaleDateString('pt-BR')} {new Date(h.timestamp).toLocaleTimeString('pt-BR')} — {h.origem}
                </span>
                <span className="text-xs text-gray-400">{h.pessoas} pess. / {h.processos} proc.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Zona de perigo */}
      <div className="bg-white rounded-xl shadow border border-red-200 p-5">
        <h2 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Zona de Perigo
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Apaga TODOS os dados do sistema (pessoas, processos, documentos e configurações). Esta ação é IRREVERSÍVEL.
        </p>
        <Button variant="danger" onClick={() => setConfirmaExclusao(true)} disabled={carregando}>
          <Trash2 className="w-4 h-4" />
          Apagar todos os dados
        </Button>
      </div>

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
