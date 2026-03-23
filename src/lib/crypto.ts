const ENCRYPTION_PREFIX = 'enc:v1:'
const LEGACY_APP_SALT = 'aguia-despachante::senha-gov'
const TAURI_SECURITY_SALT_COMMAND = 'get_or_create_security_salt'

let saltInstalacaoCache: string | null = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

const ambienteDesktop = (): boolean => {
  const scope = globalThis as { __TAURI_INTERNALS__?: unknown }
  return Boolean(scope.__TAURI_INTERNALS__)
}

const obterSaltInstalacao = async (): Promise<string> => {
  if (saltInstalacaoCache) return saltInstalacaoCache
  if (!ambienteDesktop()) return LEGACY_APP_SALT
  try {
    const tauriCore = await import('@tauri-apps/api/core')
    const salt = await tauriCore.invoke<string>(TAURI_SECURITY_SALT_COMMAND)
    if (salt?.trim()) {
      saltInstalacaoCache = salt
      return salt
    }
  } catch {
    // fallback
  }
  return LEGACY_APP_SALT
}

const derivarChaveUsuario = async (
  identificadorUsuario: string,
  saltOverride?: string,
): Promise<CryptoKey> => {
  if (!crypto?.subtle) throw new Error('Criptografia não suportada neste ambiente')
  const base = normalizarIdentificador(identificadorUsuario) || 'usuario-local'
  const material = await crypto.subtle.importKey('raw', encoder.encode(base), 'PBKDF2', false, ['deriveKey'])
  const salt = saltOverride ?? (await obterSaltInstalacao())
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 150_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const senhaGovEstaCriptografada = (valor?: string): boolean =>
  Boolean(valor && valor.startsWith(ENCRYPTION_PREFIX))

export const criptografarSenhaGov = async (
  senhaTextoPlano: string | undefined,
  identificadorUsuario: string,
  opts: { saltOverride?: string } = {},
): Promise<string | undefined> => {
  const senha = senhaTextoPlano?.trim()
  if (!senha) return undefined
  const chave = await derivarChaveUsuario(identificadorUsuario, opts.saltOverride)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: bytesParaBuffer(iv) },
    chave,
    encoder.encode(senha),
  )
  return `${ENCRYPTION_PREFIX}${bytesParaBase64(iv)}.${bytesParaBase64(new Uint8Array(cifrado))}`
}

export const criptografarSenhaGovParaBackup = async (
  senhaTextoPlano: string | undefined,
  identificadorUsuario: string,
): Promise<string | undefined> =>
  criptografarSenhaGov(senhaTextoPlano, identificadorUsuario, { saltOverride: LEGACY_APP_SALT })

export const descriptografarSenhaGov = async (
  senhaArmazenada: string | undefined,
  identificadorUsuario: string,
): Promise<string | undefined> => {
  if (!senhaArmazenada) return undefined
  if (!senhaGovEstaCriptografada(senhaArmazenada)) return senhaArmazenada
  const payload = senhaArmazenada.slice(ENCRYPTION_PREFIX.length)
  const [ivB64, dadosB64] = payload.split('.')
  if (!ivB64 || !dadosB64) throw new Error('Formato de senha criptografada inválido')
  const iv = bytesParaBuffer(base64ParaBytes(ivB64))
  const cifrado = bytesParaBuffer(base64ParaBytes(dadosB64))
  const tentar = async (salt?: string) => {
    const chave = await derivarChaveUsuario(identificadorUsuario, salt)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, cifrado)
    return decoder.decode(plain)
  }
  try {
    return await tentar()
  } catch {
    return tentar(LEGACY_APP_SALT)
  }
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

