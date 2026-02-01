import { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'running' | 'success' | 'error' | 'pending'
  children: ReactNode
}

export default function Badge({ variant = 'pending', children }: BadgeProps) {
  const variantStyles = {
    running:
      'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    success: 'bg-green-500/20 text-terminal-success border-green-500/30',
    error: 'bg-red-500/20 text-terminal-error border-red-500/30',
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${variantStyles[variant]}`}
    >
      {children}
    </span>
  )
}
