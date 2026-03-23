const PIN_REGEX = /^\d{4,8}$/

export const validarFormatoPin = (pin: string): boolean => PIN_REGEX.test(pin)

export const hashPin = async (pin: string): Promise<string> => {
  const bytes = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const compararHash = (hashA: string, hashB: string): boolean => {
  if (hashA.length !== hashB.length) return false
  let diff = 0
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i)
  }
  return diff === 0
}
