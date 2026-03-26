import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Users, FileText, Settings, Menu, X, Shield, Lock, Unlock } from 'lucide-react'
import { Dashboard, Pessoas, Processos, Configuracoes } from './pages'
import { useConfiguracoesStore } from './stores/configuracoesStore'
import { Button, Input } from './components'
import { hashPin, compararHash, validarFormatoPin } from './lib/pin'
import { obterMensagemErro } from './utils/robustness'

type Pagina = 'dashboard' | 'pessoas' | 'processos' | 'configuracoes'

const qc = new QueryClient()

const NAV_ITEMS: { id: Pagina; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'pessoas', label: 'Pessoas', icon: <Users className="w-5 h-5" /> },
  { id: 'processos', label: 'Processos', icon: <FileText className="w-5 h-5" /> },
  { id: 'configuracoes', label: 'Configurações', icon: <Settings className="w-5 h-5" /> },
]

function AppInner() {
  const [paginaAtual, setPaginaAtual] = useState<Pagina>('dashboard')
  const [novoProcessoPessoaId, setNovoProcessoPessoaId] = useState<string | undefined>()
  const [menuAberto, setMenuAberto] = useState(false)
  const [compacto, setCompacto] = useState(false)
  const { obterConfiguracao } = useConfiguracoesStore()
  const { salvarConfiguracao } = useConfiguracoesStore()
  const [nomeEmpresa, setNomeEmpresa] = useState('ÁGUIA GESTÃO')
  const [estadoAcesso, setEstadoAcesso] = useState<'carregando' | 'token' | 'setup' | 'bloqueado' | 'desbloqueado'>('carregando')
  const [pinHashSalvo, setPinHashSalvo] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [novoPin, setNovoPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [erroPin, setErroPin] = useState('')
  const [mensagemAcesso, setMensagemAcesso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [tentativas, setTentativas] = useState(0)
  const [tempoInatividadeMinutos, setTempoInatividadeMinutos] = useState(5)
  const [tokenApiAcesso, setTokenApiAcesso] = useState('')
  const [logoIndisponivel, setLogoIndisponivel] = useState(false)

  const ehErroAutenticacao = (mensagem: string): boolean => {
    const txt = mensagem.toLowerCase()
    return txt.includes('token de acesso ausente')
      || txt.includes('token de acesso inválido')
      || txt.includes('modo bloqueado')
      || txt.includes('erro http 401')
      || txt.includes('erro http 403')
      || txt.includes('erro http 503')
  }

  useEffect(() => {
    const fn = () => setCompacto(window.scrollY > 60)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    try {
      setTokenApiAcesso(localStorage.getItem('aguia.api.token') || '')
    } catch {
      setTokenApiAcesso('')
    }
  }, [])

  const carregarEstadoSeguranca = useCallback(async () => {
    try {
      const [nome, pinHash, idle] = await Promise.all([
      obterConfiguracao('nomeEmpresa'),
      obterConfiguracao('seguranca_pin_hash'),
      obterConfiguracao('seguranca_idle_minutos'),
      ])

      if (typeof nome === 'string' && nome.trim()) setNomeEmpresa(nome)
      if (typeof idle === 'number' && Number.isFinite(idle) && idle > 0) {
        setTempoInatividadeMinutos(Math.min(120, Math.max(1, Math.floor(idle))))
      }
      if (typeof pinHash === 'string' && pinHash.trim()) {
        setPinHashSalvo(pinHash)
        setEstadoAcesso('bloqueado')
        return
      }
      setPinHashSalvo(null)
      setEstadoAcesso('setup')
    } catch (error) {
      const mensagem = obterMensagemErro(error, 'Falha ao carregar segurança')
      if (ehErroAutenticacao(mensagem)) {
        setEstadoAcesso('token')
        setErroPin('Token da API ausente ou inválido. Informe o token para continuar.')
      } else {
        setEstadoAcesso('setup')
      }
    }
  }, [obterConfiguracao])

  useEffect(() => {
    void carregarEstadoSeguranca()
  }, [carregarEstadoSeguranca])

  const salvarTokenApiLocal = (): boolean => {
    try {
      const token = tokenApiAcesso.trim()
      if (token) {
        localStorage.setItem('aguia.api.token', token)
      } else {
        localStorage.removeItem('aguia.api.token')
      }
      return true
    } catch {
      return false
    }
  }

  const validarTokenEContinuar = async () => {
    setMensagemAcesso(null)
    setErroPin('')
    if (!tokenApiAcesso.trim()) {
      setErroPin('Informe o Token da API para continuar')
      return
    }
    if (!salvarTokenApiLocal()) {
      setErroPin('Não foi possível salvar o token localmente neste navegador')
      return
    }

    setEstadoAcesso('carregando')
    await carregarEstadoSeguranca()
  }

  useEffect(() => {
    if (estadoAcesso !== 'desbloqueado') return
    let timeout: ReturnType<typeof setTimeout>
    const resetar = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        setEstadoAcesso('bloqueado')
        setPinInput('')
        setErroPin('Sessão bloqueada por inatividade')
      }, tempoInatividadeMinutos * 60 * 1000)
    }
    const eventos: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    eventos.forEach((evento) => window.addEventListener(evento, resetar, { passive: true }))
    resetar()
    return () => {
      clearTimeout(timeout)
      eventos.forEach((evento) => window.removeEventListener(evento, resetar))
    }
  }, [estadoAcesso, tempoInatividadeMinutos])

  const criarPrimeiroPin = async () => {
    setErroPin('')
    setMensagemAcesso(null)
    if (!tokenApiAcesso.trim()) {
      setErroPin('Informe o Token da API antes de salvar o primeiro PIN')
      return
    }
    if (!salvarTokenApiLocal()) {
      setErroPin('Não foi possível salvar o token localmente neste navegador')
      return
    }
    if (!validarFormatoPin(novoPin)) {
      setErroPin('Use um PIN numérico de 4 a 8 dígitos')
      return
    }
    if (novoPin !== confirmarPin) {
      setErroPin('A confirmação do PIN não confere')
      return
    }
    try {
      const hash = await hashPin(novoPin)
      await salvarConfiguracao('seguranca_pin_hash', hash)
      setPinHashSalvo(hash)
      setNovoPin('')
      setConfirmarPin('')
      setEstadoAcesso('desbloqueado')
    } catch {
      setErroPin('Não foi possível salvar o PIN. Verifique a conexão com o servidor e tente novamente.')
    }
  }

  const desbloquear = async () => {
    setErroPin('')
    setMensagemAcesso(null)
    if (!pinHashSalvo) {
      setEstadoAcesso('setup')
      return
    }
    try {
      const hashInformado = await hashPin(pinInput)
      if (!compararHash(hashInformado, pinHashSalvo)) {
        const novasTentativas = tentativas + 1
        setTentativas(novasTentativas)
        setErroPin(novasTentativas >= 3 ? 'PIN inválido. Aguarde 10 segundos.' : 'PIN inválido')
        if (novasTentativas >= 3) {
          setTimeout(() => setTentativas(0), 10_000)
        }
        return
      }

      setTentativas(0)
      setPinInput('')
      setEstadoAcesso('desbloqueado')
    } catch {
      setErroPin('Não foi possível validar o PIN agora. Tente novamente em instantes.')
    }
  }

  const navegarPara = (pagina: Pagina) => {
    setPaginaAtual(pagina)
    setMenuAberto(false)
    window.scrollTo({ top: 0 })
    if (pagina !== 'processos') setNovoProcessoPessoaId(undefined)
  }

  const irParaNovoProcesso = (pessoaId: string) => {
    setNovoProcessoPessoaId(pessoaId)
    navegarPara('processos')
  }

  const renderPagina = () => {
    switch (paginaAtual) {
      case 'dashboard':
        return <Dashboard onNavigate={(page) => navegarPara(page as Pagina)} />
      case 'pessoas':
        return <Pessoas onNovoProcesso={irParaNovoProcesso} />
      case 'processos':
        return <Processos pessoaIdInicial={novoProcessoPessoaId} />
      case 'configuracoes':
        return <Configuracoes />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {estadoAcesso !== 'desbloqueado' && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-zinc-950 via-red-950 to-black flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-red-100 flex items-center justify-center">
                {!logoIndisponivel ? (
                  <img
                    src="/logo-aguia.jpg"
                    alt="Logotipo Águia"
                    className="h-11 w-11 rounded-lg object-cover"
                    onError={() => setLogoIndisponivel(true)}
                  />
                ) : (
                  <Lock className="w-6 h-6 text-red-700" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{estadoAcesso === 'setup' ? 'Configurar PIN' : 'Sessão bloqueada'}</h2>
                <p className="text-sm text-gray-500">{nomeEmpresa}</p>
              </div>
            </div>

            {estadoAcesso === 'carregando' && <p className="text-sm text-gray-600">Carregando segurança...</p>}

            {estadoAcesso === 'token' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  O servidor exige autenticação. Informe o Token da API para validar o acesso antes de configurar/desbloquear PIN.
                </p>
                <Input
                  label="Token da API"
                  type="password"
                  value={tokenApiAcesso}
                  onChange={(e) => {
                    setTokenApiAcesso(e.target.value)
                    if (mensagemAcesso) setMensagemAcesso(null)
                  }}
                  placeholder="Mesmo token usado no servidor"
                />
                {erroPin && <p className="text-xs text-red-600">{erroPin}</p>}
                <Button className="w-full justify-center" onClick={() => void validarTokenEContinuar()}>
                  Validar token e continuar
                </Button>
              </div>
            )}

            {estadoAcesso === 'setup' && (
              <div className="space-y-3">
                <Input
                  label="Token da API"
                  type="password"
                  value={tokenApiAcesso}
                  onChange={(e) => {
                    setTokenApiAcesso(e.target.value)
                    if (mensagemAcesso) setMensagemAcesso(null)
                  }}
                  placeholder="Mesmo token usado no servidor"
                />
                <Input
                  label="PIN de acesso"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={novoPin}
                  onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4 a 8 dígitos"
                />
                <Input
                  label="Confirmar PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmarPin}
                  onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Repita o PIN"
                />
                {erroPin && <p className="text-xs text-red-600">{erroPin}</p>}
                {mensagemAcesso && (
                  <p className={`text-xs ${mensagemAcesso.tipo === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {mensagemAcesso.texto}
                  </p>
                )}
                <Button className="w-full justify-center" onClick={() => void criarPrimeiroPin()}>
                  <Unlock className="w-4 h-4" />
                  Salvar e entrar
                </Button>
              </div>
            )}

            {estadoAcesso === 'bloqueado' && (
              <div className="space-y-3">
                <Input
                  label="Token da API (se precisar atualizar)"
                  type="password"
                  value={tokenApiAcesso}
                  onChange={(e) => {
                    setTokenApiAcesso(e.target.value)
                    if (mensagemAcesso) setMensagemAcesso(null)
                  }}
                  placeholder="Mesmo token usado no servidor"
                />
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => {
                    if (salvarTokenApiLocal()) {
                      setErroPin('')
                      setMensagemAcesso({ tipo: 'success', texto: 'Token salvo com sucesso neste navegador.' })
                    } else {
                      setErroPin('Não foi possível salvar o token localmente neste navegador')
                      setMensagemAcesso({ tipo: 'error', texto: 'Falha ao salvar token. Tente novamente.' })
                    }
                  }}
                >
                  Salvar token neste navegador
                </Button>
                <Input
                  label="PIN"
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Digite seu PIN"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tentativas < 3) void desbloquear()
                  }}
                />
                {erroPin && <p className="text-xs text-red-600">{erroPin}</p>}
                {mensagemAcesso && (
                  <p className={`text-xs ${mensagemAcesso.tipo === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {mensagemAcesso.texto}
                  </p>
                )}
                <Button
                  className="w-full justify-center"
                  onClick={() => void desbloquear()}
                  disabled={tentativas >= 3 || !pinInput}
                >
                  <Unlock className="w-4 h-4" />
                  Desbloquear
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className={`sticky top-0 z-40 bg-gradient-to-r from-zinc-950 via-red-950 to-black shadow-lg border-b border-red-900/50 transition-all duration-200 ${compacto ? 'py-2' : 'py-3'}`}
      >
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`bg-red-800/60 rounded-lg flex items-center justify-center transition-all ${compacto ? 'p-1.5' : 'p-2'}`}>
              {!logoIndisponivel ? (
                <img
                  src="/logo-aguia.jpg"
                  alt="Logotipo Águia"
                  className={`rounded-md object-cover transition-all ${compacto ? 'w-5 h-5' : 'w-6 h-6'}`}
                  onError={() => setLogoIndisponivel(true)}
                />
              ) : (
                <Shield className={`text-white transition-all ${compacto ? 'w-5 h-5' : 'w-6 h-6'}`} />
              )}
            </div>
            <div>
              <p className={`font-bold text-white leading-tight transition-all ${compacto ? 'text-sm' : 'text-base'}`}>{nomeEmpresa}</p>
              {!compacto && <p className="text-red-300 text-xs">Sistema de Gestão de Processos</p>}
            </div>
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => navegarPara(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  paginaAtual === item.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <button
            className="hidden md:inline-flex ml-auto items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => {
              setEstadoAcesso('bloqueado')
              setPinInput('')
              setErroPin('')
            }}
          >
            <Lock className="w-4 h-4" />
            Bloquear
          </button>

          {/* Hamburger mobile */}
          <button
            className="md:hidden ml-auto text-white/80 hover:text-white p-2"
            onClick={() => setMenuAberto(!menuAberto)}
            aria-label="Menu"
          >
            {menuAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Menu mobile dropdown */}
        {menuAberto && (
          <div className="md:hidden bg-zinc-900 border-t border-red-900/50 px-4 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => navegarPara(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                  paginaAtual === item.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <button
              className="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => {
                setMenuAberto(false)
                setEstadoAcesso('bloqueado')
                setPinInput('')
                setErroPin('')
              }}
            >
              <Lock className="w-5 h-5" />
              Bloquear
            </button>
          </div>
        )}
      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderPagina()}
      </main>

      {/* Rodapé */}
      <footer className="text-center text-xs text-gray-400 py-6">
        {nomeEmpresa} © {new Date().getFullYear()} — Dados armazenados localmente com criptografia AES-GCM
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  )
}
