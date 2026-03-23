import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const runningAsExecutable = typeof process.pkg !== 'undefined'
const ROOT = runningAsExecutable ? path.dirname(process.execPath) : path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')
const DATA_DIR = path.join(ROOT, 'server', 'data')
const DATA_FILE = path.join(DATA_DIR, 'db.json')

const DEFAULT_DB = {
  pessoas: [],
  processos: [],
  documentosProcesso: [],
  configuracoes: [],
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '4mb' }))

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8')
  }
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
  res.json({ ok: true })
})

app.get('/api/pessoas', (_, res) => {
  const db = readDb()
  res.json(db.pessoas)
})

app.post('/api/pessoas', (req, res) => {
  const db = readDb()
  const novaPessoa = req.body
  if (!novaPessoa?.id || !novaPessoa?.nome || !novaPessoa?.cpf) {
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
  const prox = { ...atual, ...req.body }
  if (req.body.cpf) {
    const cpfNormalizado = normalizarCPF(req.body.cpf)
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
  const novoProcesso = req.body
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
  db.processos[idx] = { ...db.processos[idx], ...req.body }
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
  const doc = req.body
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
  db.documentosProcesso[idx] = { ...db.documentosProcesso[idx], ...req.body }
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
  const valor = req.body?.valor
  const id = req.body?.id
  const idx = db.configuracoes.findIndex((c) => c.chave === chave)
  if (idx >= 0) {
    db.configuracoes[idx] = { ...db.configuracoes[idx], ...req.body, chave, valor }
  } else {
    db.configuracoes.push({ ...req.body, id, chave, valor })
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
})
