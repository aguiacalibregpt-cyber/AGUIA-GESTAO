import React, { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertProps {
  type: AlertType
  message: string
  onClose?: () => void
  autoClose?: number
}

const config: Record<AlertType, { icon: React.FC<{ className?: string }>; classes: string }> = {
  success: { icon: CheckCircle, classes: 'bg-green-50 border-green-400 text-green-800' },
  error: { icon: XCircle, classes: 'bg-red-50 border-red-400 text-red-800' },
  warning: { icon: AlertCircle, classes: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
  info: { icon: Info, classes: 'bg-blue-50 border-blue-400 text-blue-800' },
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose, autoClose = 5000 }) => {
  const { icon: Icon, classes } = config[type]

  useEffect(() => {
    if (!onClose || !autoClose) return
    const timer = setTimeout(onClose, autoClose)
    return () => clearTimeout(timer)
  }, [onClose, autoClose])

  return (
    <div className={`flex items-start gap-3 p-4 border rounded-lg ${classes}`} role="alert">
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 hover:opacity-70 transition-opacity" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
