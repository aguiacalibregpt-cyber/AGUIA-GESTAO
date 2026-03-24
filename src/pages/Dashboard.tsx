import React, { useEffect, useMemo } from 'react'
import { Users, FileText, CheckCircle, AlertCircle, BarChart3, Settings, Bell } from 'lucide-react'
import { Button, PageHeader, Skeleton, BackgroundSyncBadge, Alert } from '../components'
import { usePessoasStore } from '../stores/pessoasStore'
import { useProcessosStore } from '../stores/processosStore'
import { useConfiguracoesStore } from '../stores/configuracoesStore'
import { StatusProcesso } from '../types/models'
import { formatarData, calcularDiasRestantes } from '../utils/constants'

const MS_POR_DIA = 1000 * 60 * 60 * 24

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
    const carregarUltimoBackup = async () => {
      try {
        const valor = await obterConfiguracao('ultimoBackup')
        setUltimoBackup(typeof valor === 'string' && valor.trim() ? valor : null)
      } catch {
        setUltimoBackup(null)
      }
    }
    void carregarUltimoBackup()
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

  const diasSemBackup = ultimoBackup
    ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / MS_POR_DIA)
    : null

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
              <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 text-amber-900 text-xs font-medium shadow-sm">
                <Bell className="w-4 h-4" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[{w: 'w-20'}, {w: 'w-24'}, {w: 'w-16'}, {w: 'w-28'}].map((s, idx) => (
            <div key={`kpi-skeleton-${idx}`} className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
              <Skeleton className={`h-3 ${s.w} mb-4`} />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 border-t-4 border-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Pessoas</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{pessoas.length}</p>
            </div>
            <Users className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 border-t-4 border-purple-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Processos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <FileText className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 border-t-4 border-green-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Deferidos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.deferidos}</p>
            </div>
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5 border-t-4 border-red-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Vencidos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.vencidos}</p>
            </div>
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
        </div>
      </div>
      )}

      {/* Alerta de backup */}
      {diasSemBackup === null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Bell className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Nenhum backup exportado ainda</p>
            <p className="text-xs text-amber-700">Exporte seus dados regularmente para evitar perda de informações.</p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate('configuracoes')} className="text-amber-700 hover:text-amber-900 text-xs">
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
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">Resumo</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Taxa de aprovação</span>
              <span className="font-bold text-gray-900">{stats.percentualAprovacao}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.percentualAprovacao}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-gray-600">
              <div>Abertos: <span className="font-semibold text-gray-900">{stats.abertos}</span></div>
              <div>Restituídos: <span className="font-semibold text-gray-900">{stats.restituidos}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-4">Ações Rápidas</h2>
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
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-5">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-4">Processos Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Número</th>
                  <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Cadastro</th>
                  <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {processosRecentes.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 text-gray-800 font-medium">{p.numero || '(sem número)'}</td>
                    <td className="py-2 px-3 text-gray-600">{formatarData(p.dataCadastro)}</td>
                    <td className="py-2 px-3 text-gray-600">{p.dataPrazo ? formatarData(p.dataPrazo) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-black/5 p-10 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">Nenhum processo cadastrado ainda</p>
          <p className="text-sm text-gray-500 mt-1">Cadastre um processo para começar a acompanhar pelo dashboard.</p>
          <Button className="mt-4" onClick={() => onNavigate('processos')}>Ir para Processos</Button>
        </div>
      )}
    </div>
  )
}
