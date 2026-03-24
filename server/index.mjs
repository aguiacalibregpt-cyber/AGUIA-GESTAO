import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

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

const app = express()

function originPermitida(origin) {
  if (!origin) return true
  if (ALLOWED_ORIGINS.length > 0) return ALLOWED_ORIGINS.includes(origin)
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(origin)
}

app.use(cors({
  origin: (origin, callback) => {
    if (originPermitida(origin)) return callback(null, true)
    return callback(new Error('Origem não permitida por CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-AGUIA-API-TOKEN'],
}))
app.use(express.json({ limit: '4mb' }))

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
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const parsed = JSON.parse(raw)
  return {
    ...DEFAULT_DB,
    ...parsed,
    pessoas: Array.isArray(parsed.pessoas) ? parsed.pessoas : [],
    processos: Array.isArray(parsed.processos) ? parsed.processos : [],
    documentosProcesso: Array.isArray(parsed.documentosProcesso) ? parsed.documentosProcesso : [],
    configuracoes: Array.isArray(parsed.configuracoes) ? parsed.configuracoes : [],
  }
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
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

app.get('/api/pessoas', (_, res) => {
  const db = readDb()
  res.json(db.pessoas)
})

app.post('/api/pessoas', (req, res) => {
  const db = readDb()
  const novaPessoa = filtrarCampos(req.body, [
    'id', 'nome', 'cpf', 'senhaGov', 'telefone', 'email', 'endereco', 'ativo', 'dataCadastro', 'dataAtualizacao',
  ])
  if (!novaPessoa?.id || !novaPessoa?.nome || !novaPessoa?.cpf) {
    return res.status(400).json({ message: 'Dados inválidos para pessoa' })
  }
  if (!stringNaoVazia(novaPessoa.id) || !stringNaoVazia(novaPessoa.nome) || !stringNaoVazia(novaPessoa.cpf)) {
    return res.status(400).json({ message: 'Dados inválidos para pessoa' })
  }
  const cpfNormalizado = normalizarCPF(novaPessoa.cpf)
  const duplicada = db.pessoas.find((p) => normalizarCPF(p.cpf) === cpfNormalizado)
  if (duplicada) return res.status(409).json({ message: 'Já existe uma pessoa com este CPF' })
  db.pessoas.push(novaPessoa)
  writeDb(db)
  return res.status(201).json(novaPessoa)
})

app.put('/api/pessoas/:id', (req, res) => {
  const db = readDb()
  const idx = db.pessoas.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Pessoa não encontrada' })
  const atual = db.pessoas[idx]
  const atualizacao = filtrarCampos(req.body, [
    'nome', 'cpf', 'senhaGov', 'telefone', 'email', 'endereco', 'ativo', 'dataAtualizacao',
  ])
  const prox = { ...atual, ...atualizacao }
  if (atualizacao.cpf) {
    const cpfNormalizado = normalizarCPF(atualizacao.cpf)
    const duplicada = db.pessoas.find((p) => p.id !== req.params.id && normalizarCPF(p.cpf) === cpfNormalizado)
    if (duplicada) return res.status(409).json({ message: 'Já existe outra pessoa com este CPF' })
  }
  db.pessoas[idx] = prox
  writeDb(db)
  return res.json(prox)
})

app.delete('/api/pessoas/:id', (req, res) => {
  const db = readDb()
  const vinculados = db.processos.some((p) => p.pessoaId === req.params.id)
  if (vinculados) {
    return res.status(409).json({ message: 'Não é possível excluir uma pessoa com processos vinculados' })
  }
  db.pessoas = db.pessoas.filter((p) => p.id !== req.params.id)
  writeDb(db)
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
    'id', 'pessoaId', 'tipo', 'numero', 'status', 'dataAbertura', 'dataPrazo', 'descricao', 'observacoes',
  ])
  if (!novoProcesso?.id || !novoProcesso?.pessoaId || !novoProcesso?.tipo) {
    return res.status(400).json({ message: 'Dados inválidos para processo' })
  }
  db.processos.push(novoProcesso)
  writeDb(db)
  return res.status(201).json(novoProcesso)
})

app.put('/api/processos/:id', (req, res) => {
  const db = readDb()
  const idx = db.processos.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Processo não encontrado' })
  const atualizacao = filtrarCampos(req.body, [
    'pessoaId', 'tipo', 'numero', 'status', 'dataAbertura', 'dataPrazo', 'descricao', 'observacoes',
  ])
  db.processos[idx] = { ...db.processos[idx], ...atualizacao }
  writeDb(db)
  return res.json(db.processos[idx])
})

app.delete('/api/processos/:id', (req, res) => {
  const db = readDb()
  db.documentosProcesso = db.documentosProcesso.filter((d) => d.processoId !== req.params.id)
  db.processos = db.processos.filter((p) => p.id !== req.params.id)
  writeDb(db)
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
  if (!doc?.id || !doc?.processoId || !doc?.nome) {
    return res.status(400).json({ message: 'Dados inválidos para documento' })
  }
  db.documentosProcesso.push(doc)
  writeDb(db)
  return res.status(201).json(doc)
})

app.put('/api/documentos-processo/:id', (req, res) => {
  const db = readDb()
  const idx = db.documentosProcesso.findIndex(byId(req.params.id))
  if (idx < 0) return res.status(404).json({ message: 'Documento não encontrado' })
  const atualizacao = filtrarCampos(req.body, ['nome', 'status', 'observacoes', 'dataEntrega'])
  db.documentosProcesso[idx] = { ...db.documentosProcesso[idx], ...atualizacao }
  writeDb(db)
  return res.json(db.documentosProcesso[idx])
})

app.delete('/api/documentos-processo/:id', (req, res) => {
  const db = readDb()
  db.documentosProcesso = db.documentosProcesso.filter((d) => d.id !== req.params.id)
  writeDb(db)
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
  writeDb(db)
  return res.json(db.configuracoes.find((c) => c.chave === chave))
})

app.delete('/api/configuracoes/:chave', (req, res) => {
  const db = readDb()
  db.configuracoes = db.configuracoes.filter((c) => c.chave !== req.params.chave)
  writeDb(db)
  return res.status(204).send()
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_, res) => {
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
