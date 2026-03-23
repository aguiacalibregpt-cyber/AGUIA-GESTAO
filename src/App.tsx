import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Shield, Wifi } from 'lucide-react'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white px-4 py-3 flex items-center gap-2 shadow-sm">
          <Shield className="text-primary-600" size={20} />
          <div>
            <p className="font-semibold">AGUIA GESTAO</p>
            <p className="text-xs text-slate-500">Desktop seguro com sync LAN (mTLS)</p>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <Wifi size={14} /> LAN sync pronto
          </div>
        </header>
        <main className="p-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Bem-vindo</h2>
            <p className="text-sm text-slate-600">
              Estrutura pronta para dados criptografados, Dexie, e sincronização LAN segura.
            </p>
          </div>
        </main>
      </div>
    </QueryClientProvider>
  )
}
