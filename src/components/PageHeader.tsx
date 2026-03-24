import React from 'react'

interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, actions }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-zinc-950 via-red-950 to-black rounded-2xl shadow-lg p-5 sm:p-8 text-white border border-red-900/70">
      <div className="absolute -top-10 -right-8 w-40 h-40 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-8 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="bg-red-900/45 rounded-xl p-3 border border-red-800/70 shadow-inner shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-red-200/95 mt-1 text-sm sm:text-base leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="w-full sm:w-auto">{actions}</div>}
      </div>
    </div>
  )
}