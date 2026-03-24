import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components'
import './index.css'

const renderErroFatal = (mensagem: string) => {
  const body = document.body
  if (!body) return
  body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-family:Arial,sans-serif;padding:24px;">
      <div style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,0.08)">
        <h2 style="margin:0 0 10px;font-size:20px;color:#991b1b;">Falha ao iniciar o sistema</h2>
        <p style="margin:0 0 10px;color:#374151;">${mensagem}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Tente recarregar com Ctrl+F5. Se persistir, verifique se o servidor está ativo.</p>
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  const mensagem = event?.error?.message || event.message || 'Erro inesperado de execução.'
  // Mantém feedback visual no cliente em vez de tela em branco.
  renderErroFatal(mensagem)
})

window.addEventListener('unhandledrejection', (event) => {
  const motivo = event.reason instanceof Error ? event.reason.message : String(event.reason)
  renderErroFatal(`Erro assíncrono não tratado: ${motivo}`)
})

const root = document.getElementById('root')
if (!root) {
  renderErroFatal('Elemento raiz da aplicação não encontrado no HTML.')
} else {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
