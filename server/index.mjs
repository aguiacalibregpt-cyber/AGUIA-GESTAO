import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { z } from 'zod'
import {
  backupPayloadSchema,
  calcularChecksumJson,
  validarChecksumBackup,
  validarIntegridadeBackup,
} from './backup-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const runningAsExecutable = typeof process.pkg !== 'undefined'
const ROOT = runningAsExecutable ? path.dirname(process.execPath) : path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DATA_DIR = path.join(ROOT, 'server', 'data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')
const SECURITY_SECRET_FILE = path.join(DATA_DIR, '.security-secret')

const DEFAULT_DB = {
  pessoas: [],
  processos: [],
  documentosProcesso: [],
  configuracoes: [],
}

const API_TOKEN = process.env.AGUIA_API_TOKEN?.trim() || ''
const ALLOWED_ORIGINS = (process.env.AGUIA_ALLOWED_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const CORS_STRICT = process.env.AGUIA_CORS_STRICT === '1'

const app = express()

const RATE_LIMIT_MAX = Number(process.env.AGUIA_RATE_LIMIT_MAX || 300)
const RATE_LIMIT_WINDOW_MS = Number(process.env.AGUIA_RATE_LIMIT_WINDOW_MS || 60_000)
const rateBucket = new Map()

function originPermitida(origin) {
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (CORS_STRICT && ALLOWED_ORIGINS.length > 0) return false

  try {
    const parsed = new URL(origin)
    if (!/^https?:$/i.test(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
      return true
    }
    if (/^192\.168\./.test(host)) return true
    if (/^10\./.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
    return false
  } catch {
    return false
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (originPermitida(origin)) return callback(null, true)
    return callback(null, false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-AGUIA-API-TOKEN'],
}))
app.use(express.json({ limit: '4mb' }))

function getClientKey(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
}

function rateLimitMiddleware(req, res, next) {
  if (req.path === '/health') return next()
  const agora = Date.now()
  const chave = String(getClientKey(req))
  const atual = rateBucket.get(chave)
  if (!atual || agora >= atual.resetAt) {
    rateBucket.set(chave, { count: 1, resetAt: agora + RATE_LIMIT_WINDOW_MS })
    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX))
    return next()
  }
  if (atual.count >= RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((atual.resetAt - agora) / 1000)))
    return res.status(429).json({ message: 'Muitas requisições, tente novamente em instantes' })
  }
  atual.count += 1
  rateBucket.set(chave, atual)
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX))
  return next()
}

app.use('/api', rateLimitMiddleware)

// Limpeza periódica de entries expiradas do rate-limit (a cada 60s)
setInterval(() => {
  const agora = Date.now()
  for (const [chave, bucket] of rateBucket) {
    if (agora >= bucket.resetAt) rateBucket.delete(chave)
  }
}, 60_000)

const pessoaCreateSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  cpf: z.string().min(1),
  senhaGov: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  ativo: z.boolean().optional(),
  dataCadastro: z.string().optional(),
  dataAtualizacao: z.string().optional(),
})

const pessoaUpdateSchema = pessoaCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Payload vazio para atualização',
})

const processoCreateSchema = z.object({
  id: z.string().min(1),
  pessoaId: z.string().min(1),
  tipo: z.string().min(1),
  numero: z.string().optional(),
  status: z.string().optional(),
  dataAbertura: z.string().optional(),
  dataPrazo: z.string().optional(),
  dataFechamento: z.string().optional(),
  dataRestituido: z.string().optional(),
  dataUltimaConsulta: z.string().optional(),
  dataCadastro: z.string().optional(),
  dataAtualizacao: z.string().optional(),
  descricao: z.string().optional(),
  observacoes: z.string().optional(),
})

const processoUpdateSchema = processoCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Payload vazio para atualização',
})

const documentoCreateSchema = z.object({
  id: z.string().min(1),
  processoId: z.string().min(1),
  nome: z.string().min(1),
  status: z.string().optional(),
  observacoes: z.string().optional(),
  dataEntrega: z.string().optional(),
})

const documentoUpdateSchema = documentoCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Payload vazio para atualização',
})

function validarPayload(schema, data, res, mensagem = 'Payload inválido') {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    res.status(400).json({
      message: mensagem,
      details: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    })
    return null
  }
  return parsed.data
}

function filtrarCampos(obj, permitidos) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  const limpo = {}
  for (const chave of permitidos) {
    if (Object.prototype.hasOwnProperty.call(obj, chave)) limpo[chave] = obj[chave]
  }
  return limpo
}

function stringNaoVazia(valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

function extrairToken(req) {
  const headerAuth = req.headers.authorization
  if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
    return headerAuth.slice(7).trim()
  }
  const headerCustom = req.headers['x-aguia-api-token']
  if (typeof headerCustom === 'string') return headerCustom.trim()
  if (Array.isArray(headerCustom) && headerCustom[0]) return headerCustom[0].trim()
  return ''
}

