const ENCRYPTION_PREFIX_V2 = 'enc:v2:'
const ENCRYPTION_PREFIX_LEGACY = 'enc:v1:'
const LEGACY_APP_SALT = 'aguia-despachante::senha-gov'
const TAURI_SECURITY_SALT_COMMAND = 'get_or_create_security_salt'
const DERIVATION_SALT_V2 = 'aguia::senha-gov::v2'
const SECURITY_SECRET_ENV = (import.meta.env.VITE_SECURITY_SECRET as string | undefined)?.trim()
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || `${window.location.origin}/api`
const API_TOKEN_ENV = (import.meta.env.VITE_API_TOKEN as string | undefined)?.trim()
const API_TOKEN_STORAGE_KEY = 'aguia.api.token'

let materialInstalacaoCache: string | null = null

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
  try {
    if (ambienteDesktop()) {
      const tauriCore = await import('@tauri-apps/api/core')
      const material = await tauriCore.invoke<string>(TAURI_SECURITY_SALT_COMMAND)
      if (material?.trim()) {
        materialInstalacaoCache = material
        return material
      }
    }
  } catch {
    // fallback para web/env/api
  }

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
  if (!crypto?.subtle) throw new Error('Criptografia não suportada neste ambiente')
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
  if (!crypto?.subtle) throw new Error('Criptografia não suportada neste ambiente')
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
  Boolean(valor && (valor.startsWith(ENCRYPTION_PREFIX_V2) || valor.startsWith(ENCRYPTION_PREFIX_LEGACY)))

export const senhaGovUsaEsquemaLegado = (valor?: string): boolean =>
  Boolean(valor && valor.startsWith(ENCRYPTION_PREFIX_LEGACY))

export const criptografarSenhaGov = async (
  senhaTextoPlano: string | undefined,
  identificadorUsuario: string,
  opts: { usarLegado?: boolean } = {},
): Promise<string | undefined> => {
  const senha = senhaTextoPlano?.trim()
  if (!senha) return undefined
  const usarLegado = Boolean(opts.usarLegado)
  const chave = usarLegado
    ? await derivarChaveLegacy(identificadorUsuario)
    : await derivarChaveV2(identificadorUsuario, await obterMaterialInstalacao())
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
    : ENCRYPTION_PREFIX_LEGACY
  const payload = senhaArmazenada.slice(prefixo.length)
  const [ivB64, dadosB64] = payload.split('.')
  if (!ivB64 || !dadosB64) throw new Error('Formato de senha criptografada inválido')
  const iv = bytesParaBuffer(base64ParaBytes(ivB64))
  const cifrado = bytesParaBuffer(base64ParaBytes(dadosB64))
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

