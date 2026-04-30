'use client'

import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

let toastListeners: ((toasts: ToastItem[]) => void)[] = []
let toasts: ToastItem[] = []

function notify() {
  toastListeners.forEach((listener) => listener([...toasts]))
}

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { id, message, type }]
  notify()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    notify()
  }, 3000)
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    toastListeners.push(setItems)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-md px-4 py-2 text-sm shadow-lg animate-in slide-in-from-right fade-in duration-200 ${
            item.type === 'success'
              ? 'bg-green-600 text-white'
              : item.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-foreground text-background'
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}
