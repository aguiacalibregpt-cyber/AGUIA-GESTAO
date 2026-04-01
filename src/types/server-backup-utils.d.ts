declare module '*backup-utils.mjs' {
  export type ResultadoIntegridade = {
    ok: boolean
    message?: string
  }

  export type ResultadoChecksum = {
    ok: boolean
    message?: string
  }

  export type ItemPessoa = {
    id: string
  }

  export type ItemProcesso = {
    id: string
    pessoaId: string
  }

  export type ItemDocumento = {
    id: string
    processoId: string
  }

  export type PayloadBackup = {
    versao?: string
    timestamp?: string
    checksum?: string
    pessoas: Array<ItemPessoa>
    processos: Array<ItemProcesso>
    documentosProcesso: Array<ItemDocumento>
    configuracoes?: Array<unknown>
    [chave: string]: unknown
  }

  export function validarIntegridadeBackup(payload: PayloadBackup): ResultadoIntegridade
  export function ehBackupVazio(payload: PayloadBackup): boolean
  export function calcularChecksumJson(objSemChecksum: unknown): string
  export function validarChecksumBackup(payload: PayloadBackup): ResultadoChecksum
}
