type PessoaResumo = {
  id: string
  nome?: string
  cpf?: string
  senhaGov?: string
}

type ProcessoResumo = {
  pessoaId: string
  tipo: string
  status: string
  dataAbertura?: Date | string
  dataPrazo?: Date | string
}

const formatarData = (valor?: Date | string): string => {
  if (!valor) return '-'
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

export const montarTabelaRelatorioProcessos = (
  processos: ProcessoResumo[],
  pessoas: PessoaResumo[],
  incluirSenha: boolean,
): { colunas: string[]; linhas: string[][] } => {
  const colunas = incluirSenha
    ? ['Nome', 'CPF', 'Senha Gov', 'Tipo', 'Status', 'Data de Início', 'Data de Prazo']
    : ['Nome', 'CPF', 'Tipo', 'Status', 'Data de Início', 'Data de Prazo']

  const linhas = processos.map((pr) => {
    const pessoa = pessoas.find((pe) => pe.id === pr.pessoaId)
    const base = [
      pessoa?.nome || '-',
      pessoa?.cpf || '-',
      pr.tipo.replace(/_/g, ' '),
      pr.status.replace(/_/g, ' '),
      formatarData(pr.dataAbertura),
      formatarData(pr.dataPrazo),
    ]

    if (incluirSenha) {
      base.splice(2, 0, pessoa?.senhaGov || '-')
    }

    return base
  })

  return { colunas, linhas }
}
