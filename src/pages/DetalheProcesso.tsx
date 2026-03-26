import React, { useState, useEffect, useCallback, useRef } from 'react'
import { TipoProcesso, StatusProcesso, StatusDocumento } from '../types/models'
import type { DocumentoProcesso } from '../types/models'
import { useDocumentosStore } from '../stores/documentosStore'
import { useProcessosStore } from '../stores/processosStore'
import { usePessoasStore } from '../stores/pessoasStore'
import { Button, Alert, PageHeader, Skeleton, BackgroundSyncBadge } from '../components'
import {
  nomesTipoProcesso,
  nomesStatusProcesso,
  nomesStatusDocumento,
  coresStatusDocumento,
  formatarData,
} from '../utils/constants'
import { obterMensagemErro } from '../utils/robustness'
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Clock, RefreshCw, Printer } from 'lucide-react'

// ─── Documentos exigidos por tipo de processo ─────────────────────────────────
const DOCUMENTOS_POR_TIPO: Record<TipoProcesso, string[]> = {
  [TipoProcesso.AQUISICAO_ARMA_SINARM]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante bancário de pagamento da taxa',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa',
    'Documento de Identificação Pessoal',
    'EFETIVA NECESSIDADE',
    'Foto 3x4 recente',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Procuração',
    'Requerimento SINARM Assinado',
  ],
  [TipoProcesso.REGISTRO_SINARM]: [
    'Documento de Identificação Pessoal',
    'Autorizar aquisição de arma de fogo',
    'Nota Fiscal',
    'Requerimento SINARM Assinado',
  ],
  [TipoProcesso.RENOVACAO_REGISTRO_SINARM]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante bancário de pagamento da taxa',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa',
    'Documento de Identificação Pessoal',
    'EFETIVA NECESSIDADE',
    'Foto 3x4 recente',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Procuração',
    'Requerimento SINARM Assinado',
    'REGISTRO ARMA',
  ],
  [TipoProcesso.AQUISICAO_ARMA_CR_ATIRADOR]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa (5 ANOS)',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Declaração de Segurança do Acervo (ESPECIFICO PARA COMPRA)',
    'Documento de Identificação Pessoal',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Modelo, Marca e loja',
    'Comprovante de habitualidade na forma da norma vigente',
  ],
  [TipoProcesso.AQUISICAO_ARMA_CR_CACADOR]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de filiação a entidade de tiro desportivo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa (5 ANOS)',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Declaração de Segurança do Acervo (ESPECIFICO PARA COMPRA)',
    'Documento de Identificação Pessoal',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Modelo, Marca e loja',
  ],
  [TipoProcesso.CRAF_CR]: [
    'Documento de Identificação Pessoal',
    'Autorizar aquisição de arma de fogo',
    'Nota Fiscal',
  ],
  [TipoProcesso.RENOVACAO_CRAF_CR]: [
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Certidão de Antecedente Criminal Justiça Federal',
    'Certidão de Antecedente Criminal Justiça Estadual',
    'Certidão de Antecedente Criminal Justiça Militar',
    'Certidão de Antecedente Criminal Justiça Eleitoral',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Documento de Identificação Pessoal',
    'Comprovante de Residência Fixa (5 ANOS)',
    'Declaração de Segurança do Acervo (ESPECIFICO PARA COMPRA)',
    'Comprovante de Ocupação Lícita',
    'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama',
    'Comprovante de filiação a entidade de tiro desportivo',
    'Comprovante de habitualidade na forma da norma vigente',
  ],
  [TipoProcesso.GUIA_TRAFEGO_CACA]: [
    'Comprovante de filiação a entidade de tiro desportivo',
    'Dados da arma correspondentes à respectiva guia',
    'Documento de Identificação Pessoal',
    'Autorização de manejo de caça emitida pelo IBAMA, acompanhada do CAR da respectiva fazenda',
  ],
  [TipoProcesso.GUIA_TRAFEGO_MUDANCA_ACERVO]: [
    'Comprovante de Residência Fixa',
    'Dados da arma correspondentes à respectiva guia',
    'Dados, Endereço de origem e endereço de destino',
    'Documento de Identificação Pessoal',
  ],
  [TipoProcesso.GUIA_TRAFEGO_RECUPERACAO]: [
    'Dados da arma correspondentes à respectiva guia',
    'Documento de Identificação Pessoal',
    'Documento de regularização ou restituição da arma de fogo',
  ],
  [TipoProcesso.GUIA_TRAFEGO_TIRO]: [
    'Dados da arma correspondentes à respectiva guia',
    'Documento de Identificação Pessoal',
    'Dados do clube de destino',
  ],
  [TipoProcesso.GUIA_TRAFEGO_SINARM]: [
    'Comprovante de Residência Fixa',
    'Documento de Identificação Pessoal',
    'Documento que comprove a necessidade da emissão da guia',
    'Registro da arma',
  ],
  [TipoProcesso.TRANSFERENCIA_ARMA_CR]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa (5 ANOS)',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
    'Anexo M de transferência - assinada pelas partes',
    'Termo de transferência de propriedade da arma de fogo',
  ],
  [TipoProcesso.CR_ATIRADOR_CACADOR]: [
    'Certidão de Antecedentes Criminais',
    'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama',
    'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
    'Comprovante de filiação a entidade de tiro desportivo',
    'Comprovante de Ocupação Lícita',
    'Comprovante de Residência Fixa (5 ANOS)',
    'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
    'Declaração de Segurança do Acervo',
    'Documento de Identificação Pessoal',
    'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
  ],
}

