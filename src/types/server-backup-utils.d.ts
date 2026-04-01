declare module '*backup-utils.mjs' {
  export type ResultadoIntegridade = {
    ok: boolean
    message?: string
  }

  export type PayloadBackup = {
    pessoas: Array<{ id: string }>
    processos: Array<{ id: string; pessoaId: string }>
    documentosProcesso: Array<{ id: string; processoId: string }>
    configuracoes?: Array<unknown>
  }

  export function validarIntegridadeBackup(payload: PayloadBackup): ResultadoIntegridade
  export function ehBackupVazio(payload: PayloadBackup): boolean
}
