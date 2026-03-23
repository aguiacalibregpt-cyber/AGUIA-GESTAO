export const gerarId = (prefixo: string): string => {
  const sufixo =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `${prefixo}_${Date.now()}_${sufixo}`
}

export const obterMensagemErro = (erro: unknown, fallback: string): string => {
  if (erro instanceof Error && erro.message.trim()) {
    return erro.message
  }
  return fallback
}

export const normalizarCPF = (cpf: string): string => cpf.replace(/\D/g, '')
