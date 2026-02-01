'use client'

import Toast, { type ToastType } from './Toast'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

interface ToastContainerProps {
  toasts: ToastMessage[]
  removeToast: (id: string) => void
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