// ─── Ícones de status ─────────────────────────────────────────────────────────
const IconeStatus: React.FC<{ status: StatusDocumento }> = ({ status }) => {
  switch (status) {
    case StatusDocumento.ENTREGUE: return <CheckCircle className="w-5 h-5 text-green-600" />
    case StatusDocumento.REJEITADO: return <XCircle className="w-5 h-5 text-red-600" />
    case StatusDocumento.NAO_APLICAVEL: return <MinusCircle className="w-5 h-5 text-gray-400" />
    default: return <Clock className="w-5 h-5 text-amber-500" />
  }
}

interface DetalheProcessoProps {
  processoId: string
  onVoltar?: () => void
}

export const DetalheProcesso: React.FC<DetalheProcessoProps> = ({ processoId, onVoltar }) => {
  const { processos, atualizarProcesso, atualizarStatusProcesso, carregarProcessos, erro: erroProcessos } = useProcessosStore()
  const { pessoas, carregarPessoas, erro: erroPessoas } = usePessoasStore()
  const {
    documentosProcesso,
    carregando: carregandoDocumentos,
    carregarDocumentosPorProcesso,
    adicionarDocumentoProcesso,
    atualizarDocumentoProcesso,
    atualizarStatusDocumento,
    deletarDocumentoProcesso,
  } =
    useDocumentosStore()
  const [sincronizando, setSincronizando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [observacoesProcesso, setObservacoesProcesso] = useState('')
  const [observacoesDraft, setObservacoesDraft] = useState<Record<string, string>>({})
  const sincronizacaoEmAndamentoRef = useRef(false)
  const autoSyncExecutadaRef = useRef(false)

  const processo = processos.find((p) => p.id === processoId)
  const pessoa = processo ? pessoas.find((pe) => pe.id === processo.pessoaId) : undefined
  const carregandoInicialChecklist = Boolean(carregandoDocumentos) && documentosProcesso.length === 0
  const atualizandoEmSegundoPlano = Boolean(carregandoDocumentos) && !carregandoInicialChecklist

  const normalizarNomeChecklist = (valor: string): string =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

  useEffect(() => {
    void carregarProcessos()
    void carregarPessoas()
    void carregarDocumentosPorProcesso(processoId)
  }, [processoId, carregarProcessos, carregarPessoas, carregarDocumentosPorProcesso])

  useEffect(() => {
    const sincronizar = () => {
      if (document.hidden) return
      void carregarProcessos()
      void carregarDocumentosPorProcesso(processoId)
    }
    const timer = window.setInterval(sincronizar, 5000)
    return () => window.clearInterval(timer)
  }, [processoId, carregarProcessos, carregarDocumentosPorProcesso])

  useEffect(() => {
    const aoVoltarParaAba = () => {
      if (document.hidden) return
      void carregarProcessos()
      void carregarDocumentosPorProcesso(processoId)
    }
    document.addEventListener('visibilitychange', aoVoltarParaAba)
    return () => document.removeEventListener('visibilitychange', aoVoltarParaAba)
  }, [processoId, carregarProcessos, carregarDocumentosPorProcesso])

  useEffect(() => {
    setObservacoesProcesso(processo?.observacoes || '')
  }, [processo?.id, processo?.observacoes])

  // Sincroniza documentos do checklist com o banco (deduplica, adiciona faltantes)
  const sincronizarChecklist = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!processo || sincronizacaoEmAndamentoRef.current) return
    sincronizacaoEmAndamentoRef.current = true
    setSincronizando(true)
    try {
      const nomesPadrao = DOCUMENTOS_POR_TIPO[processo.tipo] ?? []

      // Normaliza nomes para deduplicação
      const prioridadeStatus: Record<StatusDocumento, number> = {
        [StatusDocumento.ENTREGUE]: 4,
        [StatusDocumento.NAO_APLICAVEL]: 3,
        [StatusDocumento.REJEITADO]: 2,
        [StatusDocumento.PENDENTE]: 1,
      }
      const mapaNomeCanonico = new Map<string, string>(
        nomesPadrao.map((nome) => [normalizarNomeChecklist(nome), nome]),
      )
      const nomesPadraoSet = new Set(mapaNomeCanonico.keys())

      // Recarrega do banco para deduplicar com base no estado persistido mais recente.
      await carregarDocumentosPorProcesso(processoId)
      const docsPersistidos = [...useDocumentosStore.getState().documentosProcesso]

      const porNomeNormalizado = new Map<string, DocumentoProcesso>()
      const duplicadosParaRemover: DocumentoProcesso[] = []
      const indevidosParaRemover: DocumentoProcesso[] = []

      for (const doc of docsPersistidos) {
        const chave = normalizarNomeChecklist(doc.nome)
        if (!nomesPadraoSet.has(chave)) {
          indevidosParaRemover.push(doc)
          continue
        }
        const existente = porNomeNormalizado.get(chave)
        if (!existente) {
          porNomeNormalizado.set(chave, doc)
          continue
        }
        const manterAtual = prioridadeStatus[doc.status] > prioridadeStatus[existente.status]
        if (manterAtual) {
          duplicadosParaRemover.push(existente)
          porNomeNormalizado.set(chave, doc)
        } else {
          duplicadosParaRemover.push(doc)
        }
      }

      for (const duplicado of duplicadosParaRemover) {
        await deletarDocumentoProcesso(duplicado.id)
      }

      for (const indevido of indevidosParaRemover) {
        await deletarDocumentoProcesso(indevido.id)
      }

      for (const [chave, doc] of porNomeNormalizado.entries()) {
        const nomeCanonico = mapaNomeCanonico.get(chave)
        if (nomeCanonico && doc.nome !== nomeCanonico) {
          await atualizarDocumentoProcesso(doc.id, {
            nome: nomeCanonico,
            documentoId: `req-${chave}`,
          })
        }
      }

      const jaCriados = new Set(Array.from(porNomeNormalizado.values()).map((d) => normalizarNomeChecklist(d.nome)))

      for (const nome of nomesPadrao) {
        if (!jaCriados.has(normalizarNomeChecklist(nome))) {
          await adicionarDocumentoProcesso({
            processoId,
            documentoId: `req-${normalizarNomeChecklist(nome)}`,
            nome,
            status: StatusDocumento.PENDENTE,
            dataEntrega: undefined,
            observacoes: '',
          })
          jaCriados.add(normalizarNomeChecklist(nome))
        }
      }
      await carregarDocumentosPorProcesso(processoId)
      const removidos = duplicadosParaRemover.length + indevidosParaRemover.length
      const textoResultado = removidos > 0
        ? `Checklist sincronizado! ${removidos} item(ns) inconsistente(s) removido(s).`
        : 'Checklist sincronizado!'
      if (!opts?.silencioso) {
        setMensagem({ tipo: 'success', texto: textoResultado })
      }
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao sincronizar checklist') })
    } finally {
      sincronizacaoEmAndamentoRef.current = false
      setSincronizando(false)
    }
  }, [processo, processoId, carregarDocumentosPorProcesso, adicionarDocumentoProcesso, deletarDocumentoProcesso, atualizarDocumentoProcesso])

  // Ao abrir detalhe, sincroniza automaticamente uma vez para corrigir checklist.
  useEffect(() => {
    autoSyncExecutadaRef.current = false
  }, [processoId])

  useEffect(() => {
    if (!processo || sincronizando || autoSyncExecutadaRef.current) return
    autoSyncExecutadaRef.current = true
    void sincronizarChecklist({ silencioso: true })
  }, [processo, sincronizando, sincronizarChecklist])

  // Fallback se continuar vazio após auto-sync.
  useEffect(() => {
    if (processo && documentosProcesso.length === 0 && !sincronizando) {
      void sincronizarChecklist({ silencioso: true })
    }
  }, [processo, documentosProcesso.length, sincronizando, sincronizarChecklist])

  // Verifica se pode auto-avançar status para PRONTO_PARA_PROTOCOLO
  useEffect(() => {
    if (!processo) return
    if (processo.status !== StatusProcesso.ABERTO && processo.status !== StatusProcesso.EM_ANALISE) return
    if (documentosProcesso.length === 0) return
    const todosConcluidos = documentosProcesso.every(
      (d) => d.status === StatusDocumento.ENTREGUE || d.status === StatusDocumento.NAO_APLICAVEL,
    )
    if (todosConcluidos) {
      void atualizarStatusProcesso(processoId, StatusProcesso.PRONTO_PARA_PROTOCOLO)
    }
  }, [documentosProcesso, processo, atualizarStatusProcesso, processoId])

  const handleStatusDoc = async (docId: string, novoStatus: StatusDocumento) => {
    try {
      await atualizarStatusDocumento(docId, novoStatus)
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao atualizar documento') })
    }
  }

  const salvarObservacoesProcesso = async () => {
    const textoDraft = observacoesProcesso.trim()
    const textoAtual = (processo?.observacoes || '').trim()
    if (!processo || textoDraft === textoAtual) return

    try {
      await atualizarProcesso(processo.id, { observacoes: textoDraft })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar observações do processo') })
    }
  }

  useEffect(() => {
    setObservacoesDraft((atual) => {
      const proximo = { ...atual }
      let alterou = false

      documentosProcesso.forEach((doc) => {
        if (!(doc.id in proximo)) {
          proximo[doc.id] = doc.observacoes || ''
          alterou = true
        }
      })

      Object.keys(proximo).forEach((docId) => {
        if (!documentosProcesso.some((doc) => doc.id === docId)) {
          delete proximo[docId]
          alterou = true
        }
      })

      return alterou ? proximo : atual
    })
  }, [documentosProcesso])

  const salvarObservacoesDoc = async (docId: string) => {
    const doc = documentosProcesso.find((item) => item.id === docId)
    if (!doc) return

    const textoDraft = (observacoesDraft[docId] || '').trim()
    const textoAtual = (doc.observacoes || '').trim()
    if (textoDraft === textoAtual) return

    try {
      await atualizarDocumentoProcesso(docId, { observacoes: textoDraft })
    } catch (error) {
      setMensagem({ tipo: 'error', texto: obterMensagemErro(error, 'Erro ao salvar observações do documento') })
    }
  }

  // Cálculo de progresso
  const total = documentosProcesso.length
  const entregues = documentosProcesso.filter((d) => d.status === StatusDocumento.ENTREGUE).length
  const naoAplicavel = documentosProcesso.filter((d) => d.status === StatusDocumento.NAO_APLICAVEL).length
  const concluidos = entregues + naoAplicavel
  const porcentagem = total > 0 ? Math.round((concluidos / total) * 100) : 0

  const documentosOrdenados = (() => {
    if (!processo) return []
    const ordemPadrao = DOCUMENTOS_POR_TIPO[processo.tipo] ?? []
    const posicaoPorChave = new Map<string, number>(
      ordemPadrao.map((nome, indice) => [normalizarNomeChecklist(nome), indice]),
    )
    return [...documentosProcesso].sort((a, b) => {
      const indiceA = posicaoPorChave.get(normalizarNomeChecklist(a.nome))
      const indiceB = posicaoPorChave.get(normalizarNomeChecklist(b.nome))
      if (indiceA === undefined && indiceB === undefined) {
        return a.nome.localeCompare(b.nome, 'pt-BR')
      }
      if (indiceA === undefined) return 1
      if (indiceB === undefined) return -1
      return indiceA - indiceB
    })
  })()

  const imprimirChecklist = () => {
    if (!processo || !pessoa) return
    const linhas = documentosOrdenados.map((d) => `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.nome}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${nomesStatusDocumento[d.status]}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${d.dataEntrega ? new Date(d.dataEntrega).toLocaleDateString('pt-BR') : '-'}</td>
    </tr>`).join('')
    const html = `<html><head><meta charset="utf-8"><title>Checklist</title><style>body{font-family:Arial,sans-serif;font-size:13px}table{width:100%;border-collapse:collapse}th{background:#7f1d1d;color:#fff;padding:8px 10px;text-align:left}</style></head>
    <body>
    <h2 style="color:#7f1d1d;">ÁGUIA GESTÃO — Checklist de Documentos</h2>
    <p><strong>Processo:</strong> ${nomesTipoProcesso[processo.tipo]} | <strong>Nº:</strong> ${processo.numero || '-'} | <strong>Status:</strong> ${nomesStatusProcesso[processo.status]}</p>
    <p><strong>Pessoa:</strong> ${pessoa.nome} | <strong>CPF:</strong> ${pessoa.cpf}</p>
    <p><strong>Progresso:</strong> ${concluidos}/${total} documentos (${porcentagem}%)</p>
    <table><thead><tr><th>Documento</th><th>Status</th><th>Data Entrega</th></tr></thead><tbody>${linhas}</tbody></table>
    <p style="margin-top:20px;font-size:11px;color:#999;">Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
    </body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  if (!processo) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Processo não encontrado.</p>
        {onVoltar && <Button onClick={onVoltar} className="mt-4">Voltar</Button>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={
          onVoltar ? (
            <button onClick={onVoltar} className="text-white/70 hover:text-white transition-colors" title="Voltar">
              <ArrowLeft className="w-8 h-8" />
            </button>
          ) : (
            <ArrowLeft className="w-8 h-8" />
          )
        }
        title={nomesTipoProcesso[processo.tipo]}
        subtitle={
          <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
            <span>{pessoa?.nome || 'Pessoa não encontrada'}</span>
            <span className="hidden sm:inline"> · </span>
            <span className="font-mono text-xs">{pessoa?.cpf || '-'}</span>
            {processo.numero && <><span className="hidden sm:inline"> · </span><span>Nº {processo.numero}</span></>}
            {processo.dataPrazo && <><span className="hidden sm:inline"> · </span><span>Prazo: {formatarData(processo.dataPrazo)}</span></>}
          </span>
        }
        actions={
          <div className="flex gap-2 flex-wrap">
            <BackgroundSyncBadge active={atualizandoEmSegundoPlano} erro={Boolean(erroProcessos || erroPessoas)} />
            <button
              onClick={imprimirChecklist}
              title="Imprimir checklist"
              aria-label="Imprimir checklist"
              className="flex items-center gap-1 text-xs sm:text-sm bg-white/10 border border-white/20 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={() => void sincronizarChecklist()}
              disabled={sincronizando}
              title="Sincronizar checklist"
              aria-label="Sincronizar checklist"
              className="flex items-center gap-1 text-xs sm:text-sm bg-white/10 border border-white/20 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
          </div>
        }
      />

      {mensagem && <Alert type={mensagem.tipo} message={mensagem.texto} onClose={() => setMensagem(null)} />}

      {/* Barra de progresso */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Progresso da documentação</p>
          <p className="text-sm font-bold text-gray-900">{concluidos}/{total} ({porcentagem}%)</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${porcentagem === 100 ? 'bg-green-500' : porcentagem >= 60 ? 'bg-amber-500' : 'bg-red-600'}`}
            style={{ width: `${porcentagem}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-600" /> {entregues} entregue(s)</span>
          <span className="flex items-center gap-1"><MinusCircle className="w-3.5 h-3.5 text-gray-400" /> {naoAplicavel} não aplicável</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> {total - concluidos} pendente(s)</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-gray-800">Observações do processo</h2>
          <p className="text-xs text-gray-500 mt-0.5">Mesmo campo usado em Credenciais e no formulário de Novo Processo.</p>
        </div>
        <textarea
          value={observacoesProcesso}
          onChange={(e) => setObservacoesProcesso(e.target.value)}
          onBlur={() => void salvarObservacoesProcesso()}
          placeholder="Registre aqui observações gerais deste processo..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 resize-y min-h-[110px]"
        />
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-800">Documentos exigidos</h2>
          <p className="text-xs text-gray-500 mt-1">Atualize o status e registre observações em cada documento para manter o histórico completo.</p>
        </div>
        {carregandoInicialChecklist ? (
          <div className="p-8 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : documentosProcesso.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className={`w-10 h-10 mx-auto mb-3 text-gray-300 ${sincronizando ? 'animate-spin' : ''}`} />
            <p>{sincronizando ? 'Sincronizando...' : 'Nenhum documento encontrado'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {documentosOrdenados.map((doc) => (
              <li key={doc.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <IconeStatus status={doc.status} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${doc.status === StatusDocumento.NAO_APLICAVEL ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {doc.nome}
                        </p>
                        {doc.dataEntrega && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Entregue em {new Date(doc.dataEntrega).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {([StatusDocumento.PENDENTE, StatusDocumento.ENTREGUE, StatusDocumento.REJEITADO, StatusDocumento.NAO_APLICAVEL] as StatusDocumento[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => void handleStatusDoc(doc.id, s)}
                            title={nomesStatusDocumento[s]}
                            aria-label={`${nomesStatusDocumento[s]}: ${doc.nome}`}
                            className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${doc.status === s ? coresStatusDocumento[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                          >
                            {s === StatusDocumento.PENDENTE ? '?' : s === StatusDocumento.ENTREGUE ? '✓' : s === StatusDocumento.REJEITADO ? '✗' : 'N/A'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`obs-doc-${doc.id}`} className="block text-xs font-medium text-gray-500 mb-1">
                        Observações
                      </label>
                      <textarea
                        id={`obs-doc-${doc.id}`}
                        value={observacoesDraft[doc.id] ?? ''}
                        onChange={(e) => {
                          const texto = e.target.value
                          setObservacoesDraft((atual) => ({ ...atual, [doc.id]: texto }))
                        }}
                        onBlur={() => void salvarObservacoesDoc(doc.id)}
                        placeholder="Anote pendências, retorno do cliente ou detalhes deste documento..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-y min-h-[72px]"
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
