import crypto from 'node:crypto'
import { z } from 'zod'

const pessoaSchema = z.object({
  id: z.string().min(1).max(50),
  nome: z.string().min(1).max(255),
  cpf: z.string().min(1).max(20),
}).passthrough()

const processoSchema = z.object({
  id: z.string().min(1).max(50),
  pessoaId: z.string().min(1).max(50),
  tipo: z.string().min(1).max(50),
  status: z.string().min(1).max(50),
}).passthrough()

const documentoSchema = z.object({
  id: z.string().min(1).max(50),
  processoId: z.string().min(1).max(50),
  nome: z.string().min(1).max(255),
  status: z.string().min(1).max(50),
}).passthrough()

const configuracaoSchema = z.object({
  chave: z.string().min(1).max(255),
}).passthrough()

export const backupPayloadSchema = z.object({
  versao: z.string().min(1).max(20),
  timestamp: z.string().min(1).max(50),
  checksum: z.string().max(255).optional(),
  pessoas: z.array(pessoaSchema),
  processos: z.array(processoSchema),
  documentosProcesso: z.array(documentoSchema).default([]),
  configuracoes: z.array(configuracaoSchema).default([]),
})

const idsDuplicados = (itens) => {
  const vistos = new Set()
  for (const item of itens) {
    if (vistos.has(item.id)) return true
    vistos.add(item.id)
  }
  return false
}

export const validarIntegridadeBackup = (payload) => {
  if (idsDuplicados(payload.pessoas)) {
    return { ok: false, message: 'Backup inválido: IDs de pessoas duplicados' }
  }
  if (idsDuplicados(payload.processos)) {
    return { ok: false, message: 'Backup inválido: IDs de processos duplicados' }
  }
  if (idsDuplicados(payload.documentosProcesso)) {
    return { ok: false, message: 'Backup inválido: IDs de documentos duplicados' }
  }

  const pessoasIds = new Set(payload.pessoas.map((p) => p.id))
  const processosIds = new Set(payload.processos.map((p) => p.id))

  const processosOrfaos = payload.processos.filter((p) => !pessoasIds.has(p.pessoaId))
  if (processosOrfaos.length > 0) {
    return { ok: false, message: 'Backup inválido: há processos sem pessoa vinculada' }
  }

  const documentosOrfaos = payload.documentosProcesso.filter((d) => !processosIds.has(d.processoId))
  if (documentosOrfaos.length > 0) {
    return { ok: false, message: 'Backup inválido: há documentos sem processo vinculado' }
  }

  return { ok: true }
}

export const calcularChecksumJson = (objSemChecksum) =>
  crypto.createHash('sha256').update(JSON.stringify(objSemChecksum, null, 2)).digest('hex')

export const validarChecksumBackup = (payload) => {
  if (!payload.checksum) return { ok: true }
  const { checksum, ...semChecksum } = payload
  const calculado = calcularChecksumJson(semChecksum)
  if (calculado !== checksum) {
    return { ok: false, message: 'Checksum inválido no backup' }
  }
  return { ok: true }
}
