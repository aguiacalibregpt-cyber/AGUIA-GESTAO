import { describe, expect, it } from 'vitest'
import { senhaGovEstaCriptografada, senhaGovUsaEsquemaLegado } from './crypto'

describe('prefixos de criptografia', () => {
  it('reconhece payload v1 como criptografado e legado', () => {
    const valor = 'enc:v1:abc.def'
    expect(senhaGovEstaCriptografada(valor)).toBe(true)
    expect(senhaGovUsaEsquemaLegado(valor)).toBe(true)
  })

  it('reconhece payload v2 como criptografado e nao legado', () => {
    const valor = 'enc:v2:abc.def'
    expect(senhaGovEstaCriptografada(valor)).toBe(true)
    expect(senhaGovUsaEsquemaLegado(valor)).toBe(false)
  })

  it('nao marca texto puro como criptografado', () => {
    expect(senhaGovEstaCriptografada('senha-em-texto')).toBe(false)
    expect(senhaGovUsaEsquemaLegado('senha-em-texto')).toBe(false)
  })
})
