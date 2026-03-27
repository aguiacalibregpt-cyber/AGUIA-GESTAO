import { converterDataStringParaDate } from './constants'

export interface PessoaFormData {
  nome: string
  cpf: string
  telefone: string
  email: string
  endereco: string
  senhaGov: string
}

export interface ProcessoFormData {
  pessoaId: string
  tipo: string
  numero: string
  dataAbertura: string
  dataPrazo: string
  descricao: string
  observacoes: string
}

const validarCPF = (cpf: string): boolean => {
  const nums = cpf.replace(/\D/g, '')
  if (nums.length !== 11 || /^(\d)\1{10}$/.test(nums)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(nums[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(nums[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(nums[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(nums[10])
}

export const validarPessoaFormulario = (
  formData: PessoaFormData,
): Partial<Record<'nome' | 'cpf' | 'telefone' | 'email', string>> => {
  const erros: Partial<Record<'nome' | 'cpf' | 'telefone' | 'email', string>> = {}

  if (!formData.nome.trim() || formData.nome.trim().length < 2) {
    erros.nome = 'Informe o nome completo (mínimo 2 caracteres)'
  }

  const cpfLimpo = formData.cpf.replace(/\D/g, '')
  if (!cpfLimpo) {
    erros.cpf = 'Informe o CPF'
  } else if (cpfLimpo.length !== 11) {
    erros.cpf = 'CPF deve ter 11 dígitos'
  } else if (!validarCPF(formData.cpf)) {
    erros.cpf = 'CPF inválido'
  }

  if (formData.telefone && formData.telefone.replace(/\D/g, '').length > 0) {
    const tel = formData.telefone.replace(/\D/g, '')
    if (tel.length < 10 || tel.length > 11) {
      erros.telefone = 'Telefone inválido — use (00) 00000-0000'
    }
  }

  if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    erros.email = 'Informe um email válido'
  }

  return erros
}

export const validarProcessoFormulario = (
  formData: ProcessoFormData,
): Partial<Record<'pessoaId' | 'tipo' | 'numero' | 'dataPrazo', string>> => {
  const erros: Partial<Record<'pessoaId' | 'tipo' | 'numero' | 'dataPrazo', string>> = {}
  const pessoaIdLimpo = formData.pessoaId.trim()
  const tipoLimpo = formData.tipo.trim()
  const numeroLimpo = formData.numero.trim()

  if (!pessoaIdLimpo) {
    erros.pessoaId = 'Selecione a pessoa vinculada ao processo'
  }

  if (!tipoLimpo) {
    erros.tipo = 'Selecione o tipo do processo'
  }

  if (numeroLimpo && numeroLimpo.length < 4) {
    erros.numero = 'Número do processo deve ter ao menos 4 caracteres'
  }

  if (formData.dataPrazo && formData.dataAbertura) {
    const abertura = converterDataStringParaDate(formData.dataAbertura)
    const prazo = converterDataStringParaDate(formData.dataPrazo)
    if (prazo < abertura) {
      erros.dataPrazo = 'A data de prazo não pode ser anterior à data de abertura'
    }
  }

  return erros
}
