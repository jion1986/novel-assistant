'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-bold mb-4 text-foreground">出错了</h1>
      <p className="text-muted-foreground mb-6">
        {error.message || '页面渲染时发生错误'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-6 font-mono">
          错误ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        重试
      </button>
    </div>
  )
}
