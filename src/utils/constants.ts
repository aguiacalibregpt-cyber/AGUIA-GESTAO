import { TipoProcesso, StatusProcesso, StatusDocumento } from '../types/models'

export const nomesTipoProcesso: Record<TipoProcesso, string> = {
  [TipoProcesso.AQUISICAO_ARMA_SINARM]: 'Aquisição de Arma de Fogo SINARM',
  [TipoProcesso.REGISTRO_SINARM]: 'Registro SINARM',
  [TipoProcesso.RENOVACAO_REGISTRO_SINARM]: 'Renovação de Registro SINARM',
  [TipoProcesso.AQUISICAO_ARMA_CR_ATIRADOR]: 'Aquisição de Arma de Fogo CR (Acervo de Atirador)',
  [TipoProcesso.AQUISICAO_ARMA_CR_CACADOR]: 'Aquisição de Arma de Fogo CR (Acervo de Caçador)',
  [TipoProcesso.CRAF_CR]: 'CRAF CR',
  [TipoProcesso.RENOVACAO_CRAF_CR]: 'Renovação de CRAF CR',
  [TipoProcesso.GUIA_TRAFEGO_CACA]: 'Guia de Tráfego (Caça)',
  [TipoProcesso.GUIA_TRAFEGO_MUDANCA_ACERVO]: 'Guia de Tráfego (Mudança de Acervo)',
  [TipoProcesso.GUIA_TRAFEGO_RECUPERACAO]: 'Guia de Tráfego (Recuperação)',
  [TipoProcesso.GUIA_TRAFEGO_TIRO]: 'Guia de Tráfego (Tiro)',
  [TipoProcesso.GUIA_TRAFEGO_SINARM]: 'Guia de Tráfego SINARM',
  [TipoProcesso.TRANSFERENCIA_ARMA_CR]: 'Transferência de Arma de Fogo CR',
  [TipoProcesso.CR_ATIRADOR_CACADOR]: 'CR Atirador e Caçador (Concessão e Apostilamento)',
}

export const nomesStatusProcesso: Record<StatusProcesso, string> = {
  [StatusProcesso.ABERTO]: 'Aberto',
  [StatusProcesso.EM_ANALISE]: 'Em Análise',
  [StatusProcesso.PRONTO_PARA_PROTOCOLO]: 'Pronto para Protocolo',
  [StatusProcesso.AGUARDANDO_PAGAMENTO_GRU]: 'Aguardando Pagamento GRU',
  [StatusProcesso.DEFERIDO]: 'Deferido',
  [StatusProcesso.INDEFERIDO]: 'Indeferido',
  [StatusProcesso.ENTREGUE_AO_CLIENTE]: 'Entregue ao Cliente',
  [StatusProcesso.RESTITUIDO]: 'Restituído',
  [StatusProcesso.FINALIZADO]: 'Finalizado',
}

export const nomesStatusDocumento: Record<StatusDocumento, string> = {
  [StatusDocumento.PENDENTE]: 'Pendente',
  [StatusDocumento.ENTREGUE]: 'Entregue',
  [StatusDocumento.REJEITADO]: 'Rejeitado',
  [StatusDocumento.NAO_APLICAVEL]: 'Não Aplicável',
}

export const coresStatusProcesso: Record<StatusProcesso, string> = {
  [StatusProcesso.ABERTO]: 'bg-red-100 text-red-800',
  [StatusProcesso.EM_ANALISE]: 'bg-green-100 text-green-800',
  [StatusProcesso.PRONTO_PARA_PROTOCOLO]: 'bg-blue-100 text-blue-800',
  [StatusProcesso.AGUARDANDO_PAGAMENTO_GRU]: 'bg-orange-100 text-orange-800',
  [StatusProcesso.DEFERIDO]: 'bg-emerald-100 text-emerald-800',
  [StatusProcesso.INDEFERIDO]: 'bg-red-100 text-red-800',
  [StatusProcesso.ENTREGUE_AO_CLIENTE]: 'bg-gray-100 text-gray-800',
  [StatusProcesso.RESTITUIDO]: 'bg-purple-100 text-purple-800',
  [StatusProcesso.FINALIZADO]: 'bg-slate-100 text-slate-800',
}

export const coresStatusDocumento: Record<StatusDocumento, string> = {
  [StatusDocumento.PENDENTE]: 'bg-yellow-100 text-yellow-800',
  [StatusDocumento.ENTREGUE]: 'bg-green-100 text-green-800',
  [StatusDocumento.REJEITADO]: 'bg-red-100 text-red-800',
  [StatusDocumento.NAO_APLICAVEL]: 'bg-gray-100 text-gray-800',
}

export const formatarCPF = (cpf: string): string =>
  cpf
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14)

export const formatarTelefone = (telefone: string): string => {
  const n = telefone.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

export const formatarData = (data: Date | string | undefined): string => {
  if (!data) return '-'
  const d = new Date(data)
  if (isNaN(d.getTime())) return '-'
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}

export const obterDataHoje = (): string => {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ano = hoje.getFullYear()
  return `${ano}-${mes}-${dia}`
}

export const converterDataStringParaDate = (dataString: string): Date => {
  const [ano, mes, dia] = dataString.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export const calcularDiasRestantes = (dataPrazo: Date | string | undefined): number | null => {
  if (!dataPrazo) return null
  const prazo = new Date(dataPrazo)
  if (isNaN(prazo.getTime())) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  prazo.setHours(0, 0, 0, 0)
  return Math.ceil((prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export const calcularDiasDecorridos = (dataAbertura: Date | string): number => {
  const abertura = new Date(dataAbertura)
  const hoje = new Date()
  return Math.floor((hoje.getTime() - abertura.getTime()) / (1000 * 60 * 60 * 24))
}
