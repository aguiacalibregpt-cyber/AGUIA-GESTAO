const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function importKeyFromSecret(secret: string) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('aguia-gestao'), iterations: 120_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptJson(key: CryptoKey, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = encoder.encode(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: Array.from(iv), payload: btoa(String.fromCharCode(...new Uint8Array(cipher))) }
}

export async function decryptJson<T>(key: CryptoKey, iv: number[], payload: string): Promise<T> {
  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, bytes)
  return JSON.parse(decoder.decode(plain)) as T
}
