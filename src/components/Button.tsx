import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  isLoading?: boolean
  children: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-red-700 text-white hover:bg-red-800 focus:ring-red-500 disabled:bg-red-300',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-400 disabled:text-gray-400',
  danger: 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200 focus:ring-red-400',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 disabled:bg-green-300',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled || isLoading}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
      focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-150
      disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
  >
    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
)
