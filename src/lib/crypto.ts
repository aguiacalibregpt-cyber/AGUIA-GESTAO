const ENCRYPTION_PREFIX_V2 = 'enc:v2:'
const ENCRYPTION_PREFIX_LEGACY = 'enc:v1:'
const ENCRYPTION_PREFIX_V2_JS = 'enc:v2js:'
const LEGACY_APP_SALT = 'aguia-despachante::senha-gov'
const DERIVATION_SALT_V2 = 'aguia::senha-gov::v2'
const SECURITY_SECRET_ENV = (import.meta.env.VITE_SECURITY_SECRET as string | undefined)?.trim()
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || `${window.location.origin}/api`
const API_TOKEN_ENV = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim()
const API_TOKEN_STORAGE_KEY = 'aguia.api.token'

let materialInstalacaoCache: string | null = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const subtleDisponivel = (): boolean =>
  typeof crypto !== 'undefined' && Boolean(crypto?.subtle)

const bytesParaHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')

const fnv1a32 = (valor: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < valor.length; i++) {
    hash ^= valor.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

const xorshift32 = (seed: number): (() => number) => {
  let state = seed || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
}

const gerarIv = (): Uint8Array => {
  const iv = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    crypto.getRandomValues(iv)
    return iv
  }
  const random = xorshift32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0)
  for (let i = 0; i < iv.length; i++) iv[i] = random() & 0xff
  return iv
}

const sha256Js = (input: string): string => {
  const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  const rotr = (n: number, x: number): number => (x >>> n) | (x << (32 - n))
  const bytes = encoder.encode(input)
  const bitLength = bytes.length * 8
  const withOne = bytes.length + 1
  const totalLen = (((withOne + 8 + 63) >> 6) << 6)
  const msg = new Uint8Array(totalLen)
  msg.set(bytes)
  msg[bytes.length] = 0x80

  const dv = new DataView(msg.buffer)
  const high = Math.floor(bitLength / 0x100000000)
  const low = bitLength >>> 0
  dv.setUint32(totalLen - 8, high, false)
  dv.setUint32(totalLen - 4, low, false)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const w = new Uint32Array(64)
  for (let i = 0; i < msg.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)) >>> 0
      const s1 = (rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)) >>> 0
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let t = 0; t < 64; t++) {
      const S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0
      const ch = ((e & f) ^ (~e & g)) >>> 0
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0
      const S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('')
}

const gerarFluxoXor = (semente: string, tamanho: number): Uint8Array => {
  const digest = sha256Js(semente)
  const random = xorshift32(fnv1a32(digest))
  const out = new Uint8Array(tamanho)
  for (let i = 0; i < tamanho; i++) out[i] = random() & 0xff
  return out
}

const criptografarSemSubtle = (
  textoPlano: string,
  identificadorUsuario: string,
  materialInstalacao: string,
): string => {
  const iv = gerarIv()
  const ivHex = bytesParaHex(iv)
  const base = `${materialInstalacao}:${normalizarIdentificador(identificadorUsuario) || 'usuario-local'}:${ivHex}`
  const plain = encoder.encode(textoPlano)
  const fluxo = gerarFluxoXor(base, plain.length)
  const cifrado = new Uint8Array(plain.length)
  for (let i = 0; i < plain.length; i++) cifrado[i] = plain[i] ^ fluxo[i]
  return `${ENCRYPTION_PREFIX_V2_JS}${bytesParaBase64(iv)}.${bytesParaBase64(cifrado)}`
}

const descriptografarSemSubtle = (
  ivBytes: Uint8Array,
  cifradoBytes: Uint8Array,
  identificadorUsuario: string,
  materialInstalacao: string,
): string => {
  const base = `${materialInstalacao}:${normalizarIdentificador(identificadorUsuario) || 'usuario-local'}:${bytesParaHex(ivBytes)}`
  const fluxo = gerarFluxoXor(base, cifradoBytes.length)
  const plain = new Uint8Array(cifradoBytes.length)
  for (let i = 0; i < cifradoBytes.length; i++) plain[i] = cifradoBytes[i] ^ fluxo[i]
  return decoder.decode(plain)
}

const bytesParaBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const base64ParaBytes = (base64: string): Uint8Array => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const bytesParaBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

const normalizarIdentificador = (valor: string): string =>
  valor.replace(/\D/g, '') || valor.trim().toLowerCase()

const obterTokenApi = (): string | undefined => {
  if (API_TOKEN_ENV) return API_TOKEN_ENV
  try {
    const valor = localStorage.getItem(API_TOKEN_STORAGE_KEY)?.trim()
    return valor || undefined
  } catch {
    return undefined
  }
}

