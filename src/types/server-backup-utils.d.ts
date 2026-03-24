declare module '*backup-utils.mjs' {
  export type ResultadoIntegridade = {
    ok: boolean
    message?: string
  }

  export function validarIntegridadeBackup(payload: {
    pessoas: Array<{ id: string }>
    processos: Array<{ id: string; pessoaId: string }>
    documentosProcesso: Array<{ id: string; processoId: string }>
  }): ResultadoIntegridade
}
