import React, { useEffect, useMemo } from 'react'
import { Users, FileText, CheckCircle, AlertCircle, BarChart3, Settings, Bell } from 'lucide-react'
import { Button, PageHeader, Skeleton, BackgroundSyncBadge, Alert } from '../components'
import { usePessoasStore } from '../stores/pessoasStore'
import { useProcessosStore } from '../stores/processosStore'
import { useConfiguracoesStore } from '../stores/configuracoesStore'
import { StatusProcesso } from '../types/models'
import { formatarData, calcularDiasRestantes } from '../utils/constants'

const MS_POR_DIA = 1000 * 60 * 60 * 24

const calcularDiasDesdeBackup = (ultimoBackup: string | null): number | null => {
  if (!ultimoBackup) return null

  const timestamp = new Date(ultimoBackup).getTime()
  if (!Number.isFinite(timestamp)) return null

  const dataUltimoBackup = new Date(timestamp)
  const hoje = new Date()
  const inicioDiaUltimoBackup = new Date(
    dataUltimoBackup.getFullYear(),
    dataUltimoBackup.getMonth(),
    dataUltimoBackup.getDate(),
  ).getTime()
  const inicioDiaAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()

  return Math.max(0, Math.floor((inicioDiaAtual - inicioDiaUltimoBackup) / MS_POR_DIA))
}

interface DashboardProps {
  onNavigate: (page: string) => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { pessoas, carregarPessoas, carregando: carregandoPessoas, erro: erroPessoas } = usePessoasStore()
  const { processos, carregarProcessos, carregando: carregandoProcessos, erro: erroProcessos } = useProcessosStore()
  const erroConexao = Boolean(erroPessoas || erroProcessos)
  const { obterConfiguracao } = useConfiguracoesStore()
  const [ultimoBackup, setUltimoBackup] = React.useState<string | null>(null)
  const carregandoInicial = Boolean(carregandoPessoas || carregandoProcessos) && pessoas.length === 0 && processos.length === 0
  const atualizandoEmSegundoPlano = Boolean(carregandoPessoas || carregandoProcessos) && !carregandoInicial

  useEffect(() => {
    void carregarPessoas()
    void carregarProcessos()
  }, [carregarPessoas, carregarProcessos])

  useEffect(() => {
    let ativo = true

    const carregarUltimoBackup = async () => {
      try {
        const valor = await obterConfiguracao('ultimoBackup')
        if (!ativo) return
        setUltimoBackup(typeof valor === 'string' && valor.trim() ? valor : null)
      } catch {
        if (!ativo) return
        setUltimoBackup(null)
      }
    }

    const recarregarSeVisivel = () => {
      if (document.visibilityState === 'visible') {
        void carregarUltimoBackup()
      }
    }

    void carregarUltimoBackup()
    window.addEventListener('focus', recarregarSeVisivel)
    document.addEventListener('visibilitychange', recarregarSeVisivel)

    return () => {
      ativo = false
      window.removeEventListener('focus', recarregarSeVisivel)
      document.removeEventListener('visibilitychange', recarregarSeVisivel)
    }
  }, [obterConfiguracao])

  const stats = useMemo(() => {
    const total = processos.length
    const abertos = processos.filter((p) =>
      [StatusProcesso.ABERTO, StatusProcesso.EM_ANALISE, StatusProcesso.PRONTO_PARA_PROTOCOLO,
       StatusProcesso.AGUARDANDO_PAGAMENTO_GRU].includes(p.status),
    ).length
    const deferidos = processos.filter((p) => p.status === StatusProcesso.DEFERIDO).length
    const restituidos = processos.filter((p) => p.status === StatusProcesso.RESTITUIDO).length
    const vencidos = processos.filter((p) => {
      if (!p.dataPrazo) return false
      const dias = calcularDiasRestantes(p.dataPrazo)
      return dias !== null && dias < 0 &&
        ![StatusProcesso.DEFERIDO, StatusProcesso.FINALIZADO, StatusProcesso.RESTITUIDO, StatusProcesso.ENTREGUE_AO_CLIENTE].includes(p.status)
    }).length
    const percentualAprovacao = total > 0 ? Math.round((deferidos / total) * 100) : 0
    return { total, abertos, deferidos, restituidos, vencidos, percentualAprovacao }
  }, [processos])

  const diasSemBackup = calcularDiasDesdeBackup(ultimoBackup)

