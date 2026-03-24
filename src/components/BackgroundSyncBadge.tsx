import React, { useEffect, useState } from 'react'
import { Loader2, WifiOff } from 'lucide-react'

interface BackgroundSyncBadgeProps {
  active?: boolean
  label?: string
  delayMs?: number
  erro?: boolean
  erroLabel?: string
}

export const BackgroundSyncBadge: React.FC<BackgroundSyncBadgeProps> = ({
  active = true,
  label = 'Atualizando...',
  delayMs = 350,
  erro = false,
  erroLabel = 'Servidor indisponível',
}) => {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!active && !erro) {
      setVisivel(false)
      return
    }

    if (erro) {
      setVisivel(true)
      return
    }

    const timer = window.setTimeout(() => setVisivel(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs, erro])

  if (!visivel) return null

  if (erro) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-red-400/50 bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200">
        <WifiOff className="h-3.5 w-3.5" />
        {erroLabel}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  )
}