function authMiddleware(req, res, next) {
  if (!req.path.startsWith('/api/')) return next()
  if (req.path === '/api/health') return next()
  if (!API_TOKEN) return next()
  const recebido = extrairToken(req)
  if (!recebido) return res.status(401).json({ message: 'Token de acesso ausente' })
  if (recebido !== API_TOKEN) return res.status(401).json({ message: 'Token de acesso inválido' })
  return next()
}

app.use(authMiddleware)

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8')
  }
}

function ensureSecuritySecret() {
  ensureDataFile()
  if (!fs.existsSync(SECURITY_SECRET_FILE)) {
    const novo = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(SECURITY_SECRET_FILE, novo, { encoding: 'utf-8', mode: 0o600 })
    return novo
  }
  return fs.readFileSync(SECURITY_SECRET_FILE, 'utf-8').trim()
}

function readDb() {
  ensureDataFile()
  let raw
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf-8')
  } catch (err) {
    console.error('[AGUIA] Falha ao ler db.json:', err.message)
    return { ...DEFAULT_DB }
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error('[AGUIA] db.json corrompido, tentando recuperar do .tmp:', err.message)
    const tmp = `${DATA_FILE}.tmp`
    if (fs.existsSync(tmp)) {
      try {
        parsed = JSON.parse(fs.readFileSync(tmp, 'utf-8'))
        // Restaurar db.json a partir do .tmp válido
        fs.writeFileSync(DATA_FILE, fs.readFileSync(tmp, 'utf-8'))
        console.log('[AGUIA] db.json restaurado a partir do .tmp com sucesso')
      } catch {
        console.error('[AGUIA] .tmp também corrompido, retornando banco vazio')
        return { ...DEFAULT_DB }
      }
    } else {
      console.error('[AGUIA] Nenhum .tmp disponível, retornando banco vazio')
      return { ...DEFAULT_DB }
    }
  }

  return {
    ...DEFAULT_DB,
    ...parsed,
    pessoas: Array.isArray(parsed.pessoas) ? parsed.pessoas : [],
    processos: Array.isArray(parsed.processos) ? parsed.processos : [],
    documentosProcesso: Array.isArray(parsed.documentosProcesso) ? parsed.documentosProcesso : [],
    configuracoes: Array.isArray(parsed.configuracoes) ? parsed.configuracoes : [],
  }
}

