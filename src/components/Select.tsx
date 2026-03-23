import React from 'react'

interface Option {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Option[]
  error?: string
  placeholder?: string
}

export const Select: React.FC<SelectProps> = ({ label, options, error, placeholder, className = '', id, ...rest }) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={`w-full px-3 py-2 border rounded-lg text-sm shadow-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
          disabled:bg-gray-100 disabled:text-gray-500 appearance-none
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}
          ${className}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
