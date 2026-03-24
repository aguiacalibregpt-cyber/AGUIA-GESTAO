import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface BackgroundSyncBadgeProps {
  active?: boolean
  label?: string
  delayMs?: number
}

export const BackgroundSyncBadge: React.FC<BackgroundSyncBadgeProps> = ({
  active = true,
  label = 'Atualizando...',
  delayMs = 350,
}) => {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisivel(false)
      return
    }

    const timer = window.setTimeout(() => setVisivel(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs])

  if (!visivel) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {label}
    </span>
  )
}