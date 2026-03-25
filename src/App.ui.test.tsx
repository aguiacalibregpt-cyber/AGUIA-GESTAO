import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockObterConfiguracao = vi.fn()
const mockSalvarConfiguracao = vi.fn()

vi.mock('./stores/configuracoesStore', () => ({
  useConfiguracoesStore: () => ({
    obterConfiguracao: mockObterConfiguracao,
    salvarConfiguracao: mockSalvarConfiguracao,
  }),
}))

vi.mock('./lib/pin', () => ({
  hashPin: vi.fn(async (valor: string) => valor),
  compararHash: vi.fn((informado: string, salvo: string) => informado === salvo),
  validarFormatoPin: vi.fn(() => true),
}))

vi.mock('./pages', () => ({
  Dashboard: ({ onNavigate }: { onNavigate: (page: string) => void }) => (
    <div>
      <p>Página Dashboard</p>
      <button onClick={() => onNavigate('processos')}>Ir para Processos</button>
    </div>
  ),
  Pessoas: () => <p>Página Pessoas</p>,
  Processos: () => <p>Página Processos</p>,
  Configuracoes: () => <p>Página Configurações</p>,
}))

import App from './App'

describe('App UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockObterConfiguracao.mockImplementation(async (chave: string) => {
      if (chave === 'nomeEmpresa') return 'Empresa Teste'
      if (chave === 'seguranca_pin_hash') return '1234'
      if (chave === 'seguranca_idle_minutos') return 5
      return null
    })
  })

  test('desbloqueia sessao e navega entre paginas', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Sessão bloqueada')).toBeTruthy()

    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

    expect(await screen.findByText('Página Dashboard')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Processos' }))
    expect(screen.getByText('Página Processos')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Pessoas' }))
    expect(screen.getByText('Página Pessoas')).toBeTruthy()
  })

  test('permite bloquear sessao pelo menu mobile', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    expect(await screen.findByText('Página Dashboard')).toBeTruthy()

    await user.click(screen.getByLabelText('Menu'))
    const botoesBloquear = screen.getAllByRole('button', { name: 'Bloquear' })
    await user.click(botoesBloquear[botoesBloquear.length - 1])

    expect(await screen.findByText('Sessão bloqueada')).toBeTruthy()
  })

  test('exige token quando servidor retorna erro de autenticacao e libera fluxo apos validar', async () => {
    const user = userEvent.setup()
    let primeiraTentativa = true
    mockObterConfiguracao.mockImplementation(async (chave: string) => {
      if (primeiraTentativa) {
        primeiraTentativa = false
        throw new Error('Token de acesso ausente')
      }
      if (chave === 'nomeEmpresa') return 'Empresa Teste'
      if (chave === 'seguranca_pin_hash') return null
      if (chave === 'seguranca_idle_minutos') return 5
      return null
    })

    render(<App />)

    expect(await screen.findByText('Validar token e continuar')).toBeTruthy()
    expect(screen.getByText('Token da API ausente ou inválido. Informe o token para continuar.')).toBeTruthy()

    await user.type(screen.getByLabelText('Token da API'), 'token-host')
    await user.click(screen.getByRole('button', { name: 'Validar token e continuar' }))

    expect(await screen.findByText('Configurar PIN')).toBeTruthy()
    expect(localStorage.getItem('aguia.api.token')).toBe('token-host')
  })
})
