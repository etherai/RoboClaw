'use client'

import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-terminal-success" />,
    error: <AlertCircle className="w-5 h-5 text-terminal-error" />,
    info: <Info className="w-5 h-5 text-accent-blue" />,
  }

  const bgColors = {
    success: 'bg-terminal-success/10 border-terminal-success/30',
    error: 'bg-terminal-error/10 border-terminal-error/30',
    info: 'bg-accent-blue/10 border-accent-blue/30',
  }

  return (
    <div
      className={`${bgColors[type]} border rounded-lg p-4 shadow-lg backdrop-blur-lg flex items-start gap-3 min-w-[300px] max-w-md animate-slide-in`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