function writeDbAtomico(db) {
  ensureDataFile()
  const tmp = `${DATA_FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8')
  fs.renameSync(tmp, DATA_FILE)
}

function byId(id) {
  return (item) => item.id === id
}

function normalizarCPF(cpf) {
  return String(cpf || '').replace(/\D/g, '')
}

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    authRequired: Boolean(API_TOKEN),
    corsMode: ALLOWED_ORIGINS.length > 0 ? 'explicit-origins' : 'lan-only-default',
    securityMaterialEndpoint: API_TOKEN ? 'enabled' : 'disabled',
  })
})

app.get('/api/security/material', (_, res) => {
  if (!API_TOKEN) return res.status(404).json({ message: 'Recurso indisponível' })
  // Retorna material de derivação por instalação.
  const secret = ensureSecuritySecret()
  res.json({ material: secret })
})

app.get('/api/backup/export', (_, res) => {
  const db = readDb()
  const semChecksum = {
    versao: '2.0',
    timestamp: new Date().toISOString(),
    pessoas: db.pessoas,
    processos: db.processos,
    documentosProcesso: db.documentosProcesso,
    configuracoes: db.configuracoes,
  }
  const checksum = calcularChecksumJson(semChecksum)
  res.json({ ...semChecksum, checksum })
})

app.post('/api/backup/import', (req, res) => {
  const payload = validarPayload(backupPayloadSchema, req.body, res, 'Backup inválido ou incompatível')
  if (!payload) return

  const checksum = validarChecksumBackup(payload)
  if (!checksum.ok) return res.status(400).json({ message: checksum.message })

  const integridade = validarIntegridadeBackup(payload)
  if (!integridade.ok) return res.status(400).json({ message: integridade.message })

  const novoDb = {
    pessoas: payload.pessoas,
    processos: payload.processos,
    documentosProcesso: payload.documentosProcesso ?? [],
    configuracoes: payload.configuracoes ?? [],
  }

  try {
    writeDbAtomico(novoDb)
    return res.json({
      ok: true,
      pessoas: novoDb.pessoas.length,
      processos: novoDb.processos.length,
      documentos: novoDb.documentosProcesso.length,
      configuracoes: novoDb.configuracoes.length,
    })
  } catch {
    return res.status(500).json({ message: 'Falha ao importar backup de forma atômica' })
  }
})

app.get('/api/pessoas', (_, res) => {
  const db = readDb()
  res.json(db.pessoas)
})

app.post('/api/pessoas', (req, res) => {
  const db = readDb()
  const novaPessoa = filtrarCampos(req.body, [
    'id', 'nome', 'cpf', 'senhaGov', 'telefone', 'email', 'endereco', 'ativo', 'dataCadastro', 'dataAtualizacao',
  ])
  const payload = validarPayload(pessoaCreateSchema, novaPessoa, res, 'Dados inválidos para pessoa')
  if (!payload) return
  const pessoa = payload
  if (!stringNaoVazia(novaPessoa.id) || !stringNaoVazia(novaPessoa.nome) || !stringNaoVazia(novaPessoa.cpf)) {
    return res.status(400).json({ message: 'Dados inválidos para pessoa' })
  }
  const cpfNormalizado = normalizarCPF(pessoa.cpf)
  const duplicada = db.pessoas.find((p) => normalizarCPF(p.cpf) === cpfNormalizado)
  if (duplicada) return res.status(409).json({ message: 'Já existe uma pessoa com este CPF' })
  db.pessoas.push(pessoa)
  writeDbAtomico(db)
  return res.status(201).json(pessoa)
})

app.put('/api/pessoas/:id', (req, res) => {
  const db = readDb()
  const idx = db.pessoas.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Pessoa não encontrada' })
  const atual = db.pessoas[idx]
  const atualizacao = filtrarCampos(req.body, [
    'nome', 'cpf', 'senhaGov', 'telefone', 'email', 'endereco', 'ativo', 'dataAtualizacao',
  ])
  const parsedAtualizacao = validarPayload(pessoaUpdateSchema, atualizacao, res, 'Dados inválidos para pessoa')
  if (!parsedAtualizacao) return
  const atualizacaoValida = parsedAtualizacao
  const prox = { ...atual, ...atualizacaoValida }
  if (atualizacaoValida.cpf) {
    const cpfNormalizado = normalizarCPF(atualizacaoValida.cpf)
    const duplicada = db.pessoas.find((p) => p.id !== req.params.id && normalizarCPF(p.cpf) === cpfNormalizado)
    if (duplicada) return res.status(409).json({ message: 'Já existe outra pessoa com este CPF' })
  }
  db.pessoas[idx] = prox
  writeDbAtomico(db)
  return res.json(prox)
})

app.delete('/api/pessoas/:id', (req, res) => {
  const db = readDb()
  const vinculados = db.processos.some((p) => p.pessoaId === req.params.id)
  if (vinculados) {
    return res.status(409).json({ message: 'Não é possível excluir uma pessoa com processos vinculados' })
  }
  db.pessoas = db.pessoas.filter((p) => p.id !== req.params.id)
  writeDbAtomico(db)
  return res.status(204).send()
})

app.get('/api/processos', (req, res) => {
  const db = readDb()
  const pessoaId = req.query.pessoaId
  if (pessoaId) {
    return res.json(db.processos.filter((p) => p.pessoaId === pessoaId))
  }
  return res.json(db.processos)
})

app.post('/api/processos', (req, res) => {
  const db = readDb()
  const novoProcesso = filtrarCampos(req.body, [
    'id', 'pessoaId', 'tipo', 'numero', 'status', 'dataAbertura', 'dataPrazo',
    'dataFechamento', 'dataRestituido', 'dataUltimaConsulta',
    'dataCadastro', 'dataAtualizacao', 'descricao', 'observacoes',
  ])
  const parsedProcesso = validarPayload(processoCreateSchema, novoProcesso, res, 'Dados inválidos para processo')
  if (!parsedProcesso) return
  const processo = parsedProcesso
  if (db.processos.some((p) => p.id === processo.id)) {
    return res.status(409).json({ message: 'Já existe um processo com este ID' })
  }
  if (!db.pessoas.some((p) => p.id === processo.pessoaId)) {
    return res.status(400).json({ message: 'Pessoa vinculada ao processo não encontrada' })
  }
  db.processos.push(processo)
  writeDbAtomico(db)
  return res.status(201).json(processo)
})

app.put('/api/processos/:id', (req, res) => {
  const db = readDb()
  const idx = db.processos.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Processo não encontrado' })
  const atualizacao = filtrarCampos(req.body, [
    'pessoaId', 'tipo', 'numero', 'status', 'dataAbertura', 'dataPrazo',
    'dataFechamento', 'dataRestituido', 'dataUltimaConsulta',
    'dataAtualizacao', 'descricao', 'observacoes',
  ])
  const parsedAtualizacao = validarPayload(processoUpdateSchema, atualizacao, res, 'Dados inválidos para processo')
  if (!parsedAtualizacao) return
  const atualizacaoValida = parsedAtualizacao
  if (atualizacaoValida.pessoaId && !db.pessoas.some((p) => p.id === atualizacaoValida.pessoaId)) {
    return res.status(400).json({ message: 'Pessoa vinculada ao processo não encontrada' })
  }
  db.processos[idx] = { ...db.processos[idx], ...atualizacaoValida }
  writeDbAtomico(db)
  return res.json(db.processos[idx])
})

app.delete('/api/processos/:id', (req, res) => {
  const db = readDb()
  db.documentosProcesso = db.documentosProcesso.filter((d) => d.processoId !== req.params.id)
  db.processos = db.processos.filter((p) => p.id !== req.params.id)
  writeDbAtomico(db)
  return res.status(204).send()
})

app.get('/api/documentos-processo', (req, res) => {
  const db = readDb()
  const processoId = req.query.processoId
  if (!processoId) return res.status(400).json({ message: 'processoId é obrigatório' })
  return res.json(db.documentosProcesso.filter((d) => d.processoId === processoId))
})

app.post('/api/documentos-processo', (req, res) => {
  const db = readDb()
  const doc = filtrarCampos(req.body, [
    'id', 'processoId', 'nome', 'status', 'observacoes', 'dataEntrega',
  ])
  const parsedDocumento = validarPayload(documentoCreateSchema, doc, res, 'Dados inválidos para documento')
  if (!parsedDocumento) return
  const documento = parsedDocumento
  if (db.documentosProcesso.some((d) => d.id === documento.id)) {
    return res.status(409).json({ message: 'Já existe um documento com este ID' })
  }
  if (!db.processos.some((p) => p.id === documento.processoId)) {
    return res.status(400).json({ message: 'Processo vinculado ao documento não encontrado' })
  }
  db.documentosProcesso.push(documento)
  writeDbAtomico(db)
  return res.status(201).json(documento)
})

app.put('/api/documentos-processo/:id', (req, res) => {
  const db = readDb()
  const idx = db.documentosProcesso.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Documento não encontrado' })
  const atualizacao = filtrarCampos(req.body, ['nome', 'status', 'observacoes', 'dataEntrega'])
  const parsedAtualizacao = validarPayload(documentoUpdateSchema, atualizacao, res, 'Dados inválidos para documento')
  if (!parsedAtualizacao) return
  db.documentosProcesso[idx] = { ...db.documentosProcesso[idx], ...parsedAtualizacao }
  writeDbAtomico(db)
  return res.json(db.documentosProcesso[idx])
})

app.delete('/api/documentos-processo/:id', (req, res) => {
  const db = readDb()
  db.documentosProcesso = db.documentosProcesso.filter((d) => d.id !== req.params.id)
  writeDbAtomico(db)
  return res.status(204).send()
})

app.get('/api/configuracoes', (_, res) => {
  const db = readDb()
  return res.json(db.configuracoes)
})

app.get('/api/configuracoes/:chave', (req, res) => {
  const db = readDb()
  const cfg = db.configuracoes.find((c) => c.chave === req.params.chave)
  if (!cfg) return res.status(404).json({ message: 'Configuração não encontrada' })
  return res.json(cfg)
})

app.put('/api/configuracoes/:chave', (req, res) => {
  const db = readDb()
  const chave = req.params.chave
  const payload = filtrarCampos(req.body, ['id', 'valor'])
  const valor = payload?.valor
  const id = payload?.id
  const idx = db.configuracoes.findIndex((c) => c.chave === chave)
  if (idx >= 0) {
    db.configuracoes[idx] = { ...db.configuracoes[idx], ...payload, chave, valor }
  } else {
    db.configuracoes.push({ ...payload, id, chave, valor })
  }
  writeDbAtomico(db)
  return res.json(db.configuracoes.find((c) => c.chave === chave))
})

app.delete('/api/configuracoes/:chave', (req, res) => {
  const db = readDb()
  db.configuracoes = db.configuracoes.filter((c) => c.chave !== req.params.chave)
  writeDbAtomico(db)
  return res.status(204).send()
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, {
    index: false,
    etag: true,
    maxAge: '7d',
  }))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Rota API não encontrada' })
    // Evita cache agressivo de index.html, reduzindo risco de tela branca por bundle antigo.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => {
  console.log(`AGUIA servidor local em http://0.0.0.0:${port}`)
  console.log(`Banco de dados: ${DATA_FILE}`)
  if (API_TOKEN) {
    console.log('Auth API: habilitada por AGUIA_API_TOKEN')
  } else {
    console.log('Auth API: desabilitada (defina AGUIA_API_TOKEN para exigir token)')
  }
})