const obterMaterialViaApi = async (): Promise<string | undefined> => {
  try {
    const token = obterTokenApi()
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/security/material`, { headers })
    if (!res.ok) return undefined
    const body = (await res.json()) as { material?: string }
    const material = body?.material?.trim()
    return material || undefined
  } catch {
    return undefined
  }
}

const obterMaterialInstalacao = async (): Promise<string> => {
  if (materialInstalacaoCache) return materialInstalacaoCache

  if (SECURITY_SECRET_ENV) {
    materialInstalacaoCache = SECURITY_SECRET_ENV
    return SECURITY_SECRET_ENV
  }

  const materialApi = await obterMaterialViaApi()
  if (materialApi) {
    materialInstalacaoCache = materialApi
    return materialApi
  }

  // Último fallback para compatibilidade quando não há segredo configurado.
  return LEGACY_APP_SALT
}

const derivarChaveLegacy = async (
  identificadorUsuario: string,
): Promise<CryptoKey> => {
  if (!subtleDisponivel()) throw new Error('Criptografia não suportada neste ambiente')
  const base = normalizarIdentificador(identificadorUsuario) || 'usuario-local'
  const material = await crypto.subtle.importKey('raw', encoder.encode(base), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(LEGACY_APP_SALT), iterations: 150_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

const derivarChaveV2 = async (
  identificadorUsuario: string,
  materialInstalacao: string,
): Promise<CryptoKey> => {
  if (!subtleDisponivel()) throw new Error('Criptografia não suportada neste ambiente')
  const base = `${materialInstalacao}:${normalizarIdentificador(identificadorUsuario) || 'usuario-local'}`
  const material = await crypto.subtle.importKey('raw', encoder.encode(base), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(DERIVATION_SALT_V2), iterations: 200_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const senhaGovEstaCriptografada = (valor?: string): boolean =>
  Boolean(
    valor && (
      valor.startsWith(ENCRYPTION_PREFIX_V2)
      || valor.startsWith(ENCRYPTION_PREFIX_LEGACY)
      || valor.startsWith(ENCRYPTION_PREFIX_V2_JS)
    ),
  )

export const senhaGovUsaEsquemaLegado = (valor?: string): boolean =>
  Boolean(valor && valor.startsWith(ENCRYPTION_PREFIX_LEGACY))

export const criptografarSenhaGov = async (
  senhaTextoPlano: string | undefined,
  identificadorUsuario: string,
  opts: { usarLegado?: boolean } = {},
): Promise<string | undefined> => {
  const senha = senhaTextoPlano?.trim()
  if (!senha) return undefined
  const materialInstalacao = await obterMaterialInstalacao()
  if (!subtleDisponivel()) {
    return criptografarSemSubtle(senha, identificadorUsuario, materialInstalacao)
  }
  const usarLegado = Boolean(opts.usarLegado)
  const chave = usarLegado
    ? await derivarChaveLegacy(identificadorUsuario)
    : await derivarChaveV2(identificadorUsuario, materialInstalacao)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesParaBuffer(iv) },
    chave,
    encoder.encode(senha),
  )
  const prefixo = usarLegado ? ENCRYPTION_PREFIX_LEGACY : ENCRYPTION_PREFIX_V2
  return `${prefixo}${bytesParaBase64(iv)}.${bytesParaBase64(new Uint8Array(cifrado))}`
}

export const criptografarSenhaGovParaBackup = async (
  senhaTextoPlano: string | undefined,
  identificadorUsuario: string,
): Promise<string | undefined> =>
  criptografarSenhaGov(senhaTextoPlano, identificadorUsuario, { usarLegado: true })

export const descriptografarSenhaGov = async (
  senhaArmazenada: string | undefined,
  identificadorUsuario: string,
): Promise<string | undefined> => {
  if (!senhaArmazenada) return undefined
  if (!senhaGovEstaCriptografada(senhaArmazenada)) return senhaArmazenada

  const prefixo = senhaArmazenada.startsWith(ENCRYPTION_PREFIX_V2)
    ? ENCRYPTION_PREFIX_V2
    : senhaArmazenada.startsWith(ENCRYPTION_PREFIX_LEGACY)
      ? ENCRYPTION_PREFIX_LEGACY
      : ENCRYPTION_PREFIX_V2_JS
  const payload = senhaArmazenada.slice(prefixo.length)
  const [ivB64, dadosB64] = payload.split('.')
  if (!ivB64 || !dadosB64) throw new Error('Formato de senha criptografada inválido')
  const ivBytes = base64ParaBytes(ivB64)
  const cifradoBytes = base64ParaBytes(dadosB64)

  if (prefixo === ENCRYPTION_PREFIX_V2_JS) {
    return descriptografarSemSubtle(
      ivBytes,
      cifradoBytes,
      identificadorUsuario,
      await obterMaterialInstalacao(),
    )
  }

  if (!subtleDisponivel()) {
    throw new Error('Criptografia não suportada neste ambiente')
  }

  const iv = bytesParaBuffer(ivBytes)
  const cifrado = bytesParaBuffer(cifradoBytes)
  const tentar = async () => {
    const chave = prefixo === ENCRYPTION_PREFIX_V2
      ? await derivarChaveV2(identificadorUsuario, await obterMaterialInstalacao())
      : await derivarChaveLegacy(identificadorUsuario)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, cifrado)
    return decoder.decode(plain)
  }

  return tentar()
}

// ---- Audit log de acesso a credenciais ----
const AUDIT_KEY = 'aguia.senhaGov.audit'
type EventoAcesso = 'visualizacao' | 'copia' | 'atualizacao' | 'falha_descriptografia'

export const registrarAcessoSenhaGov = (
  evento: EventoAcesso,
  contexto: { pessoaId?: string; processoId?: string } = {},
) => {
  try {
    const atual = localStorage.getItem(AUDIT_KEY)
    const trilha: Array<{ em: string; evento: EventoAcesso; pessoaId?: string; processoId?: string }> =
      atual ? JSON.parse(atual) : []
    trilha.push({ em: new Date().toISOString(), evento, ...contexto })
    localStorage.setItem(AUDIT_KEY, JSON.stringify(trilha.slice(-50)))
  } catch {
    // sem interromper fluxo
  }
}