  const processosRecentes = useMemo(
    () =>
      [...processos]
        .sort((a, b) => new Date(b.dataCadastro).getTime() - new Date(a.dataCadastro).getTime())
        .slice(0, 5),
    [processos],
  )

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        icon={<BarChart3 className="w-8 h-8" />}
        title="Águia Gestão"
        subtitle="Sistema de Gestão de Processos Administrativos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BackgroundSyncBadge active={atualizandoEmSegundoPlano} erro={erroConexao} />
            {diasSemBackup !== null && diasSemBackup >= 7 ? (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 text-amber-800 text-xs font-semibold shadow-sm">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Backup há {diasSemBackup} dias — faça um agora!
              </div>
            ) : null}
          </div>
        }
      />

      {/* Alerta de erro de conexão */}
      {erroConexao && (
        <Alert type="error" message={erroPessoas || erroProcessos || 'Erro ao conectar com o servidor'} />
      )}

      {/* Cards KPI */}
      {carregandoInicial ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[{w: 'w-20'}, {w: 'w-24'}, {w: 'w-16'}, {w: 'w-28'}].map((s, idx) => (
            <div key={`kpi-skeleton-${idx}`} className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
              <Skeleton className="h-9 w-9 rounded-xl mb-4" />
              <Skeleton className={`h-7 ${s.w} mb-2`} />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="p-2.5 rounded-xl bg-blue-50 w-fit mb-4">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{pessoas.length}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1.5">Pessoas</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="p-2.5 rounded-xl bg-purple-50 w-fit mb-4">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{stats.total}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1.5">Processos</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="p-2.5 rounded-xl bg-green-50 w-fit mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{stats.deferidos}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1.5">Deferidos</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            <div className="p-2.5 rounded-xl bg-red-50 w-fit mb-4">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{stats.vencidos}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-1.5">Vencidos</p>
          </div>
        </div>
      )}

      {/* Alerta de backup */}
      {diasSemBackup === null && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Nenhum backup exportado ainda</p>
            <p className="text-xs text-amber-700 mt-0.5">Exporte seus dados regularmente para evitar perda de informações.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('configuracoes')} className="text-amber-700 hover:text-amber-900 text-xs flex-shrink-0">
            Fazer backup →
          </Button>
        </div>
      )}

      {/* Resumo e Ações rápidas */}
      {carregandoInicial ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Resumo */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <BarChart3 className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Resumo</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-500 font-medium">Taxa de aprovação</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">{stats.percentualAprovacao}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
                    style={{ width: `${stats.percentualAprovacao}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Abertos</p>
                  <p className="text-xl font-bold text-blue-800 tabular-nums mt-0.5">{stats.abertos}</p>
                </div>
                <div className="bg-orange-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Restituídos</p>
                  <p className="text-xl font-bold text-orange-800 tabular-nums mt-0.5">{stats.restituidos}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card Ações Rápidas */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Settings className="w-4 h-4 text-gray-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Ações Rápidas</h2>
            </div>
            <div className="space-y-2">
              <Button variant="primary" className="w-full justify-start" onClick={() => onNavigate('pessoas')}>
                <Users className="w-4 h-4" />
                Gerenciar Pessoas
              </Button>
              <Button variant="primary" className="w-full justify-start" onClick={() => onNavigate('processos')}>
                <FileText className="w-4 h-4" />
                Gerenciar Processos
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => onNavigate('configuracoes')}>
                <Settings className="w-4 h-4" />
                Configurações e Backup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processos recentes */}
      {processosRecentes.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gray-100">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Processos Recentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="text-left py-2.5 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nome</th>
                  <th scope="col" className="text-left py-2.5 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cadastro</th>
                  <th scope="col" className="text-left py-2.5 px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {processosRecentes.map((p) => {
                  const pessoa = pessoas.find((pes) => pes.id === p.pessoaId)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-5 text-gray-800 font-medium">{pessoa?.nome || '(pessoa não encontrada)'}</td>
                      <td className="py-3 px-5 text-gray-500 tabular-nums">{formatarData(p.dataCadastro)}</td>
                      <td className="py-3 px-5 text-gray-500 tabular-nums">{p.dataPrazo ? formatarData(p.dataPrazo) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-700">Nenhum processo cadastrado ainda</p>
          <p className="text-sm text-gray-400 mt-1.5">Cadastre um processo para começar a acompanhar pelo dashboard.</p>
          <Button className="mt-5" onClick={() => onNavigate('processos')}>Ir para Processos</Button>
        </div>
      )}
    </div>
  )
}
